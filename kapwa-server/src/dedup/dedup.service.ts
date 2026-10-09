import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientImportOperation, ClientImportRow, ClientImportMatch } from './dedup.entity';
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
  ) {}

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