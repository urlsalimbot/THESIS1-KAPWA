import { Injectable, Optional, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientImportOperation, ClientImportRow, ClientImportMatch, BeneficiaryRemark } from './dedup.entity';
import { parseImportFile, ColumnMap, ColumnMapError } from './dedup-parse.service';
import { sweep, RowInput } from './dedup-match-sweep.service';
import { DedupAdapter } from './dedup-adapter';
import { ILike } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';

export const DEDUP_ADAPTER = 'DEDUP_ADAPTER';
import { Person } from '../beneficiaries/person.entity';
import { Beneficiary } from '../beneficiaries/beneficiary.entity';
import { PersonAddress } from '../beneficiaries/person-address.entity';
import { BeneficiaryRemarksService } from './beneficiary-remarks.service';

/** Writes the stored priority-list Excel (Task 8 supplies the implementation). */
export interface DedupOutputWriter {
  write(op: ClientImportOperation, rows: ClientImportRow[]): Promise<string>;
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
    authoredBy: string,
  ): Promise<void> {
    if (!this.remarksService) return;
    await this.remarksService.append({ beneficiaryId, operationId, kind, remark, source, authoredBy });
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
    if (body.keep !== 'import_row' && match.targetPersonId && this.remarksService) {
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
               JOIN cases c ON c.id::text = i.case_id
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

    const rowEntities = parsed.rows.map((r, i) => {
      const status = result.rowStatus[rowIds[i]] ?? 'pending';
      const best = result.candidates.filter((c) => c.rowId === rowIds[i]).sort((a, b) => b.score - a.score)[0];
      return this.rowsRepo.create({
        id: rowIds[i],
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

    // BaseEntity's @BeforeInsert generates the id at save time, so the sweep's
    // token ids must be remapped onto the persisted row ids before matches can
    // reference them (row_id is a uuid FK to client_import_rows).
    const rowIdByToken = new Map(rowInputs.map((ri, i) => [ri.id, rowEntities[i].id]));
    const matchEntities = result.candidates.map((c) =>
      this.matchesRepo.create({
        rowId: rowIdByToken.get(c.rowId) ?? c.rowId,
        targetType: c.targetType,
        targetPersonId: c.targetPersonId,
        targetImportRowId: c.targetImportRowId ? rowIdByToken.get(c.targetImportRowId) : undefined,
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
    // Review counts for the page's rows — the table shows pending/rows per run.
    const ids = data.map((op) => op.id);
    const counts: any[] = ids.length
      ? await this.rowsRepo.query(
          `SELECT operation_id::text AS operation_id, status, COUNT(*)::int AS count
             FROM client_import_rows
            WHERE operation_id::text = ANY($1::text[])
            GROUP BY operation_id, status`,
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
    return {
      ...op,
      pending: byStatus.pending ?? 0,
      noMatch: byStatus.no_match ?? 0,
      decided: (byStatus.retained ?? 0) + (byStatus.primary ?? 0) + (byStatus.deprioritized ?? 0),
      totalRows: Object.values(byStatus).reduce((a, b) => a + b, 0),
    };
  }

  /**
   * Finalize: refuses while anything is pending, then saves in ONE transaction —
   * new rows become persons + beneficiaries, retained rows update the existing
   * record (barangay changes recorded), deprioritized rows create nothing.
   * Idempotent by status: a finalized operation cannot be finalized again, and a
   * failure anywhere rolls the whole save back with the status untouched.
   */
  async finalize(operationId: string, actorId: string) {
    const op = await this.opsRepo.findOne({ where: { id: operationId } });
    if (!op) throw new NotFoundException('Operation not found');
    if (op.status !== 'reviewing') {
      throw new BadRequestException(`Operation is not in review (status: ${op.status})`);
    }

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

    const rows = await this.rowsRepo.find({ where: { operationId }, order: { rowIndex: 'ASC' } });
    const result = { created: 0, updated: 0, deprioritized: 0, barangayUpdates: 0 };

    await this.rowsRepo.manager.transaction(async () => {
      for (const row of rows) {
        if (row.status === 'no_match' || row.status === 'primary') {
          // Gender is optional in the schema and usually absent from an import;
          // the person is created without it (own insert, not createBeneficiary).
          const person: any = this.personRepo!.create({
            surname: row.lastName,
            firstName: row.firstName,
            middleName: row.middleName ?? undefined,
            dob: row.dob ? new Date(row.dob) : undefined,
            gender: undefined,
          } as any);
          person.addresses = [
            this.addressRepo!.create({
              addressType: 'current',
              barangay: row.barangay,
              raw: row.barangay,
              isPrimary: true,
            } as any),
          ];
          const savedPerson: any = await this.personRepo!.save(person);
          const savedBen: any = await this.beneficiaryRepo!.save(
            this.beneficiaryRepo!.create({ personId: savedPerson.id } as any),
          );
          row.matchedPersonId = savedPerson.id;
          row.beneficiaryId = savedBen.id;
          await this.rowsRepo.save(row);
          await this.recordRemark(savedBen.id, operationId, 'import', row.originalRemarks ?? 'Imported client', op.source, actorId);
          result.created++;
        } else if (row.status === 'retained') {
          const person = await this.personRepo!.findOne({ where: { id: row.matchedPersonId }, relations: ['addresses'] });
          if (!person) continue;
          if (row.lastName) (person as any).surname = row.lastName;
          if (row.firstName) (person as any).firstName = row.firstName;
          if (row.middleName) (person as any).middleName = row.middleName;
          const benRows: Array<{ id: string }> = await this.rowsRepo.query(
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
                await this.addressRepo!.save(current);
              } else {
                await this.addressRepo!.save(this.addressRepo!.create({
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
                );
              }
            }
          }
          await this.personRepo!.save(person);
          if (beneficiaryId) row.beneficiaryId = beneficiaryId;
          await this.rowsRepo.save(row);
          result.updated++;
        } else {
          // deprioritized: nothing is created; the decision remark was recorded
          // against the surviving record in Task 6.
          result.deprioritized++;
        }
      }

      op.accomplisher = actorId;
      op.finalizedAt = new Date();
      op.status = 'finalized';
      if (this.outputWriter) op.outputFile = await this.outputWriter.write(op, rows as ClientImportRow[]);
      await this.opsRepo.save(op);
    });

    return result;
  }

  /** Review pagination (spec §5): rows with filters, newest first by row index. */
  async rows(operationId: string, page = 1, limit = 20, status?: string, search?: string) {
    const where: Record<string, unknown> = { operationId };
    if (status === 'pending' || status === 'no_match' || status === 'deprioritized' || status === 'retained' || status === 'primary') {
      where.status = status;
    }
    if (search) where.lastName = ILike(`%${search}%`);
    const [data, total] = await this.rowsRepo.findAndCount({
      where,
      order: { rowIndex: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
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
          `SELECT b.person_id::text AS person_id, COUNT(*)::int AS count
             FROM case_interventions i
             JOIN cases c ON c.id::text = i.case_id
             JOIN beneficiaries b ON b.id = c.beneficiary_id
            WHERE b.person_id::text = ANY($1::text[]) GROUP BY b.person_id`, [identities])
      : [];
    const importRows: any[] = importRowIds.length
      ? await this.rowsRepo.query(
          `SELECT id, row_index AS "rowIndex", last_name AS "lastName", first_name AS "firstName", dob, barangay
             FROM client_import_rows WHERE id::text = ANY($1::text[])`, [importRowIds])
      : [];

    const interventionBy = new Map(interventions.map((i) => [i.person_id, Number(i.count)]));
    const memberName = (mid: string) => {
      const p = people.find((row) => row.id === mid);
      return p ? { lastName: p.lastName, firstName: p.firstName } : {};
    };
    const data = matches.map((m) => ({
      ...m,
      person: people.find((p) => p.id === m.targetPersonId) ?? null,
      interventions: interventionBy.get(m.targetPersonId as string) ?? 0,
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
                cases: cases.filter((c) => c.person_id === mid),
              })),
          }
        : null,
      pairedRow: importRows.find((r) => r.id === m.targetImportRowId) ?? null,
    }));
    return { data, total, page, limit };
  }
}
