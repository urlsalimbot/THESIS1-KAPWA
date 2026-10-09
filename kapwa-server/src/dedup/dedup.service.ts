import { Injectable, Optional, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientImportOperation, ClientImportRow, ClientImportMatch, BeneficiaryRemark } from './dedup.entity';
import { parseImportFile, ColumnMap, ColumnMapError } from './dedup-parse.service';
import { sweep, RowInput } from './dedup-match-sweep.service';
import { DedupAdapter } from './dedup-adapter';

/**
 * Operations lifecycle: define the column map, upload + parse + match, list,
 * detail counts. Decisions and finalize extend this service in later tasks.
 */
@Injectable()
export class DedupService {
  constructor(
    @InjectRepository(ClientImportOperation)
    private readonly opsRepo: Repository<ClientImportOperation>,
    @InjectRepository(ClientImportRow)
    private readonly rowsRepo: Repository<ClientImportRow>,
    @InjectRepository(ClientImportMatch)
    private readonly matchesRepo: Repository<ClientImportMatch>,
    private readonly adapter: DedupAdapter,
    @Optional()
    @InjectRepository(BeneficiaryRemark)
    private readonly remarksRepo?: Repository<BeneficiaryRemark>,
  ) {}

  /** A row's status derives from its matches: pending wins, then deprioritized,
   *  then an intra-import winner (primary), else it was retained against an
   *  existing record. A row with no matches never needs a decision. */
  private async deriveRowStatus(rowId: string): Promise<ClientImportRow['status']> {
    const matches = await this.matchesRepo.find({ where: { rowId } });
    if (matches.length === 0) return 'no_match';
    if (matches.some((m) => m.status === 'pending')) return 'pending';
    if (matches.some((m) => m.status === 'deprioritized')) return 'deprioritized';
    if (matches.some((m) => m.targetType === 'import_row')) return 'primary';
    return 'retained';
  }

  async decide(
    operationId: string,
    matchId: string,
    body: { keep: 'import_row' | 'existing_record' | 'other_import_row'; remark?: string },
    actorId: string,
  ) {
    const op = await this.opsRepo.findOne({ where: { id: operationId } });
    if (!op) throw new NotFoundException('Operation not found');
    if (op.status !== 'reviewing') throw new BadRequestException('Operation is not in review');
    const match = await this.matchesRepo.findOne({ where: { id: matchId } });
    if (!match) throw new NotFoundException('Match not found');
    const remark = (body.remark ?? '').trim();
    if (body.keep !== 'import_row' && remark === '') {
      throw new BadRequestException('A remark is required when deprioritizing a duplicate');
    }
    const row = await this.rowsRepo.findOne({ where: { id: match.rowId } });
    if (!row) throw new NotFoundException('Row not found');

    const now = new Date();
    match.status = body.keep === 'import_row' ? 'primary' : 'deprioritized';
    if (remark) match.remark = remark;
    match.decidedBy = actorId;
    match.decidedAt = now;
    await this.matchesRepo.save(match);

    row.decidedBy = actorId;
    row.decidedAt = now;
    if (body.keep === 'import_row') {
      row.matchedPersonId = match.targetPersonId ?? row.matchedPersonId;
      row.remarks = [row.originalRemarks, remark].filter(Boolean).join(' | ') || undefined;
    } else {
      const dupOf = match.targetType === 'import_row' ? `row ${match.targetImportRowId}` : 'an existing record';
      row.remarks = [row.originalRemarks, `Deprioritized — duplicate of ${dupOf}${remark ? `: ${remark}` : ''}`]
        .filter(Boolean).join(' | ');
      if (body.keep === 'other_import_row' && match.targetImportRowId) {
        const paired = await this.rowsRepo.findOne({ where: { id: match.targetImportRowId } });
        if (paired) {
          paired.status = 'primary';
          await this.rowsRepo.save(paired);
        }
      }
    }
    row.status = await this.deriveRowStatus(row.id);
    await this.rowsRepo.save(row);

    // The decision is traceable on the record that survives.
    if (body.keep !== 'import_row' && match.targetPersonId && this.remarksRepo) {
      const bens = await this.rowsRepo.query('SELECT id FROM beneficiaries WHERE person_id = $1 LIMIT 1', [match.targetPersonId]);
      const beneficiaryId = bens?.[0]?.id;
      if (beneficiaryId) {
        await this.remarksRepo.save(this.remarksRepo.create({
          beneficiaryId,
          operationId,
          kind: 'decision',
          remark,
          source: op.source,
          authoredBy: actorId,
        }));
      }
    }
    return { row, match };
  }

  async revert(operationId: string, matchId: string) {
    const op = await this.opsRepo.findOne({ where: { id: operationId } });
    if (!op) throw new NotFoundException('Operation not found');
    if (op.status !== 'reviewing') throw new BadRequestException('Operation is not in review');
    const match = await this.matchesRepo.findOne({ where: { id: matchId } });
    if (!match) throw new NotFoundException('Match not found');
    match.status = 'pending';
    match.decidedAt = undefined;
    await this.matchesRepo.save(match);
    const row = await this.rowsRepo.findOne({ where: { id: match.rowId } });
    if (row) {
      row.status = await this.deriveRowStatus(row.id);
      await this.rowsRepo.save(row);
    }
    return { row, match };
  }

  async create(input: { source: string; columnMap: ColumnMap; matchThreshold?: number }, actorId: string) {
    const op = this.opsRepo.create({
      source: input.source,
      columnMap: input.columnMap as unknown as Record<string, unknown>,
      matchThreshold: input.matchThreshold ?? 0.75,
      status: 'defined',
      createdBy: actorId,
    });
    const saved = await this.opsRepo.save(op);
    return { id: saved.id };
  }

  async upload(id: string, buffer: Buffer, filename: string, actorId: string) {
    const op = await this.opsRepo.findOne({ where: { id } });
    if (!op) throw new NotFoundException('Operation not found');
    if (op.status !== 'defined') throw new BadRequestException('Operation is not in the defined state');

    const columnMap = op.columnMap as unknown as ColumnMap;
    let parsed;
    try {
      parsed = await parseImportFile(buffer, filename, columnMap);
    } catch (e) {
      if (e instanceof ColumnMapError) throw new BadRequestException(e.message);
      throw e;
    }

    // Map declared identifier extras onto the row for the matcher.
    const identifierOf = (kind: string) => columnMap.extras.find((x) => x.identifier === kind)?.name;
    const phoneField = identifierOf('phone');
    const emailField = identifierOf('email');
    const philsysField = identifierOf('philsys');

    const rowInputs: RowInput[] = parsed.rows.map((r) => ({
      id: String(r.rowIndex),
      rowIndex: r.rowIndex,
      lastName: r.lastName,
      firstName: r.firstName,
      middleName: r.middleName,
      dob: r.dob,
      barangay: r.barangay,
      phone: phoneField ? String(r.extraData[phoneField] ?? '') : undefined,
      email: emailField ? String(r.extraData[emailField] ?? '') : undefined,
      philsys: philsysField ? String(r.extraData[philsysField] ?? '') : undefined,
    }));

    const result = await sweep({
      rows: rowInputs,
      threshold: Number(op.matchThreshold) || 0.75,
      sim: (x, y) => this.adapter.sim(x, y),
      persons: { searchSimilar: (q) => this.adapter.searchSimilar(q) },
      households: {
        byMemberPersonIds: async (personIds) => {
          if (personIds.length === 0) return [];
          const rows: any[] = await this.rowsRepo.manager.query(
            `SELECT h.id, ARRAY_AGG(hm.person_id::text) AS "memberPersonIds"
               FROM households h
               JOIN household_memberships hm ON hm.household_id = h.id
              WHERE hm.person_id::text = ANY($1::text[])
              GROUP BY h.id`,
            [personIds],
          );
          return rows.map((r) => ({ id: r.id, memberPersonIds: r.memberPersonIds }));
        },
      },
      interventions: {
        countsByPerson: async (personIds) => {
          if (personIds.length === 0) return {};
          const rows: any[] = await this.rowsRepo.manager.query(
            `SELECT i.person_id::text AS person_id, COUNT(*)::int AS count
               FROM case_interventions i
              WHERE i.person_id::text = ANY($1::text[])
              GROUP BY i.person_id`,
            [personIds],
          );
          const map: Record<string, number> = {};
          for (const r of rows) map[r.person_id] = Number(r.count);
          return map;
        },
      },
    });

    const rowEntities = parsed.rows.map((r) => {
      const status = result.rowStatus[String(r.rowIndex)] ?? 'pending';
      const best = result.candidates.filter((c) => c.rowId === String(r.rowIndex)).sort((a, b) => b.score - a.score)[0];
      return this.rowsRepo.create({
        operationId: id,
        rowIndex: r.rowIndex,
        lastName: r.lastName,
        firstName: r.firstName,
        middleName: r.middleName,
        dob: r.dob,
        barangay: r.barangay,
        originalRemarks: r.originalRemarks,
        extraData: r.extraData,
        status,
        score: best ? best.score : undefined,
      });
    });
    await this.rowsRepo.save(rowEntities);

    const matchEntities = result.candidates.map((c) =>
      this.matchesRepo.create({
        rowId: c.rowId,
        targetType: c.targetType,
        targetPersonId: c.targetPersonId,
        targetImportRowId: c.targetImportRowId,
        targetHouseholdId: c.targetHouseholdId,
        score: c.score,
        signals: c.signals as unknown as Record<string, unknown>,
        status: 'pending',
      }));
    if (matchEntities.length > 0) await this.matchesRepo.save(matchEntities);

    op.status = 'reviewing';
    await this.opsRepo.save(op);
    return { rows: rowEntities.length, matches: matchEntities.length };
  }

  async list(page = 1, limit = 10, status?: string) {
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    const [data, total] = await this.opsRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit };
  }

  async detail(id: string) {
    const op = await this.opsRepo.findOne({ where: { id } });
    if (!op) throw new NotFoundException('Operation not found');
    const counts: any[] = await this.rowsRepo.query(
      `SELECT status, COUNT(*)::int AS count FROM client_import_rows WHERE operation_id = $1 GROUP BY status`,
      [id],
    );
    const byStatus: Record<string, number> = {};
    for (const r of counts) byStatus[r.status] = Number(r.count);
    return {
      ...op,
      pending: byStatus.pending ?? 0,
      noMatch: byStatus.no_match ?? 0,
      decided: (byStatus.retained ?? 0) + (byStatus.primary ?? 0) + (byStatus.deprioritized ?? 0),
      totalRows: Object.values(byStatus).reduce((a, b) => a + b, 0),
    };
  }
}