import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WalkInLog } from './walk-in-log.entity';
import { CreateWalkInLogInput, UpdateWalkInLogInput } from './walk-in-logs.zod';

const TERMINAL = new Set(['completed', 'referred', 'incomplete', 'no_service']);
const MANILA = 'Asia/Manila';

function dateKey(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: MANILA }).format(d);
}
function monthKey(d: Date): string {
  return dateKey(d).slice(0, 7);
}
function minutesBetween(from: Date, to: Date): number {
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 60000));
}
function ageBand(dob?: string | null): string | null {
  if (!dob) return null;
  const born = new Date(`${dob}T00:00:00Z`);
  if (Number.isNaN(born.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - born.getUTCFullYear();
  const beforeBirthday = now.getUTCMonth() < born.getUTCMonth()
    || (now.getUTCMonth() === born.getUTCMonth() && now.getUTCDate() < born.getUTCDate());
  if (beforeBirthday) age--;
  if (age < 18) return '0-17';
  if (age < 60) return '18-59';
  return '60+';
}
function fullName(row: WalkInLog): string {
  return [row.firstName, row.middleName, row.lastName, row.extension].filter(Boolean).join(' ').trim();
}
function countBy<T>(rows: T[], key: (row: T) => string | null | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of rows) {
    const k = key(row);
    if (!k) continue;
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

@Injectable()
export class WalkInLogsService {
  constructor(
    @InjectRepository(WalkInLog)
    private readonly repo: Repository<WalkInLog>,
  ) {}

  private serialize(row: WalkInLog) {
    const now = new Date();
    const waitEnd = row.serviceStartedAt ?? row.completedAt ?? now;
    return {
      ...row,
      clientName: fullName(row),
      waitingMinutes: minutesBetween(row.timeIn ?? row.visitedAt ?? now, waitEnd),
      serviceMinutes: row.serviceStartedAt && row.completedAt
        ? minutesBetween(row.serviceStartedAt, row.completedAt)
        : null,
    };
  }

  private async nextQueueNo(visitedAt: Date): Promise<number> {
    const day = dateKey(visitedAt);
    const rows = await this.repo.query(
      `SELECT COALESCE(MAX(queue_no), 0) + 1 AS next
         FROM walk_in_logs
        WHERE (visited_at AT TIME ZONE 'Asia/Manila')::date = $1::date`,
      [day],
    );
    return Number(rows?.[0]?.next ?? 1);
  }

  async create(data: CreateWalkInLogInput, callerId?: string): Promise<any> {
    const visitedAt = data.visitedAt ? new Date(data.visitedAt) : new Date();
    const queueNo = await this.nextQueueNo(visitedAt);
    const row = this.repo.create({
      visitedAt,
      queueNo,
      firstName: data.firstName ?? null,
      middleName: data.middleName ?? null,
      lastName: data.lastName ?? null,
      extension: data.extension ?? null,
      personId: data.personId ?? null,
      caseId: data.caseId ?? null,
      pendingIntakeId: data.pendingIntakeId ?? null,
      referralId: data.referralId ?? null,
      barangay: data.barangay ?? null,
      sex: data.sex ?? null,
      dateOfBirth: data.dateOfBirth ?? null,
      ageBand: ageBand(data.dateOfBirth),
      contactNumber: data.contactNumber ?? null,
      purposeCode: data.purposeCode,
      purposeText: data.purposeText ?? null,
      isNewClient: data.isNewClient ?? null,
      status: 'waiting',
      assignedTo: data.assignedToId ?? callerId ?? null,
      outcome: data.outcome ?? null,
      outcomeNotes: data.outcomeNotes ?? null,
      timeIn: visitedAt,
      createdBy: callerId ?? null,
    });
    return this.serialize(await this.repo.save(row));
  }

  async update(id: string, data: UpdateWalkInLogInput): Promise<any> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Walk-in log not found');
    const nextStatus = data.status;
    if (data.visitedAt !== undefined) {
      row.visitedAt = new Date(data.visitedAt);
      row.timeIn = row.visitedAt;
    }
    for (const key of ['firstName', 'middleName', 'lastName', 'extension', 'personId', 'caseId', 'pendingIntakeId', 'referralId', 'barangay', 'sex', 'dateOfBirth', 'contactNumber', 'purposeCode', 'purposeText', 'isNewClient', 'assignedToId', 'outcome', 'outcomeNotes'] as const) {
      if (data[key] !== undefined) {
        (row as any)[key === 'assignedToId' ? 'assignedTo' : key] = data[key] ?? null;
      }
    }
    if (data.dateOfBirth !== undefined) row.ageBand = ageBand(data.dateOfBirth);
    if (nextStatus) {
      row.status = nextStatus;
      if (nextStatus === 'in_service') {
        row.serviceStartedAt = row.serviceStartedAt ?? new Date();
        row.completedAt = null;
      } else if (TERMINAL.has(nextStatus)) {
        row.completedAt = row.completedAt ?? new Date();
      } else if (nextStatus === 'waiting') {
        row.serviceStartedAt = null;
        row.completedAt = null;
      }
    }
    return this.serialize(await this.repo.save(row));
  }

  async list(page = 1, limit = 20, filters: { date?: string; status?: string; purposeCode?: string; q?: string }) {
    const qb = this.repo.createQueryBuilder('w')
      .orderBy('w.visitedAt', 'DESC')
      .addOrderBy('w.queueNo', 'DESC');
    if (filters.date) qb.andWhere(`(w.visitedAt AT TIME ZONE 'Asia/Manila')::date = :date`, { date: filters.date });
    if (filters.status) qb.andWhere('w.status = :status', { status: filters.status });
    if (filters.purposeCode) qb.andWhere('w.purposeCode = :purposeCode', { purposeCode: filters.purposeCode });
    if (filters.q?.trim()) {
      qb.andWhere(`(COALESCE(w.firstName,'') || ' ' || COALESCE(w.middleName,'') || ' ' || COALESCE(w.lastName,'') ILIKE :q
        OR COALESCE(w.purposeText,'') ILIKE :q OR COALESCE(w.contactNumber,'') ILIKE :q)`, { q: `%${filters.q.trim()}%` });
    }
    const [rows, total] = await qb.skip((page - 1) * limit).take(limit).getManyAndCount();
    return { data: rows.map((r) => this.serialize(r)), total, page, limit };
  }

  async linkOptions(q: string) {
    if (!q || q.trim().length < 2) return [];
    const term = `%${q.trim()}%`;
    const rows = await this.repo.query(
      `SELECT p.id AS "personId", p.surname AS "lastName", p.first_name AS "firstName",
              p.middle_name AS "middleName", p.extension, p.gender AS sex,
              to_char(p.dob, 'YYYY-MM-DD') AS dob,
              (SELECT a.barangay FROM person_addresses a
                WHERE a.person_id = p.id AND a.address_type = 'current'
                ORDER BY a.is_primary DESC NULLS LAST LIMIT 1) AS barangay,
              c.id AS "caseId", c.control_no AS "controlNo"
         FROM persons p
         LEFT JOIN LATERAL (
           SELECT c.id, c.control_no FROM beneficiaries b JOIN cases c ON c.beneficiary_id = b.id
            WHERE b.person_id = p.id ORDER BY c.created_at DESC LIMIT 1
         ) c ON true
        WHERE p.surname ILIKE $1 OR p.first_name ILIKE $1
           OR EXISTS (SELECT 1 FROM person_contacts pc WHERE pc.person_id = p.id AND pc.value ILIKE $1)
        ORDER BY p.surname, p.first_name LIMIT 10`,
      [term],
    );
    return rows;
  }

  async referralsForCase(caseId: string) {
    return this.repo.query(
      `SELECT r.id, r.reason, r.created_at AS "createdAt", a.name AS "agencyName"
         FROM inter_agency_referrals r
         LEFT JOIN agencies a ON a.id = r.to_agency_id
        WHERE r.case_id = $1 ORDER BY r.created_at DESC`,
      [caseId],
    );
  }

  async summary(from?: string, to?: string) {
    const today = dateKey(new Date());
    const startDate = from ?? `${today.slice(0, 7)}-01`;
    const endDate = to ?? today;
    const start = new Date(`${startDate}T00:00:00+08:00`);
    const end = new Date(`${endDate}T23:59:59.999+08:00`);
    const rows = await this.repo.createQueryBuilder('w')
      .where('w.visitedAt BETWEEN :start AND :end', { start, end })
      .orderBy('w.visitedAt', 'ASC')
      .getMany();
    const data = rows.map((r) => this.serialize(r));
    const completed = data.filter((r) => r.completedAt);
    const waits = completed.map((r) => r.waitingMinutes).filter((n): n is number => n != null);
    const services = completed.map((r) => r.serviceMinutes).filter((n): n is number => n != null);
    const referralIds = [...new Set(data.map((r) => r.referralId).filter(Boolean))] as string[];
    const referralRows: any[] = referralIds.length
      ? await this.repo.query(
          `SELECT r.id, r.reason, a.name AS "agencyName"
             FROM inter_agency_referrals r LEFT JOIN agencies a ON a.id = r.to_agency_id
            WHERE r.id::text = ANY($1::text[])`, [referralIds])
      : [];
    const daily = countBy(data, (r) => dateKey(new Date(r.visitedAt)));
    const monthly = countBy(data, (r) => monthKey(new Date(r.visitedAt)));
    const conversion = data.filter((r) => r.caseId).length;
    const pendingConversions = data.filter((r) => r.pendingIntakeId).length;
    return {
      range: { from: startDate, to: endDate },
      visits: data.length,
      statuses: countBy(data, (r) => r.status),
      purposes: countBy(data, (r) => r.purposeCode),
      barangays: countBy(data, (r) => r.barangay),
      sex: countBy(data, (r) => r.sex),
      ageBands: countBy(data, (r) => r.ageBand),
      outcomes: countBy(data, (r) => r.outcome),
      newClients: data.filter((r) => r.isNewClient === true).length,
      returningClients: data.filter((r) => r.isNewClient === false).length,
      conversions: { toCase: conversion, toPendingIntake: pendingConversions, rate: data.length ? Math.round((conversion / data.length) * 100) : 0 },
      waitingMinutes: waits.length ? Math.round(waits.reduce((a, b) => a + b, 0) / waits.length) : 0,
      serviceMinutes: services.length ? Math.round(services.reduce((a, b) => a + b, 0) / services.length) : 0,
      referrals: referralRows.map((r) => ({ id: r.id, agencyName: r.agencyName, reason: r.reason, visits: data.filter((d) => d.referralId === r.id).length })),
      daily: Object.entries(daily).sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count })),
      monthly: Object.entries(monthly).sort(([a], [b]) => a.localeCompare(b)).map(([month, count]) => ({ month, count })),
    };
  }

  async dashboard() {
    const today = dateKey(new Date());
    const summary = await this.summary(today, today);
    return {
      date: today,
      visits: summary.visits,
      waiting: summary.statuses.waiting ?? 0,
      inService: summary.statuses.in_service ?? 0,
      completed: summary.statuses.completed ?? 0,
      referred: summary.statuses.referred ?? 0,
      avgWaitingMinutes: summary.waitingMinutes,
      conversionRate: summary.conversions.rate,
    };
  }
}
