import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientImportOperation } from './dedup.entity';
import { DedupService } from './dedup.service';

/**
 * Runs queued dedup finalizes (`status = 'finalizing'`) outside the request path.
 *
 * The claim is one atomic statement: `FOR UPDATE SKIP LOCKED` over the oldest
 * queued operation, stamping `finalize_started_at` as a lease. Two API instances
 * therefore cannot run the same batch, and a worker that dies mid-job is
 * reclaimed once the lease is stale — safe because `finalize()` is a single
 * transaction, so a crash leaves nothing half-written and a rerun starts clean.
 *
 * shortcut: the job is one transaction, so progress is indeterminate — a
 * 3,000-row batch holds its row locks for ~90 s with no percentage to show. The
 * upgrade path is chunking with a per-row processed marker (one commit per N
 * rows, resuming on the marker); until then the review screen shows a running
 * state with the elapsed time, and the operator is told to expect minutes.
 */
@Injectable()
export class DedupFinalizeWorker {
  private readonly logger = new Logger(DedupFinalizeWorker.name);
  /** One job per process: a batch is already CPU- and database-heavy. */
  private busy = false;

  constructor(
    @InjectRepository(ClientImportOperation)
    private readonly opsRepo: Repository<ClientImportOperation>,
    private readonly dedup: DedupService,
  ) {}

  @Interval(2000)
  async tick(): Promise<void> {
    // The guard covers the claim as well: two overlapping ticks would otherwise
    // both claim (different jobs — the lock keeps them apart — but this process
    // should run one batch at a time).
    if (this.busy) return;
    this.busy = true;
    const started = Date.now();
    let jobId: string | undefined;
    try {
      const job = await this.claim();
      if (!job) return;
      jobId = job.id;
      const summary = await this.dedup.finalize(job.id, job.accomplisher);
      this.logger.log(
        `dedup finalize ${job.id} finished in ${Math.round((Date.now() - started) / 1000)}s: ${JSON.stringify(summary)}`,
      );
    } catch (e) {
      this.logger.error(`dedup finalize failed${jobId ? ` for ${jobId}` : ' to claim'}: ${e instanceof Error ? e.message : e}`);
      if (jobId) await this.dedup.recordFinalizeFailure(jobId, e);
    } finally {
      this.busy = false;
    }
  }

  /** Atomically take the oldest queued job, or nothing. */
  async claim(): Promise<{ id: string; accomplisher: string | null } | undefined> {
    // TypeORM returns [rows, affected] for UPDATE ... RETURNING (PostgresQueryRunner.raw).
    const [rows]: [Array<{ id: string; accomplisher: string | null }>, number] = await this.opsRepo.query(
      `UPDATE client_import_operations
          SET finalize_started_at = now()
        WHERE id = (
          SELECT id FROM client_import_operations
           WHERE status = 'finalizing'
             AND (finalize_started_at IS NULL OR finalize_started_at < now() - interval '10 minutes')
           ORDER BY created_at
           LIMIT 1
           FOR UPDATE SKIP LOCKED
        )
        RETURNING id, accomplisher`,
    );
    return rows[0];
  }
}
