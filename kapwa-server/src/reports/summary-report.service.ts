import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { User } from '../auth/user.entity';
import { OrgService } from '../common/org.service';
import { REPORT_FALLBACK_SIGNATORIES } from '../common/constants';
import {
  CaseClassificationInput, CaseListRow, CategoryKey, SummaryCounts, SummaryReportData,
  classifyCase,
} from './summary-report.types';

const CATEGORY_KEYS: CategoryKey[] = [
  'BURIAL', 'MEDICAL', 'ASSISTIVE', 'PWD', 'BIRTH_DISCREPANCY', 'TRAVEL', 'CSR',
  'COUNSELLING', 'PHILHEALTH', 'CUSTODY', 'HOME_VISIT', 'BALIK_PROBINSYA',
  'LEGAL_PAO', 'LEGAL_OTHERS', 'OTHERS_TECHNICAL',
];

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

interface RawCaseRow {
  case_id: string; created_at: Date; client_category: string | null; gender: string | null;
  surname: string | null; first_name: string | null; middle_name: string | null;
  dob: Date | null; barangay: string | null; service_text: string | null; referral_text: string | null;
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
    SELECT string_agg(COALESCE(cr2.reason, '') || ' ' || COALESCE(cr2.agency, ''), ' ') AS text
    FROM case_referrals cr2 WHERE cr2.case_id = c.id
  ) cr ON TRUE
  LEFT JOIN LATERAL (SELECT csr2.case_id FROM csr_reports csr2 WHERE csr2.case_id = c.id LIMIT 1) csr ON TRUE
  LEFT JOIN LATERAL (SELECT fv2.case_id FROM case_follow_up_visits fv2 WHERE fv2.case_id = c.id LIMIT 1) fv ON TRUE
  WHERE c.created_at >= $1 AND c.created_at < $2
  ORDER BY c.created_at ASC
`;

function emptyCounts(): SummaryCounts {
  return {
    male: 0, female: 0, total: 0,
    byCategory: Object.fromEntries(CATEGORY_KEYS.map((k) => [k, 0])) as Record<CategoryKey, number>,
  };
}

function addTo(counts: SummaryCounts, gender: string | null, key: CategoryKey) {
  if (gender === 'Female') counts.female += 1;
  else counts.male += 1;
  counts.total += 1;
  counts.byCategory[key] += 1;
}

function monthRange(year: number, monthIndex: number): { start: Date; end: Date; label: string } {
  const start = new Date(Date.UTC(year, monthIndex, 1));
  const end = new Date(Date.UTC(year, monthIndex + 1, 1));
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  return { start, end, label: `${MONTH_NAMES[monthIndex]} 1-${lastDay}, ${year}` };
}

const ORDINAL = ['1st', '2nd', '3rd', '4th'];

@Injectable()
export class SummaryReportService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly org: OrgService,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  async build(year = new Date().getFullYear(), quarter = Math.floor(new Date().getMonth() / 3) + 1): Promise<SummaryReportData> {
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const yearEnd = new Date(Date.UTC(year + 1, 0, 1));
    const rows: RawCaseRow[] = (await this.dataSource.query(CASES_SQL, [yearStart, yearEnd])) ?? [];

    const annual = emptyCounts();
    const monthly = [0, 1, 2].map((i) => monthRange(year, (quarter - 1) * 3 + i));
    const monthlyCounts = monthly.map(() => emptyCounts());
    const caseList: CaseListRow[] = [];

    rows.forEach((r, index) => {
      const input: CaseClassificationInput = {
        clientCategory: r.client_category,
        serviceText: r.service_text ?? '',
        referralText: r.referral_text ?? '',
        hasCsr: !!r.has_csr,
        hasVisit: !!r.has_visit,
      };
      const key = classifyCase(input);
      addTo(annual, r.gender, key);
      const created = new Date(r.created_at);
      const mIdx = monthly.findIndex((m) => created >= m.start && created < m.end);
      if (mIdx >= 0) addTo(monthlyCounts[mIdx], r.gender, key);
      caseList.push(this.toCaseListRow(r, index + 1));
    });

    const quarterSummary = monthlyCounts.reduce((acc, c) => {
      acc.male += c.male; acc.female += c.female; acc.total += c.total;
      CATEGORY_KEYS.forEach((k) => { acc.byCategory[k] += c.byCategory[k]; });
      return acc;
    }, emptyCounts());

    const [officeName, prepared, noted] = await Promise.all([
      this.org.officeName(),
      this.firstActiveUser('social_worker'),
      this.firstActiveUser('admin'),
    ]);

    return {
      year, quarter,
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

  private toCaseListRow(r: RawCaseRow, no: number): CaseListRow {
    const created = new Date(r.created_at);
    const dob = r.dob ? new Date(r.dob) : undefined;
    const age = dob ? Math.floor((Date.now() - new Date(dob).getTime()) / 31557600000) : undefined;
    const cat = (r.client_category ?? '').toLowerCase();
    const input: CaseClassificationInput = {
      clientCategory: r.client_category, serviceText: r.service_text ?? '',
      referralText: r.referral_text ?? '', hasCsr: !!r.has_csr, hasVisit: !!r.has_visit,
    };
    return {
      no,
      date: `${String(created.getUTCMonth() + 1).padStart(2, '0')}-${String(created.getUTCDate()).padStart(2, '0')}-${String(created.getUTCFullYear()).slice(2)}`,
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
      intervention: this.interventionCode(classifyCase(input)),
    };
  }

  private interventionCode(key: CategoryKey): string {
    switch (key) {
      case 'BURIAL': case 'MEDICAL': case 'ASSISTIVE': case 'PWD': return 'FA';
      case 'CSR': return 'CSR';
      case 'HOME_VISIT': return 'HV';
      case 'LEGAL_PAO': case 'LEGAL_OTHERS': return 'R';
      case 'OTHERS_TECHNICAL': return 'C';
      default: return 'H';
    }
  }
}
