import { DataSource } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import { AppDataSource } from './data-source';

interface ProgramSeed {
  id: string;
  name: string;
  category: string;
  waitingPeriodDays: number;
  requiredDocuments: string[];
  fundSources: string[];
  legalBasis: string;
  isActive: boolean;
}

const PROGRAMS: ProgramSeed[] = [
  {
    id: uuidv7(),
    name: 'Medical Assistance',
    category: 'Medical',
    waitingPeriodDays: 15,
    requiredDocuments: [
      'Valid ID of patient or immediate family member',
      'Barangay Certificate of Indigency',
      'Medical abstract / doctor\'s referral',
      'Prescription / list of medicines',
      'Hospital bill / statement of account',
      'Death certificate (for burial-adjacent medical claims)',
    ],
    fundSources: ['LGU - Municipal', 'DSWD - AICS'],
    legalBasis: 'RA 11223 (Universal Health Care Act); DSWD MC No. 5 s.2021 (AICS Guidelines)',
    isActive: true,
  },
  {
    id: uuidv7(),
    name: 'Burial Assistance',
    category: 'Burial',
    waitingPeriodDays: 30,
    requiredDocuments: [
      'Valid ID of claimant / immediate family member',
      'Barangay Certificate of Indigency',
      'Death certificate (PSA)',
      'Funeral contract / official receipt from funeral parlor',
      'Affidavit of next of kin',
    ],
    fundSources: ['LGU - Municipal', 'DSWD - AICS'],
    legalBasis: 'RA 7160 (Local Government Code); DSWD MC No. 5 s.2021',
    isActive: true,
  },
  {
    id: uuidv7(),
    name: 'Transportation Assistance',
    category: 'Transportation',
    waitingPeriodDays: 7,
    requiredDocuments: [
      'Valid ID of claimant',
      'Barangay Certificate of Indigency',
      'Medical appointment slip / referral (if medical-related)',
      'Affidavit of need (if emergency travel)',
    ],
    fundSources: ['LGU - Municipal'],
    legalBasis: 'RA 7160 (Local Government Code)',
    isActive: true,
  },
  {
    id: uuidv7(),
    name: 'Food Assistance',
    category: 'Food',
    waitingPeriodDays: 14,
    requiredDocuments: [
      'Valid ID of claimant',
      'Barangay Certificate of Indigency',
      'Affidavit of need',
    ],
    fundSources: ['LGU - Municipal', 'DSWD - AICS'],
    legalBasis: 'RA 7160 (Local Government Code); DSWD MC No. 5 s.2021',
    isActive: true,
  },
  {
    id: uuidv7(),
    name: 'Financial Assistance (General)',
    category: 'Financial',
    waitingPeriodDays: 30,
    requiredDocuments: [
      'Valid ID of claimant',
      'Barangay Certificate of Indigency',
      'Letter request / application form',
      'Supporting documents depending on purpose (hospital bill, quotation, assessment)',
    ],
    fundSources: ['LGU - Municipal', 'DSWD - AICS'],
    legalBasis: 'RA 7160 (Local Government Code); DSWD MC No. 5 s.2021',
    isActive: true,
  },
  {
    id: uuidv7(),
    name: 'Educational Assistance',
    category: 'Education',
    waitingPeriodDays: 90,
    requiredDocuments: [
      'Valid ID of parent / guardian',
      'Barangay Certificate of Indigency',
      'Certificate of Enrollment / registration form',
      'School ID of student',
      'Grades / class card (for continuing)',
    ],
    fundSources: ['LGU - Municipal', 'DSWD - AICS', 'Private Donations'],
    legalBasis: 'RA 9155 (Governance of Basic Education Act); RA 10931 (Universal Access to Quality Tertiary Education Act)',
    isActive: true,
  },
  {
    id: uuidv7(),
    name: 'Solo Parent Support',
    category: 'Family Welfare',
    waitingPeriodDays: 30,
    requiredDocuments: [
      'Valid ID of claimant',
      'Barangay Certificate of Indigency',
      'Solo Parent ID (from DSWD) or Certificate of Solo Parent Status',
      'Birth certificate of child/ren (PSA)',
      'Affidavit of status as solo parent',
    ],
    fundSources: ['LGU - Municipal', 'DSWD'],
    legalBasis: 'RA 8972 (Solo Parents\' Welfare Act); RA 11861 (Expanded Solo Parents Act)',
    isActive: true,
  },
  {
    id: uuidv7(),
    name: 'Senior Citizen Social Pension',
    category: 'Senior Welfare',
    waitingPeriodDays: 90,
    requiredDocuments: [
      'Senior Citizen ID / Valid Government ID',
      'Barangay Certificate of Indigency',
      'Birth certificate (PSA) or any proof of age',
      'Bank account details / GCash account (if applicable)',
    ],
    fundSources: ['DSWD - Social Pension Program', 'LGU - Municipal'],
    legalBasis: 'RA 7432 (Senior Citizens Act); RA 9994 (Expanded Senior Citizens Act)',
    isActive: true,
  },
  {
    id: uuidv7(),
    name: 'PWD Assistance',
    category: 'PWD Welfare',
    waitingPeriodDays: 30,
    requiredDocuments: [
      'Valid ID of claimant',
      'Barangay Certificate of Indigency',
      'PWD ID (from DSWD / LGU)',
      'Medical certificate / clinical abstract proving disability',
      'Birth certificate (PSA)',
    ],
    fundSources: ['LGU - Municipal', 'DSWD'],
    legalBasis: 'RA 7277 (Magna Carta for Disabled Persons); RA 10754 (Expanded Benefits and Privileges of PWDs)',
    isActive: true,
  },
  {
    id: uuidv7(),
    name: 'Child Welfare Assistance',
    category: 'Child Welfare',
    waitingPeriodDays: 30,
    requiredDocuments: [
      'Valid ID of parent / guardian',
      'Barangay Certificate of Indigency',
      'Birth certificate of child (PSA)',
      'Medical assessment (if medical-related)',
      'Social case study report (if available)',
    ],
    fundSources: ['LGU - Municipal', 'DSWD'],
    legalBasis: 'RA 7610 (Special Protection of Children Against Abuse, Exploitation and Discrimination Act)',
    isActive: true,
  },
  {
    id: uuidv7(),
    name: 'Livelihood Assistance',
    category: 'Livelihood',
    waitingPeriodDays: 60,
    requiredDocuments: [
      'Valid ID of claimant',
      'Barangay Certificate of Indigency',
      'Business plan / project proposal',
      'Barangay endorsement',
      'Skills training certificate (if applicable)',
    ],
    fundSources: ['LGU - Municipal', 'DSWD - SLP', 'DOLE'],
    legalBasis: 'RA 8425 (Social Reform and Poverty Alleviation Act); DSWD SLP Guidelines',
    isActive: true,
  },
  {
    id: uuidv7(),
    name: 'Psychosocial Counseling',
    category: 'Mental Health',
    waitingPeriodDays: 0,
    requiredDocuments: [
      'Valid ID of client',
      'Referral letter (if from other agency)',
      'Consent form (for minors, parental consent)',
    ],
    fundSources: ['LGU - Municipal'],
    legalBasis: 'RA 11036 (Mental Health Act); RA 9433 (Magnificat Act — MSWDO)',
    isActive: true,
  },
  {
    id: uuidv7(),
    name: 'Referral and Linkage Services',
    category: 'Social Services',
    waitingPeriodDays: 0,
    requiredDocuments: [
      'Valid ID of client',
      'Referral letter (if any)',
      'Brief narrative of situation',
    ],
    fundSources: ['LGU - Municipal'],
    legalBasis: 'RA 7160 (Local Government Code)',
    isActive: true,
  },
  {
    id: uuidv7(),
    name: 'AICS — Assistance to Individuals in Crisis Situation',
    category: 'Crisis Intervention',
    waitingPeriodDays: 7,
    requiredDocuments: [
      'Valid ID of client',
      'Barangay Certificate of Indigency',
      'Medical certificate / hospital bill / quotation (depending on need)',
      'Social case study report (if available)',
    ],
    fundSources: ['DSWD - AICS', 'LGU - Municipal'],
    legalBasis: 'DSWD MC No. 5 s.2021 (AICS Operational Guidelines)',
    isActive: true,
  },
  {
    id: uuidv7(),
    name: 'Supplementary Feeding Program',
    category: 'Child Welfare',
    waitingPeriodDays: 0,
    requiredDocuments: [
      'List of beneficiaries from Barangay Nutrition Council',
      'Parent consent forms',
      'Nutritional assessment form',
    ],
    fundSources: ['DSWD', 'LGU - Municipal'],
    legalBasis: 'RA 11037 (Masustansyang Pagkain para sa Batang Pilipino Act)',
    isActive: true,
  },
  {
    id: uuidv7(),
    name: 'Emergency Cash/Food for Work',
    category: 'Livelihood',
    waitingPeriodDays: 90,
    requiredDocuments: [
      'Valid ID of claimant',
      'Barangay Certificate of Indigency',
      'List of completed work / Certificate of Work Rendered from Barangay',
      'Attendance sheet',
    ],
    fundSources: ['DSWD', 'LGU - Municipal'],
    legalBasis: 'RA 8425 (Social Reform and Poverty Alleviation Act)',
    isActive: true,
  },
  {
    id: uuidv7(),
    name: 'Disaster Response and Relief Assistance',
    category: 'Disaster Response',
    waitingPeriodDays: 0,
    requiredDocuments: [
      'Valid ID of claimant',
      'Barangay Certificate of Indigency',
      'Barangay disaster assessment report / list of affected families',
    ],
    fundSources: ['LDRRMF - Municipal', 'DSWD - Disaster Response', 'NGA Partners'],
    legalBasis: 'RA 10121 (Disaster Risk Reduction and Management Act); RA 7160',
    isActive: true,
  },
  {
    id: uuidv7(),
    name: 'Medical Equipment Loan',
    category: 'Medical',
    waitingPeriodDays: 7,
    requiredDocuments: [
      'Valid ID of claimant',
      'Barangay Certificate of Indigency',
      'Medical certificate / doctor\'s prescription for the equipment',
      'Affidavit of undertaking (responsibility for equipment)',
    ],
    fundSources: ['LGU - Municipal'],
    legalBasis: 'RA 7160 (Local Government Code)',
    isActive: true,
  },
];

async function seedPrograms(dataSource: DataSource) {
  const q = dataSource.createQueryRunner();
  await q.connect();

  try {
    const inserted: string[] = [];

    for (const prog of PROGRAMS) {
      const existing = await q.query(`SELECT id FROM programs WHERE name = $1`, [prog.name]);
      if (existing.length > 0) {
        inserted.push(`  SKIP  ${prog.name} (already exists)`);
        continue;
      }

      await q.query(
        `INSERT INTO programs (id, name, category, waiting_period_days, required_documents, fund_sources, legal_basis, is_active)
         VALUES ($1,$2,$3,$4,$5::jsonb,$6::text[],$7,$8)`,
        [prog.id, prog.name, prog.category, prog.waitingPeriodDays, JSON.stringify(prog.requiredDocuments), prog.fundSources, prog.legalBasis, prog.isActive],
      );

      inserted.push(`  SEED  ${prog.name}`);
    }

    console.log(`Seeded ${inserted.filter(l => l.includes('SEED')).length} programs:`);
    for (const l of inserted) console.log(l);
  } finally {
    await q.release();
  }
}

async function main() {
  await AppDataSource.initialize();
  await seedPrograms(AppDataSource);
  await AppDataSource.destroy();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
