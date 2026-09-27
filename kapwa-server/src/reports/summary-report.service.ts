import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { User } from '../auth/user.entity';
import { OrgService } from '../common/org.service';
import { REPORT_FALLBACK_SIGNATORIES } from '../common/constants';
import {
  CaseClassificationInput, CaseListRow, ReportColumn, SummaryCounts, SummaryReportData,
  SummaryTable, buildColumns, selectCaseColumn,
} from './summary-report.types';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

interface RawCaseRow {
  case_id: string; created_at: Date; client_category: string | null; gender: string | null;
  surname: string | null; first_name: string | null; middle_name: string | null;
  dob: Date | null; barangay: string | null; service_text: string | null; referral_text: string | null;
  referral_agencies: string | null;
  latest_intervention_at: Date | null; latest_referral_at: Date | null;
  program_id: string | null; program_name: string | null;
  has_csr: boolean; has_visit: boolean;
}

const CASES_SQL = `
  SELECT c.id AS case_id,
         c.created_at AS created_at,
         c.client_category AS client_category,
         p.gender AS gender,
         p.surname AS surname,
         p.first_name AS first_name,
         p.middle_name AS middle_name,
         p.dob AS dob,
         pa.barangay AS barangay,
         COALESCE(ci.text, '') AS service_text,
         COALESCE(cr.text, '') AS referral_text,
         COALESCE(cr.agencies, '') AS referral_agencies,
         (SELECT MAX(ci2.created_at) FROM case_interventions ci2 WHERE ci2.case_id = c.id::text) AS latest_intervention_at,
         (SELECT MAX(cr2.created_at) FROM case_referrals cr2 WHERE cr2.case_id = c.id) AS latest_referral_at,
         (SELECT ci2.program_id FROM case_interventions ci2
            WHERE ci2.case_id = c.id::text
            ORDER BY COALESCE(ci2.delivery_date, ci2.created_at) ASC NULLS LAST, ci2.created_at ASC
            LIMIT 1) AS program_id,
         (SELECT pr2.name FROM case_interventions ci2
            LEFT JOIN programs pr2 ON pr2.id = ci2.program_id
            WHERE ci2.case_id = c.id::text
            ORDER BY COALESCE(ci2.delivery_date, ci2.created_at) ASC NULLS LAST, ci2.created_at ASC
            LIMIT 1) AS program_name,
         (csr.case_id IS NOT NULL) AS has_csr,
         (fv.case_id IS NOT NULL) AS has_visit
  FROM cases c
  LEFT JOIN beneficiaries b ON b.id = c.beneficiary_id
  LEFT JOIN persons p ON p.id = b.person_id
  LEFT JOIN LATERAL (
    SELECT a.barangay FROM person_addresses a
    WHERE a.person_id = p.id
    ORDER BY a.is_primary DESC NULLS LAST, a.created_at ASC
    LIMIT 1
  ) pa ON TRUE
  LEFT JOIN LATERAL (
    SELECT string_agg(ci2.service_name || ' ' || COALESCE(ci2.category, '') || ' ' || COALESCE(pr.name, '') || ' ' || COALESCE(pr.category, ''), ' ') AS text
    FROM case_interventions ci2
    LEFT JOIN programs pr ON pr.id = ci2.program_id
    WHERE ci2.case_id = c.id::text
  ) ci ON TRUE
  LEFT JOIN LATERAL (
    SELECT
      string_agg(COALESCE(cr2.reason, '') || ' ' || COALESCE(cr2.agency, ''), ' ') AS text,
      string_agg(COALESCE(cr2.agency, ''), ', ') AS agencies
    FROM case_referrals cr2 WHERE cr2.case_id = c.id
  ) cr ON TRUE
  LEFT JOIN LATERAL (SELECT csr2.case_id FROM csr_reports csr2 WHERE csr2.case_id = c.id LIMIT 1) csr ON TRUE
  LEFT JOIN LATERAL (SELECT fv2.case_id FROM case_follow_up_visits fv2 WHERE fv2.case_id = c.id LIMIT 1) fv ON TRUE
  WHERE c.created_at >= $1 AND c.created_at < $2
  ORDER BY c.created_at ASC
`;

const PROGRAMS_SQL = `
  SELECT id, name, category FROM programs WHERE is_active = TRUE ORDER BY created_at ASC
`;

const ORDINAL = ['1st', '2nd', '3rd', '4th'];

@Injectable()
export class SummaryReportService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly org: OrgService,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  async build(year = new Date().getFullYear(), quarter = Math.floor(new Date().getMonth() / 3) + 1): Promise<SummaryReportData> {
    const yearStart = new Date(`${year}-01-01T00:00:00+08:00`);
    const yearEnd = new Date(`${year + 1}-01-01T00:00:00+08:00`);
    const [rows, programRows] = await Promise.all([
      this.dataSource.query(CASES_SQL, [yearStart, yearEnd]),
      this.dataSource.query(PROGRAMS_SQL),
    ]);
    const programs = (programRows ?? []) as Array<{ id: string; name: string; category?: string | null }>;
    const columns = buildColumns(programs);

    const annual = emptyCounts(columns);
    const monthly = [0, 1, 2].map((i) => monthRange(year, (quarter - 1) * 3 + i));
    const monthlyCounts = monthly.map(() => emptyCounts(columns));
    const caseList: CaseListRow[] = [];

    (rows ?? []).forEach((r: RawCaseRow, index: number) => {
      const input: CaseClassificationInput = {
        clientCategory: r.client_category,
        serviceText: r.service_text ?? '',
        referralText: r.referral_text ?? '',
        hasCsr: !!r.has_csr,
        hasVisit: !!r.has_visit,
        programId: r.program_id,
        programName: r.program_name,
      };
      const col = selectCaseColumn(input, programs);
      const key = annual.byColumn[col.key] !== undefined ? col.key : 'UNASSIGNED';
      addTo(annual, r.gender, key);
      const created = new Date(r.created_at);
      const mIdx = monthly.findIndex((m) => created >= m.start && created < m.end);
      if (mIdx >= 0) addTo(monthlyCounts[mIdx], r.gender, key);
      caseList.push(this.toCaseListRow(r, index + 1, col.code));
    });

    const quarterSummary = monthlyCounts.reduce((acc, c) => {
      acc.male += c.male; acc.female += c.female; acc.total += c.total;
      for (const k of Object.keys(c.byColumn)) acc.byColumn[k] += c.byColumn[k];
      return acc;
    }, emptyCounts(columns));

    const [officeName, prepared, noted] = await Promise.all([
      this.org.officeName(),
      this.firstActiveUser('social_worker'),
      this.firstActiveUser('admin'),
    ]);

    return {
      year, quarter, columns,
      annual: { title: `SUMMARY REPORT ${year}`, counts: annual },
      monthly: monthly.map((m, i) => ({ title: m.label, counts: monthlyCounts[i] })),
      quarterSummary: { title: `${ORDINAL[quarter - 1]} QUARTER SUMMARY`, counts: quarterSummary },
      caseList,
      officeName,
      preparedBy: prepared?.fullName || REPORT_FALLBACK_SIGNATORIES.preparedBy,
      preparedByRole: REPORT_FALLBACK_SIGNATORIES.preparedByRole,
      notedBy: noted?.fullName || REPORT_FALLBACK_SIGNATORIES.notedBy,
      notedByRole: REPORT_FALLBACK_SIGNATORIES.notedByRole,
    };
  }

  private async firstActiveUser(role: string): Promise<User | null> {
    try {
      return await this.userRepo.findOne({ where: { role, isActive: true } as any, order: { createdAt: 'ASC' } });
    } catch {
      return null;
    }
  }

  private toCaseListRow(r: RawCaseRow, no: number, fallbackCode: string): CaseListRow {
    const created = new Date(r.created_at);
    // The case list prints the local Philippines calendar day: shift the
    // instant by the fixed +08:00 offset and read its UTC fields.
    const manila = new Date(created.getTime() + 8 * 60 * 60 * 1000);
    const dob = r.dob ? new Date(r.dob) : undefined;
    const age = dob ? Math.floor((Date.now() - new Date(dob).getTime()) / 31557600000) : undefined;
    const cat = (r.client_category ?? '').toLowerCase();
    return {
      no,
      date: `${String(manila.getUTCMonth() + 1).padStart(2, '0')}-${String(manila.getUTCDate()).padStart(2, '0')}-${String(manila.getUTCFullYear()).slice(2)}`,
      surname: r.surname ?? '', firstName: r.first_name ?? '', middleName: r.middle_name ?? '',
      gender: r.gender === 'Female' ? 'F' : r.gender === 'Male' ? 'M' : '',
      categories: {
        cedc: age !== undefined && age < 18,
        wedc: r.gender === 'Female' && /wedc|women in especially difficult|vawc/i.test(cat),
        pwd: /pwd/.test(cat),
        senior: age !== undefined && age >= 60,
        indigent: /indigent/.test(cat),
        fourPs: /4ps|pantawid/.test(cat),
        ip: /\bip\b|indigenous/.test(cat),
      },
      barangay: r.barangay ?? '',
      // Referrals to other/higher agencies are the case's FINAL remark when
      // the referral is the LATEST addition; otherwise the derived code.
      intervention: this.finalRemark(r, fallbackCode),
    };
  }

  private finalRemark(r: RawCaseRow, fallbackCode: string): string {
    const agencies = (r.referral_agencies ?? '').trim();
    if (agencies) {
      const iv = r.latest_intervention_at ? new Date(r.latest_intervention_at).getTime() : 0;
      const rv = r.latest_referral_at ? new Date(r.latest_referral_at).getTime() : 0;
      if (rv >= iv) return `Referred to ${agencies}`;
    }
    return fallbackCode;
  }
}

function monthRange(year: number, monthIndex: number): { start: Date; end: Date; label: string } {
  const mm = String(monthIndex + 1).padStart(2, '0');
  const next = monthIndex === 11 ? `${year + 1}-01-01` : `${year}-${String(monthIndex + 2).padStart(2, '0')}-01`;
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  return {
    start: new Date(`${year}-${mm}-01T00:00:00+08:00`),
    end: new Date(`${next}T00:00:00+08:00`),
    label: `${MONTH_NAMES[monthIndex]} 1-${lastDay}, ${year}`,
  };
}

function emptyCounts(columns: ReportColumn[]): SummaryCounts {
  const byColumn: Record<string, number> = {};
  for (const c of columns) {
    if (c.key === 'MALE' || c.key === 'FEMALE' || c.key === 'TOTAL') continue;
    byColumn[c.key] = 0;
  }
  return { male: 0, female: 0, total: 0, byColumn };
}

function addTo(counts: SummaryCounts, gender: string | null, key: string) {
  if (gender === 'Female') counts.female += 1;
  else counts.male += 1;
  counts.total += 1;
  if (counts.byColumn[key] !== undefined) counts.byColumn[key] += 1;
}