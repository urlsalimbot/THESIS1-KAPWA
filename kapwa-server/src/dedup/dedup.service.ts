import { Injectable, Optional, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { ClientImportOperation, ClientImportRow, ClientImportMatch, BeneficiaryRemark } from './dedup.entity';
import { parseImportFile, ColumnMap, ColumnMapError } from './dedup-parse.service';
import { sweep, RowInput } from './dedup-match-sweep.service';
import { DedupAdapter } from './dedup-adapter';
import { v7 as uuidv7 } from 'uuid';
import { computeEligibility } from './dedup-eligibility.service';

export const DEDUP_ADAPTER = 'DEDUP_ADAPTER';
import { Person } from '../beneficiaries/person.entity';
import { Beneficiary } from '../beneficiaries/beneficiary.entity';
import { PersonAddress } from '../beneficiaries/person-address.entity';
import { BeneficiaryRemarksService } from './beneficiary-remarks.service';

/** Writes the stored priority-list Excel (Task 8 supplies the implementation). */
export interface DedupOutputWriter {
  write(op: ClientImportOperation, rows: ClientImportRow[]): Promise<string>;
  /** The same workbook in memory — used when the stored file no longer exists. */
  build(op: ClientImportOperation, rows: ClientImportRow[]): Promise<Buffer>;
}
export const DEDUP_OUTPUT_WRITER = 'DEDUP_OUTPUT_WRITER';

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
    @Inject(DEDUP_ADAPTER)
    private readonly adapter: DedupAdapter,
    @Optional()
    private readonly remarksService?: BeneficiaryRemarksService,
    @Optional()
    @InjectRepository(Person)
    private readonly personRepo?: Repository<Person>,
    @Optional()
    @InjectRepository(Beneficiary)
    private readonly beneficiaryRepo?: Repository<Beneficiary>,
    @Optional()
    @InjectRepository(PersonAddress)
    private readonly addressRepo?: Repository<PersonAddress>,
    @Optional()
    @Inject(DEDUP_OUTPUT_WRITER)
    private readonly outputWriter?: DedupOutputWriter,
  ) {}

  private async recordRemark(
    beneficiaryId: string,
    operationId: string,
    kind: 'import' | 'decision' | 'barangay_update' | 'manual',
    remark: string,
    source: string | undefined,
    authoredBy: string | null,
    em: EntityManager,
  ): Promise<void> {
    if (!this.remarksService) return;
    await this.remarksService.append({ beneficiaryId, operationId, kind, remark, source, authoredBy }, em);
  }

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

  /**
   * The one decision control for a candidate match.
   *
   * Phase 2 (`db_person`/`household`): is it the same person?
   *   - `samePerson: false` → different person — the claim is severed and the
   *     row is imported as a NEW client (no record update at finalize).
   *   - `samePerson: true` + `position: 'keep'` → same person — the existing
   *     record is updated and the row keeps its position in the priority list.
   *   - `samePerson: true` + `position: 'deprioritize'` (remark required) →
   *     same person, record updated, but the row moves to the bottom of the
   *     priority list (the output grid sorts deprioritized rows last).
   *
   * Phase 1 (`import_row`): the old keep vocabulary — which of the pair wins.
   */
  async decide(
    operationId: string,
    matchId: string,
    body:
      | { samePerson: false; remark?: string }
      | { samePerson: true; position?: 'keep' | 'deprioritize'; remark?: string }
      | { keep: 'import_row' | 'other_import_row'; remark?: string },
    actorId: string,
  ) {
    const op = await this.opsRepo.findOne({ where: { id: operationId } });
    if (!op) throw new NotFoundException('Operation not found');
    if (op.status !== 'reviewing') throw new BadRequestException('Operation is not in review');
    const match = await this.matchesRepo.findOne({ where: { id: matchId } });
    if (!match) throw new NotFoundException('Match not found');
    const remark = (body.remark ?? '').trim();
    if ('keep' in body && body.keep !== 'import_row' && remark === '') {
      throw new BadRequestException('A remark is required when deprioritizing a duplicate');
    }
    if ('samePerson' in body && body.samePerson && body.position === 'deprioritize' && remark === '') {
      throw new BadRequestException('A remark is required when deprioritizing a row');
    }
    const row = await this.rowsRepo.findOne({ where: { id: match.rowId } });
    if (!row) throw new NotFoundException('Row not found');

    const now = new Date();
    match.decidedBy = actorId;
    match.decidedAt = now;

    if ('keep' in body) {
      // --- Phase 1: which row of the pair wins ---------------------------
      if (match.targetType !== 'import_row') {
        throw new BadRequestException('Use the same-person decision for record and household matches');
      }
      match.status = body.keep === 'import_row' ? 'primary' : 'deprioritized';
      if (remark) match.remark = remark;
      await this.matchesRepo.save(match);
      row.decidedBy = actorId;
      row.decidedAt = now;
      if (body.keep === 'import_row') {
        row.matchedPersonId = match.targetPersonId ?? row.matchedPersonId;
        row.remarks = [row.originalRemarks, remark].filter(Boolean).join(' | ') || undefined;
      } else {
        const dupOf = `row ${match.targetImportRowId}`;
        row.remarks = [row.originalRemarks, `Deprioritized — duplicate of ${dupOf}${remark ? `: ${remark}` : ''}`]
          .filter(Boolean).join(' | ');
        if (match.targetImportRowId) {
          const paired = await this.rowsRepo.findOne({ where: { id: match.targetImportRowId } });
          if (paired) {
            paired.status = 'primary';
            await this.rowsRepo.save(paired);
          }
        }
      }
      row.status = await this.deriveRowStatus(row.id);
      await this.rowsRepo.save(row);
      return { row, match };
    }

    // --- Phase 2: same person? -> deprioritize or keep, or a new client -----
    if (body.samePerson === false) {
      // A false positive: the row has nothing to do with this record. The match
      // is deleted (it is not a match anymore), so the row's status derives as
      // no_match and finalize imports it as a NEW client — no record update.
      match.status = 'deprioritized';
      if (remark) match.remark = remark;
      await this.matchesRepo.delete({ id: matchId });

      row.matchedPersonId = null;
      row.eligibility = 'allowed';
      row.eligibilityCode = 'new_client';
      row.eligibilityReason = 'Not the same person — imported as a new client';
      row.eligibilityDecision = null;
      row.decidedBy = actorId;
      row.decidedAt = now;
      row.remarks = [row.originalRemarks, remark].filter(Boolean).join(' | ') || undefined;
      row.status = await this.deriveRowStatus(row.id);
      await this.rowsRepo.save(row);
      // No remark history on the matched person: they are a different person.
      return { row, match };
    }

    // Same person. The record is updated at finalize either way; the decision
    // is where the row sits in the priority list.
    const deprioritize = body.position === 'deprioritize';
    match.status = deprioritize ? 'deprioritized' : 'primary';
    if (remark) match.remark = remark;
    await this.matchesRepo.save(match);

    row.decidedBy = actorId;
    row.decidedAt = now;
    // Same person: point the row at the record the operator chose. Without
    // this, a row that first answered "not the same person" (which clears the
    // field) and then "yes, keep" on another candidate kept a null match and
    // was silently dropped at finalize.
    if (match.targetPersonId) row.matchedPersonId = match.targetPersonId;
    if (deprioritize) {
      row.remarks = [
        row.originalRemarks,
        remark ? `Deprioritized — ${remark}` : 'Deprioritized',
      ].filter(Boolean).join(' | ');
    }
    row.status = await this.deriveRowStatus(row.id);

    // A disqualified row's eligibility gate is the same question the tree
    // answers: keeping them (position unchanged) serves them — the waive; moving
    // them to the bottom confirms. Mirror it once no match is left pending, so
    // finalize's "disqualified awaiting decision" gate clears with the tree.
    if (row.eligibility === 'disqualified' && !row.eligibilityDecision) {
      const remaining = await this.matchesRepo.find({ where: { rowId: row.id, status: 'pending' } });
      if (remaining.length === 0) {
        row.eligibilityDecision = deprioritize ? 'confirm' : 'waive';
      }
    }
    await this.rowsRepo.save(row);

    // The decision is traceable on the record that survives.
    if (remark && match.targetPersonId && this.remarksService) {
      const bens = await this.rowsRepo.query('SELECT id FROM beneficiaries WHERE person_id = $1 LIMIT 1', [match.targetPersonId]);
      const beneficiaryId = bens?.[0]?.id;
      if (beneficiaryId) {
        await this.remarksService.append({ beneficiaryId, operationId, kind: 'decision', remark, source: op.source, authoredBy: actorId });
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

  async create(input: { source: string; columnMap: ColumnMap; interventionType: string; matchThreshold?: number }, actorId: string) {
    const op = this.opsRepo.create({
      source: input.source,
      columnMap: input.columnMap as unknown as Record<string, unknown>,
      interventionType: input.interventionType,
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

    // Real row uuids: the sweep keys candidates by input id, and those ids
    // end up in client_import_matches.row_id (a uuid FK to client_import_rows).
    const rowIds = parsed.rows.map(() => uuidv7());
    const rowInputs: RowInput[] = parsed.rows.map((r, i) => ({
      id: rowIds[i],
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
                        `SELECT b.person_id::text AS person_id, COUNT(*)::int AS count
               FROM case_interventions i
               JOIN cases c ON c.id = i.case_id
               JOIN beneficiaries b ON b.id = c.beneficiary_id
              WHERE b.person_id::text = ANY($1::text[])
              GROUP BY b.person_id`,
            [personIds],
          );
          const map: Record<string, number> = {};
          for (const r of rows) map[r.person_id] = Number(r.count);
          return map;
        },
      },
    });

    // --- Eligibility stage (intervention-aware serving, spec 2026-10-09) ---
    // Per-row evidence: best db_person match, household surfaced by a household
    // candidate, and every matched person id for the intervention queries.
    const candidatesByRow = new Map<string, typeof result.candidates>();
    for (const c of result.candidates) {
      const list = candidatesByRow.get(c.rowId) ?? [];
      list.push(c);
      candidatesByRow.set(c.rowId, list);
    }
    const perRowMatches = parsed.rows.map((r, i) => {
      const cands = candidatesByRow.get(rowIds[i]) ?? [];
      const personCands = cands.filter((c) => c.targetType === 'db_person' && c.targetPersonId);
      return [...personCands].sort((a, b) => b.score - a.score)[0]?.targetPersonId;
    });
    // The household connection comes from the DB, not the candidate cards:
    // households WITHOUT serving evidence surface no candidate, but the
    // eligibility engine still needs the grouping (same-household co-applying
    // in one list → exactly one gets through).
    const bestPersonIds = [...new Set(perRowMatches.filter(Boolean))] as string[];
    const rowHouseholds: Array<{ matchedPersonId: string; id: string; memberPersonIds: string[] }> =
      bestPersonIds.length
        ? await this.rowsRepo.manager.query(
            `SELECT hm.person_id::text AS "matchedPersonId", h.id,
                    (SELECT ARRAY_AGG(hm2.person_id::text)
                       FROM household_memberships hm2 WHERE hm2.household_id = h.id) AS "memberPersonIds"
               FROM households h
               JOIN household_memberships hm ON hm.household_id = h.id
              WHERE hm.person_id::text = ANY($1::text[])`,
            [bestPersonIds],
          )
        : [];
    const householdOf = new Map(rowHouseholds.map((h) => [h.matchedPersonId, h.id]));
    const membersOf = new Map(rowHouseholds.map((h) => [h.matchedPersonId, h.memberPersonIds]));
    const rowIndexByToken = new Map(rowInputs.map((ri) => [ri.id, ri.rowIndex]));
    const rowEvidence = parsed.rows.map((r, i) => {
      const cands = candidatesByRow.get(rowIds[i]) ?? [];
      const pairCand = cands.find((c) => c.targetType === 'import_row' && c.targetImportRowId);
      return {
        rowIndex: r.rowIndex,
        personId: perRowMatches[i],
        householdId: perRowMatches[i] ? householdOf.get(perRowMatches[i]) : undefined,
        householdPersonIds: perRowMatches[i] ? membersOf.get(perRowMatches[i]) ?? [] : [],
        // The intra-list pair shares the identity: the later row anchors to
        // the earlier one's group ("only one gets through").
        pairedRowIndex: pairCand ? rowIndexByToken.get(pairCand.targetImportRowId!) : undefined,
      };
    });
    const personIds = [...new Set(rowEvidence.flatMap((ev) => [ev.personId, ...ev.householdPersonIds].filter(Boolean)))];
    const interventionRows: any[] = personIds.length
      ? await this.rowsRepo.manager.query(
          `SELECT b.person_id::text AS person_id, to_char(i.delivery_date, 'YYYY-MM-DD') AS "deliveryDate", i.intervention_type AS type
             FROM case_interventions i JOIN beneficiaries b ON b.id = i.beneficiary_id
            WHERE i.beneficiary_id IS NOT NULL AND b.person_id::text = ANY($1::text[]) AND i.delivery_date IS NOT NULL
            UNION ALL
           SELECT b.person_id::text, to_char(i.delivery_date, 'YYYY-MM-DD'), i.intervention_type
             FROM case_interventions i
             JOIN cases c ON c.id = i.case_id
             JOIN beneficiaries b ON b.id = c.beneficiary_id
            WHERE i.beneficiary_id IS NULL AND b.person_id::text = ANY($1::text[]) AND i.delivery_date IS NOT NULL`,
          [personIds])
      : [];
    const interventionsByPerson: Record<string, { deliveryDate: string; type: string | null }[]> = {};
    for (const ir of interventionRows) {
      (interventionsByPerson[ir.person_id] ??= []).push({ deliveryDate: ir.deliveryDate, type: ir.type ?? null });
    }
    const eligibility = computeEligibility({
      today: new Date().toISOString().slice(0, 10),
      rows: rowEvidence,
      interventionsByPerson,
    });

    const rowEntities = parsed.rows.map((r, i) => {
      const cands = candidatesByRow.get(rowIds[i]) ?? [];
      const bestDBA = cands.some((c) => c.targetType === 'db_person');
      const elig = eligibility[r.rowIndex] ?? { eligibility: 'allowed' as const, code: 'new_client' as const, reason: '' };
      // Serving status: disqualified rows ARE deprioritized (not served,
      // pushed below the list; the reason rides in remarks); allowed rows merge
      // into the matched existing record (retained) or come through as new
      // clients. Disqualification stays reviewable until the operator decides
      // (eligibility_decision NULL blocks finalize).
      let status: ClientImportRow['status'];
      if (elig.eligibility === 'disqualified') status = 'deprioritized';
      else if (bestDBA) status = 'retained';
      else if (cands.length > 0) status = 'primary';
      else status = 'no_match';
      const best = [...cands].sort((a, b) => b.score - a.score)[0];
      // Persist the matched existing person NOW: with matches auto-resolved at
      // upload there is no decide() step later to set it, and finalize's
      // retained branch merges into this record (and records the batch
      // serving against its beneficiary).
      const bestPerson = [...cands].filter((c) => c.targetType === 'db_person').sort((a, b) => b.score - a.score)[0];
      return this.rowsRepo.create({
        id: rowIds[i],
        operationId: id,
        rowIndex: r.rowIndex,
        matchedPersonId: bestPerson?.targetPersonId,
        lastName: r.lastName,
        firstName: r.firstName,
        middleName: r.middleName,
        dob: r.dob,
        barangay: r.barangay,
        originalRemarks: r.originalRemarks,
        extraData: r.extraData,
        status,
        remarks: status === 'deprioritized' && elig.reason
          ? [r.originalRemarks, `Deprioritized — ${elig.reason}`].filter(Boolean).join(' | ') || undefined
          : undefined,
        score: best ? best.score : undefined,
        eligibility: elig.eligibility,
        eligibilityCode: elig.code,
        eligibilityReason: elig.reason || undefined,
      });
    });
    await this.rowsRepo.save(rowEntities);

    // BaseEntity's @BeforeInsert generates the id at save time, so the sweep's
    // token ids must be remapped onto the persisted row ids before matches can
    // reference them (row_id is a uuid FK to client_import_rows).
    const rowIdByToken = new Map(rowInputs.map((ri, i) => [ri.id, rowEntities[i].id]));
    // Allowed rows resolve immediately (matches are evidence). A DISQUALIFIED
    // row keeps its matches pending: every disqualified match requires the
    // operator's waive/confirm before finalize can run.
    const now = new Date();
    // Key on the PERSISTED row ids: @BeforeInsert rewrites the pre-generated
    // token ids at save time, and the engine's outcome axis is the ROW INDEX
    // (2-based), not the parsed-array position.
    const persistedIdByIndex = new Map(parsed.rows.map((r, i) => [r.rowIndex, rowEntities[i].id]));
    const disqualifiedRowIds = new Set(
      Object.entries(eligibility)
        .filter(([, e]) => e.eligibility === 'disqualified')
        .map(([idx]) => persistedIdByIndex.get(Number(idx)))
        .filter((v): v is string => Boolean(v)),
    );
    const matchEntities = result.candidates.map((c) => {
      const rowId = rowIdByToken.get(c.rowId) ?? c.rowId;
      const pending = disqualifiedRowIds.has(rowId);
      return this.matchesRepo.create({
        rowId,
        targetType: c.targetType,
        targetPersonId: c.targetPersonId,
        targetImportRowId: c.targetImportRowId ? rowIdByToken.get(c.targetImportRowId) : undefined,
        targetHouseholdId: c.targetHouseholdId,
        score: c.score,
        signals: c.signals as unknown as Record<string, unknown>,
        status: pending ? 'pending' : 'primary',
        ...(pending ? {} : { decidedBy: actorId, decidedAt: now }),
      });
    });
    if (matchEntities.length > 0) await this.matchesRepo.save(matchEntities);

    op.status = 'reviewing';
    await this.opsRepo.save(op);
    return { rows: rowEntities.length, matches: matchEntities.length };
  }

  /**
   * `CD-YYYY-MMM-NNN.xlsx` — the Manila month of finalization plus its rank among
   * that month's finalized runs. Derived from `finalized_at` (no counter table),
   * so a download reproduces the same name the finalize wrote.
   *
   * shortcut: two ops finalized in the same month by *different instances at
   * once* could compute the same rank; one process finalizes at a time, so the
   * window is theoretical. Upgrade to a per-month counter row if runs ever scale out.
   */
  private async priorityListName(at: Date, includeSelf: boolean): Promise<string> {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Manila', year: 'numeric', month: 'short',
    }).formatToParts(at);
    const year = parts.find((p) => p.type === 'year')?.value ?? '';
    const month = (parts.find((p) => p.type === 'month')?.value ?? '').toUpperCase();

    const rows: Array<{ n: number }> = await this.opsRepo.query(
      `SELECT COUNT(*)::int AS n
         FROM client_import_operations
        WHERE status = 'finalized' AND finalized_at IS NOT NULL
          AND date_trunc('month', finalized_at AT TIME ZONE 'Asia/Manila')
            = date_trunc('month', $1::timestamptz AT TIME ZONE 'Asia/Manila')
          AND finalized_at <= $1`,
      [at],
    );
    const rank = Math.max(1, Number(rows[0]?.n ?? 0) + (includeSelf ? 0 : 1));
    return `CD-${year}-${month}-${String(rank).padStart(3, '0')}.xlsx`;
  }

  /**
   * The finalized operation's priority list. The stored file wins; if this
   * container no longer has it (the finalize ran elsewhere, or the task was
   * replaced), the rows are still in the database, so the workbook is rebuilt
   * rather than 404ing. Ordering matches the writer, so both paths are identical.
   */
  async readPriorityList(operationId: string): Promise<{ buffer: Buffer; filename: string }> {
    const op = await this.opsRepo.findOne({ where: { id: operationId } });
    if (!op) throw new NotFoundException('Operation not found');
    if (!op.outputFile) throw new NotFoundException('This operation has not been finalized yet');

    // The canonical name is derived, not read from the path: a run finalized
    // before the naming rule (or whose file was written under another name) still
    // downloads as CD-YYYY-MMM-NNN.xlsx.
    const filename = await this.priorityListName(op.finalizedAt ?? op.createdAt ?? new Date(), true);

    const file = path.resolve(process.cwd(), op.outputFile);
    try {
      return { buffer: await fs.promises.readFile(file), filename };
    } catch {
      // Fall through: rebuild from the source of truth.
    }

    if (!this.outputWriter) throw new NotFoundException('The output file is missing and cannot be rebuilt');
    const rows = await this.rowsRepo.find({ where: { operationId }, order: { rowIndex: 'ASC' } });
    return { buffer: await this.outputWriter.build(op, rows), filename };
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
    // Review counts for the page's rows — the table shows pending/rows per run.
    const ids = data.map((op) => op.id);
    const counts: any[] = ids.length
      ? await this.rowsRepo.query(
          // An undecided disqualification blocks finalize exactly like a pending
          // match, so it counts as pending too — otherwise the list advertised
          // "0 pending" on a run whose finalize button was disabled.
          `SELECT operation_id::text AS operation_id,
                  CASE WHEN status = 'pending'
                            OR (eligibility = 'disqualified' AND eligibility_decision IS NULL)
                       THEN 'pending' ELSE status END AS status,
                  COUNT(*)::int AS count
             FROM client_import_rows
            WHERE operation_id::text = ANY($1::text[])
            GROUP BY 1, 2`,
          [ids],
        )
      : [];
    const byOperation = new Map<string, Record<string, number>>();
    for (const row of counts) {
      const bucket = byOperation.get(row.operation_id) ?? {};
      bucket[row.status] = Number(row.count);
      byOperation.set(row.operation_id, bucket);
    }
    return {
      data: data.map((op) => {
        const bucket = byOperation.get(op.id) ?? {};
        return {
          ...op,
          pending: bucket.pending ?? 0,
          noMatch: bucket.no_match ?? 0,
          decided: (bucket.retained ?? 0) + (bucket.primary ?? 0) + (bucket.deprioritized ?? 0),
          totalRows: Object.values(bucket).reduce((a, b) => a + b, 0),
        };
      }),
      total,
      page,
      limit,
    };
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
    const undecided: Array<{ n: number }> = await this.rowsRepo.query(
      `SELECT count(*)::int AS n FROM client_import_rows
        WHERE operation_id = $1 AND eligibility = 'disqualified' AND eligibility_decision IS NULL`,
      [id],
    );
    return {
      ...op,
      pending: byStatus.pending ?? 0,
      noMatch: byStatus.no_match ?? 0,
      disqualified: Number(undecided?.[0]?.n ?? 0),
      decided: (byStatus.retained ?? 0) + (byStatus.primary ?? 0) + (byStatus.deprioritized ?? 0),
      totalRows: Object.values(byStatus).reduce((a, b) => a + b, 0),
    };
  }

  /**
   * Queue the finalize and return immediately (HTTP 202): a whole-municipal-list
   * batch takes minutes, and holding the request open that long loses the
   * response while the work continues anyway.
   *
   * The review gates are checked HERE, synchronously, so the operator sees a
   * blocked row now instead of discovering it in the job log. The worker then
   * runs `finalize()` — one transaction, so a crash rolls the whole batch back
   * and the reclaimed job simply runs again.
   */
  async enqueueFinalize(operationId: string, actorId: string) {
    const op = await this.opsRepo.findOne({ where: { id: operationId } });
    if (!op) throw new NotFoundException('Operation not found');
    if (op.status !== 'reviewing') {
      throw new BadRequestException(`Operation is not in review (status: ${op.status})`);
    }
    await this.assertFinalizable(operationId);

    op.status = 'finalizing';
    op.accomplisher = actorId;
    op.finalizeStartedAt = null; // the worker stamps this when it claims the job
    op.finalizeError = null;
    op.finalizeSummary = null;
    await this.opsRepo.save(op);
    return { status: 'finalizing' as const };
  }

  /** The review gates: nothing pending, every disqualification decided. */
  private async assertFinalizable(operationId: string): Promise<void> {
    const pending: Array<{ id: string }> = await this.rowsRepo.query(
      `SELECT r.id FROM client_import_rows r
        WHERE r.operation_id = $1
          AND EXISTS (SELECT 1 FROM client_import_matches m
                       WHERE m.row_id = r.id AND m.status = 'pending')`,
      [operationId],
    );
    if (pending.length > 0) {
      throw new BadRequestException(`Cannot finalize: ${pending.length} match(es) are still pending`);
    }

    const undecided: Array<{ id: string }> = await this.rowsRepo.query(
      `SELECT id FROM client_import_rows
        WHERE operation_id = $1 AND eligibility = 'disqualified' AND eligibility_decision IS NULL`,
      [operationId],
    );
    if (undecided.length > 0) {
      throw new BadRequestException(`Cannot finalize: ${undecided.length} disqualified row(s) still need an eligibility decision`);
    }
  }

  /** The worker's record of a failed attempt: the operator can fix and retry. */
  async recordFinalizeFailure(operationId: string, error: unknown): Promise<void> {
    const message = error instanceof Error ? error.message : String(error);
    await this.opsRepo.query(
      `UPDATE client_import_operations
          SET status = 'reviewing', finalize_started_at = NULL, finalize_error = $2
        WHERE id = $1 AND status = 'finalizing'`,
      [operationId, message.slice(0, 2000)],
    );
  }

  /**
   * Finalize: refuses while anything is pending, then saves in ONE transaction —
   * new rows become persons + beneficiaries, retained rows update the existing
   * record (barangay changes recorded), deprioritized rows create nothing.
   * Idempotent by status: a finalized operation cannot be finalized again, and a
   * failure anywhere rolls the whole save back with the status untouched.
   *
   * Called by the worker against a claimed (`finalizing`) operation; accepts
   * `reviewing` too so it can still be run synchronously in tests and by hand.
   */
  async finalize(operationId: string, actorId: string | null) {
    const op = await this.opsRepo.findOne({ where: { id: operationId } });
    if (!op) throw new NotFoundException('Operation not found');
    if (op.status !== 'reviewing' && op.status !== 'finalizing') {
      throw new BadRequestException(`Operation is not in review (status: ${op.status})`);
    }
    await this.assertFinalizable(operationId);

    const rows = await this.rowsRepo.find({ where: { operationId }, order: { rowIndex: 'ASC' } });
    const result = { created: 0, updated: 0, deprioritized: 0, barangayUpdates: 0 };

    // Every write below goes through the transaction's manager. Using the
    // injected repositories here (as this used to) meant the "transaction" was a
    // no-op wrapper: a failure half-way left the earlier rows committed, so a
    // retried batch duplicated them.
    await this.rowsRepo.manager.transaction(async (em: EntityManager) => {
      const rowsRepo = em.getRepository(ClientImportRow);
      const personRepo = em.getRepository(Person);
      const beneficiaryRepo = em.getRepository(Beneficiary);
      const addressRepo = em.getRepository(PersonAddress);
      for (const row of rows) {
        // A `retained` row with no matched person is a row whose claim was
        // severed ("not the same person") and never re-pointed: treat it as a
        // new client rather than skipping it — the old `continue` below made it
        // vanish from the batch while the priority list still printed "Updated".
        const retainedWithPerson = row.status === 'retained' && !!row.matchedPersonId;
        if (row.status === 'no_match' || row.status === 'primary' || (row.status === 'retained' && !row.matchedPersonId)) {
          // Gender is optional in the schema and usually absent from an import;
          // the person is created without it (own insert, not createBeneficiary).
          const person: any = personRepo.create({
            surname: row.lastName,
            firstName: row.firstName,
            middleName: row.middleName ?? undefined,
            dob: row.dob ? new Date(row.dob) : undefined,
            gender: undefined,
          } as any);
          person.addresses = [
            addressRepo.create({
              addressType: 'current',
              barangay: row.barangay,
              raw: row.barangay,
              isPrimary: true,
            } as any),
          ];
          const savedPerson: any = await personRepo.save(person);
          const savedBen: any = await beneficiaryRepo.save(
            beneficiaryRepo.create({ personId: savedPerson.id } as any),
          );
          // A new record gets its own household (the person as primary member)
          // so future lists can see the household grouping.
          const hhRows: Array<{ id: string }> = await em.query(
            `INSERT INTO households (id, barangay) VALUES (uuid_generate_v7(), $1) RETURNING id`,
            [row.barangay ?? null],
          );
          await em.query(
            `INSERT INTO household_memberships (id, person_id, household_id, relationship, is_primary)
             VALUES (uuid_generate_v7(), $1, $2, 'Self', true)`,
            [savedPerson.id, hhRows[0].id],
          );
          row.matchedPersonId = savedPerson.id;
          row.beneficiaryId = savedBen.id;
          await rowsRepo.save(row);
          await this.recordRemark(savedBen.id, operationId, 'import', row.originalRemarks ?? 'Imported client', op.source, actorId, em);
          await this.recordBatchServing(savedBen.id, op, actorId, em);
          result.created++;
        } else if (retainedWithPerson) {
          const person = await personRepo.findOne({ where: { id: row.matchedPersonId as string }, relations: ['addresses'] });
          if (!person) continue;
          if (row.lastName) (person as any).surname = row.lastName;
          if (row.firstName) (person as any).firstName = row.firstName;
          if (row.middleName) (person as any).middleName = row.middleName;
          const benRows: Array<{ id: string }> = await rowsRepo.query(
            'SELECT id FROM beneficiaries WHERE person_id = $1 LIMIT 1',
            [row.matchedPersonId],
          );
          const beneficiaryId = benRows?.[0]?.id;
          if (row.barangay) {
            const addresses = ((person as any).addresses ?? []) as Array<any>;
            const current = addresses.find((a) => a.addressType === 'current');
            if (!current || (current.barangay ?? '') !== row.barangay) {
              if (current) {
                current.barangay = row.barangay;
                current.raw = row.barangay;
                await addressRepo.save(current);
              } else {
                await addressRepo.save(addressRepo.create({
                  personId: person.id,
                  addressType: 'current',
                  barangay: row.barangay,
                  raw: row.barangay,
                  isPrimary: true,
                } as any));
              }
              result.barangayUpdates++;
              row.remarks = [row.originalRemarks, `Barangay updated to ${row.barangay}`]
                .filter(Boolean).join(' | ');
              if (beneficiaryId) {
                await this.recordRemark(
                  beneficiaryId,
                  operationId,
                  'barangay_update',
                  `Barangay updated to ${row.barangay} from import`,
                  op.source,
                  actorId,
                  em,
                );
              }
            }
          }
          await personRepo.save(person);
          if (beneficiaryId) {
            row.beneficiaryId = beneficiaryId;
            await this.recordBatchServing(beneficiaryId, op, actorId, em);
          }
          await rowsRepo.save(row);
          result.updated++;
        } else {
          // deprioritized (legacy duplicates and confirmed disqualifications):
          // nothing is created; the reason rides in remarks.
          result.deprioritized++;
        }
      }

      // Already recorded when the job was queued; a job queued without an
      // actor keeps whatever the enqueue stamped.
      if (actorId) op.accomplisher = actorId;
      op.finalizedAt = new Date();
      op.status = 'finalized';
      op.finalizeStartedAt = null;
      op.finalizeError = null;
      // Persisted, not just returned: the request that queued the job is long
      // gone by the time this runs, and the review screen polls for it.
      op.finalizeSummary = result;
      // The export's own name (CD-YYYY-MMM-NNN.xlsx); the writer uses it for the
      // file and the download serves the same one.
      op.outputName = await this.priorityListName(op.finalizedAt, false);
      if (this.outputWriter) op.outputFile = await this.outputWriter.write(op, rows as ClientImportRow[]);
      await em.getRepository(ClientImportOperation).save(op);
    });

    return result;
  }

  /**
   * Operator review of a disqualified row: 'waive' serves it after all
   * (flipping the row into its serving status), 'confirm' keeps it out.
   * Finalize stays blocked until every disqualified row is decided.
   */
  async decideEligibility(
    operationId: string,
    rowId: string,
    decision: 'waive' | 'confirm',
    actorId: string,
    matchId?: string,
  ) {
    const op = await this.opsRepo.findOne({ where: { id: operationId } });
    if (!op) throw new NotFoundException('Operation not found');
    if (op.status !== 'reviewing') throw new BadRequestException('Operation is not in review');
    const row = await this.rowsRepo.findOne({ where: { id: rowId, operationId } });
    if (!row) throw new NotFoundException('Row not found');
    if (row.eligibility !== 'disqualified') {
      throw new BadRequestException('Only disqualified rows need an eligibility decision');
    }
    // An in-list duplicate is not an eligibility question: "serve anyway" here
    // would create the second record the operation exists to prevent. The pair
    // decision ("keep this row" / "keep the other one") is the only resolution.
    if (row.eligibilityCode === 'intra_list' && decision === 'waive') {
      throw new BadRequestException(
        'This row duplicates another row in the same list — decide which one to keep instead of waiving it.',
      );
    }

    // Every disqualified MATCH requires the decision: with a matchId, decide
    // just that match; without one, decide them all at once (the aggregate
    // action on the row's panel).
    const decideMatch = async (m: ClientImportMatch) => {
      m.status = decision === 'waive' ? 'primary' : 'deprioritized';
      m.decidedBy = actorId;
      m.decidedAt = new Date();
      await this.matchesRepo.save(m);
    };
    if (matchId) {
      const match = await this.matchesRepo.findOne({ where: { id: matchId, rowId } });
      if (!match) throw new NotFoundException('Match not found');
      await decideMatch(match);
    } else {
      const matches = await this.matchesRepo.find({ where: { rowId } });
      for (const m of matches) await decideMatch(m);
    }

    const remaining = await this.matchesRepo.find({ where: { rowId, status: 'pending' } });
    if (remaining.length === 0) {
      // The whole row is decided: any waived match means it is served.
      const decided = await this.matchesRepo.find({ where: { rowId } });
      const served = decided.some((m) => m.status === 'primary');
      row.eligibilityDecision = decision;
      row.eligibilityDecidedBy = actorId;
      row.eligibilityDecidedAt = new Date();
      row.status = served
        ? decided.some((m) => m.targetType === 'db_person')
          ? 'retained'
          : 'primary'
        : 'deprioritized';
      await this.rowsRepo.save(row);
    }
    return { row, remaining: remaining.length };
  }

  /** Records the batch serving as a case_intervention (eligibility evidence). */
  private async recordBatchServing(
    beneficiaryId: string,
    op: ClientImportOperation,
    actorId: string | null,
    em: EntityManager,
  ) {
    await em.query(
      `INSERT INTO case_interventions
         (id, case_id, beneficiary_id, service_name, intervention_type, delivery_date, source, created_by)
       VALUES (uuid_generate_v7(), NULL, $1, $2, $3, CURRENT_DATE, 'batch', $4)`,
      [beneficiaryId, op.interventionType || 'Batch service', op.interventionType || null, actorId],
    );
  }

  /** Review pagination (spec §5): rows with filters, oldest row first.
   *
   * `phase` splits the two review stages: `intra_list` — rows that matched
   * another row of the same import (decide which one to keep) — and `db_match`
   * — rows that matched a person or household in KAPWA. Rows can appear in
   * both; `filter` narrows within whichever phase is selected.
   */
  async rows(operationId: string, page = 1, limit = 20, status?: string, search?: string, filter?: string, phase?: string) {
    const qb = this.rowsRepo.createQueryBuilder('r').where('r.operation_id = :operationId', { operationId });
    if (status === 'pending' || status === 'no_match' || status === 'deprioritized' || status === 'retained' || status === 'primary') {
      qb.andWhere('r.status = :status', { status });
    }
    // Review filter: 'matched' = rows carrying at least one candidate
    // (anything but no_match); 'disqualified' = undecided disqualifications.
    if (filter === 'matched') {
      qb.andWhere('r.status != :notMatched', { notMatched: 'no_match' });
    } else if (filter === 'no_match') {
      qb.andWhere('r.status = :notMatched', { notMatched: 'no_match' });
    } else if (filter === 'disqualified') {
      qb.andWhere('r.eligibility = :dis', { dis: 'disqualified' }).andWhere('r.eligibility_decision IS NULL');
    }
    if (phase === 'intra_list') {
      qb.andWhere(`EXISTS (SELECT 1 FROM client_import_matches m WHERE m.row_id = r.id AND m.target_type = 'import_row')`);
    } else if (phase === 'db_match') {
      qb.andWhere(`EXISTS (SELECT 1 FROM client_import_matches m WHERE m.row_id = r.id AND m.target_type IN ('db_person', 'household'))`);
    }
    if (search) qb.andWhere('r.last_name ILIKE :search', { search: `%${search}%` });
    const [data, total] = await qb
      .orderBy('r.row_index', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return { data, total, page, limit };
  }

  /**
   * A row's candidate matches, enriched for the review cards: person targets
   * carry their case list, household targets their members and received
   * interventions (the `householdServed` evidence), import-row targets the
   * paired row's identity.
   */
  async rowMatches(operationId: string, rowId: string, page = 1, limit = 20) {
    const row = await this.rowsRepo.findOne({ where: { id: rowId, operationId } });
    if (!row) throw new NotFoundException('Row not found');
    const [matches, total] = await this.matchesRepo.findAndCount({
      where: { rowId },
      order: { score: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const personIds = matches.map((m) => m.targetPersonId).filter(Boolean) as string[];
    const householdIds = matches.map((m) => m.targetHouseholdId).filter(Boolean) as string[];
    const importRowIds = matches.map((m) => m.targetImportRowId).filter(Boolean) as string[];

    const households: any[] = householdIds.length
      ? await this.rowsRepo.query(
          `SELECT h.id, ARRAY_AGG(hm.person_id::text) AS "memberPersonIds"
             FROM households h JOIN household_memberships hm ON hm.household_id = h.id
            WHERE h.id::text = ANY($1::text[]) GROUP BY h.id`, [householdIds])
      : [];
    const memberIds = [...new Set(households.flatMap((h) => h.memberPersonIds ?? []))] as string[];
    // Names/cases/interventions are needed for both the person targets and the
    // household members shown on the household card.
    const identities = [...new Set([...personIds, ...memberIds])];

    const people: any[] = identities.length
      ? await this.rowsRepo.query(
          `SELECT p.id, p.surname AS "lastName", p.first_name AS "firstName", p.middle_name AS "middleName",
                  to_char(p.dob, 'YYYY-MM-DD') AS dob,
                  (SELECT a.barangay FROM person_addresses a WHERE a.person_id = p.id AND a.address_type = 'current'
                    ORDER BY a.is_primary DESC NULLS LAST LIMIT 1) AS barangay
             FROM persons p WHERE p.id::text = ANY($1::text[])`, [identities])
      : [];
    const cases: any[] = identities.length
      ? await this.rowsRepo.query(
          `SELECT b.person_id::text AS person_id, c.control_no AS "controlNo", c.status
             FROM beneficiaries b JOIN cases c ON c.beneficiary_id = b.id
            WHERE b.person_id::text = ANY($1::text[]) ORDER BY c.created_at DESC`, [identities])
      : [];
    const interventions: any[] = identities.length
      ? await this.rowsRepo.query(
          `SELECT b.person_id::text AS person_id, COUNT(*)::int AS count,
                  MAX(i.delivery_date)::text AS last_delivery
             FROM case_interventions i
             JOIN cases c ON c.id = i.case_id
             JOIN beneficiaries b ON b.id = c.beneficiary_id
            WHERE b.person_id::text = ANY($1::text[]) GROUP BY b.person_id`, [identities])
      : [];
    const importRows: any[] = importRowIds.length
      ? await this.rowsRepo.query(
          `SELECT id, row_index AS "rowIndex", last_name AS "lastName", first_name AS "firstName", dob, barangay
             FROM client_import_rows WHERE id::text = ANY($1::text[])`, [importRowIds])
      : [];
    // Recent remark history (≤5, newest first) for each person-targeted
    // candidate — the reviewer sees the existing record's provenance while
    // deciding whether it is the same person.
    const recentRemarks: any[] = personIds.length
      ? await this.rowsRepo.query(
          `WITH ranked AS (
             SELECT b.person_id::text AS person_id,
                    br.kind, br.remark, br.source,
                    br.created_at AS "createdAt",
                    NULLIF(TRIM(CONCAT_WS(' ', u.first_name, NULLIF(u.middle_name, ''), u.last_name)), '') AS "authorName",
                    ROW_NUMBER() OVER (PARTITION BY br.beneficiary_id ORDER BY br.created_at DESC) AS rn
               FROM beneficiary_remarks br
               JOIN beneficiaries b ON b.id = br.beneficiary_id
               LEFT JOIN users u ON u.id = br.authored_by
              WHERE b.person_id::text = ANY($1::text[])
           )
           SELECT person_id, kind, remark, source, "createdAt", "authorName"
             FROM ranked WHERE rn <= 5 ORDER BY person_id, rn`,
          [personIds])
      : [];
    const remarksByPerson = new Map<string, any[]>();
    for (const r of recentRemarks) {
      const list = remarksByPerson.get(r.person_id) ?? [];
      list.push({
        kind: r.kind,
        remark: r.remark,
        source: r.source ?? null,
        authorName: r.authorName ?? null,
        createdAt: r.createdAt,
      });
      remarksByPerson.set(r.person_id, list);
    }

    const interventionBy = new Map(interventions.map((i) => [i.person_id, Number(i.count)]));
    const lastDeliveryBy = new Map(interventions.map((i) => [i.person_id, i.last_delivery ?? null]));
    const memberName = (mid: string) => {
      const p = people.find((row) => row.id === mid);
      return p ? { lastName: p.lastName, firstName: p.firstName } : {};
    };
    const data = matches.map((m) => ({
      ...m,
      person: people.find((p) => p.id === m.targetPersonId) ?? null,
      remarks: remarksByPerson.get(m.targetPersonId as string) ?? [],
      interventions: interventionBy.get(m.targetPersonId as string) ?? 0,
      lastDeliveryDate: lastDeliveryBy.get(m.targetPersonId as string) ?? null,
      cases: cases.filter((c) => c.person_id === m.targetPersonId),
      household: households.find((h) => h.id === m.targetHouseholdId)
        ? {
            id: m.targetHouseholdId,
            memberPersonIds: households.find((h) => h.id === m.targetHouseholdId).memberPersonIds,
            members: households
              .find((h) => h.id === m.targetHouseholdId)
              .memberPersonIds.map((mid: string) => ({
                personId: mid,
                ...memberName(mid),
                interventions: interventionBy.get(mid) ?? 0,
                lastDeliveryDate: lastDeliveryBy.get(mid) ?? null,
                cases: cases.filter((c) => c.person_id === mid),
              })),
          }
        : null,
      pairedRow: importRows.find((r) => r.id === m.targetImportRowId) ?? null,
    }));
    return { data, total, page, limit };
  }
}
