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
  /**
   * Machine key of the catalog (spec Appendix B: aics, social_pension,
   * diversion, …). NULL for programs outside the catalog — locally relevant
   * PPAs (GAD-report programs, municipal innovations) that the typed
   * enrollments/AICS-budget phase does not key off.
   */
  programType: string | null;
  /** The intervention types this program renders (Program → Services matrix). */
  services: string[];
}

// Documents that only apply in some situations (written as "... (if ...)" or
// "... (depending on ...)" in the program matrix). They must not block
// activation of a routine case, so they seed as non-mandatory.
const OPTIONAL_DOCUMENT_KEYS = new Set<string>([
  'Death certificate (for burial-adjacent medical claims)',
  'Medical appointment slip / referral (if medical-related)',
  'Affidavit of need (if emergency travel)',
  'Supporting documents depending on purpose (hospital bill, quotation, assessment)',
  'Bank account details / GCash account (if applicable)',
  'Skills training certificate (if applicable)',
  'Referral letter (if from other agency)',
  'Referral letter (if any)',
  'Medical assessment (if medical-related)',
  'Social case study report (if available)',
  'Medical certificate / hospital bill / quotation (depending on need)',
  'Barangay Certificate of Indigency (for household grantees)',
  'Grades / class card (for continuing)',
]);

export const PROGRAMS: ProgramSeed[] = [
  // ------------------------------------------------------------------ AICS
  // One program whose assistance types are its services — per MSWDO practice
  // (Palanan MSWDO AICS process: "direct financial assistance and material
  // assistance including medical, transportation, financial, burial and food").
  // The former standalone Medical/Burial/Transportation/Food/Financial/
  // Educational Assistance programs were merged here (research-verified
  // 2026-10-04; see design spec Appendix B).
  //
  // The six merged rows below are kept as *untyped, report-support* rows:
  // the GAD summary report's BURIAL/MEDICAL/EDUCATION columns key on these
  // names, and removing them would empty the columns on fresh databases. They
  // are outside the typed catalog (`programType: null`) — the catalog program
  // for all of them is AICS, and the AICS-budget phase keys off
  // `program_type = aics` + the intervention type.
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
    programType: 'aics',
    services: [
      'financial_grant', 'medical_assistance', 'burial_assistance',
      'transport_assistance', 'food_pack', 'educational_assistance',
      'scsr_generated', 'crisis_counseling',
    ],
  },
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
    programType: null,
    services: ['medical_assistance', 'financial_grant', 'scsr_generated'],
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
    programType: null,
    services: ['burial_assistance'],
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
    programType: null,
    services: ['transport_assistance'],
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
    programType: null,
    services: ['food_pack'],
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
    programType: null,
    services: ['financial_grant', 'scsr_generated'],
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
    programType: null,
    services: ['educational_assistance', 'training_seminar'],
  },

  // ----------------------------------------------------------- Family welfare
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
    programType: 'family_welfare',
    services: ['financial_grant', 'crisis_counseling', 'legal_assistance', 'training_seminar', 'scsr_generated'],
  },
  {
    id: uuidv7(),
    name: 'Parent Effectiveness Service',
    category: 'Family Welfare',
    waitingPeriodDays: 0,
    requiredDocuments: [
      'Valid ID of participant',
      'Barangay Certificate of Indigency',
      'Referral letter (if from other agency)',
      'Consent form (for minors, parental consent)',
    ],
    fundSources: ['LGU - Municipal'],
    legalBasis: 'RA 7160 (Local Government Code); DSWD family-welfare service guidelines',
    isActive: true,
    programType: 'family_welfare',
    services: ['parent_effectiveness', 'training_seminar', 'crisis_counseling'],
  },
  {
    id: uuidv7(),
    name: 'Family Casework Service',
    category: 'Family Welfare',
    waitingPeriodDays: 0,
    requiredDocuments: [
      'Valid ID of client',
      'Social case study report (if available)',
      'Referral letter (if from other agency)',
    ],
    fundSources: ['LGU - Municipal'],
    legalBasis: 'RA 7160 (Local Government Code)',
    isActive: true,
    programType: 'family_welfare',
    services: ['crisis_counseling', 'home_visit'],
  },

  // ---------------------------------------------------------- Women's welfare
  {
    id: uuidv7(),
    name: 'VAWC Protection & Women\'s Welfare',
    category: "Women's Welfare",
    waitingPeriodDays: 0,
    requiredDocuments: [
      'Valid ID of client',
      'Sworn statement / incident report',
      'Barangay blotter / VAW desk report',
      'Medico-legal certificate (if available)',
    ],
    fundSources: ['LGU - Municipal', 'DSWD'],
    legalBasis: 'RA 9262 (Anti-VAWC Act); RA 9710 (Magna Carta of Women)',
    isActive: true,
    programType: 'women_welfare',
    services: [
      'crisis_counseling', 'psychosocial_support', 'legal_assistance',
      'medico_legal_assistance', 'protection_order_issued', 'shelter_assistance', 'referral_pao',
    ],
  },

  // ---------------------------------------------------------------- Sectoral
  {
    id: uuidv7(),
    name: 'Social Pension for Indigent Senior Citizens',
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
    programType: 'social_pension',
    services: ['financial_grant', 'scsr_generated', 'home_visit'],
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
    programType: 'disability_aid',
    services: ['medical_assistance', 'financial_grant', 'health_checkup', 'scsr_generated'],
  },

  // --------------------------------------------------------------- Children
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
    programType: 'child_welfare',
    services: [
      'financial_grant', 'crisis_counseling', 'legal_assistance',
      'medico_legal_assistance', 'educational_assistance', 'protective_custody', 'shelter_assistance',
    ],
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
    programType: 'supplemental_feeding',
    services: ['food_pack', 'health_checkup'],
  },

  // -------------------------------------------------- CICL diversion & aftercare
  // Annexed to DSWD AO 10 s. 2007: the diversion/intervention program is a
  // package of interventions for the CICL and family (counseling, trainings,
  // community service, education, youth organizations), monitored monthly,
  // 6 months–1 year; on termination, institutionalized CICL are referred to
  // the C/MSWDO for aftercare services (§VIII.G).
  {
    id: uuidv7(),
    name: 'Juvenile Diversion & Intervention Program (CICL)',
    category: 'Child Welfare',
    waitingPeriodDays: 0,
    requiredDocuments: [
      'Intake Sheet / referral from law enforcement',
      'Act of Discernment assessment (CICL above 15)',
      'Birth certificate (PSA)',
      'Parent/guardian consent',
    ],
    fundSources: ['LGU - Municipal', 'DSWD'],
    legalBasis: 'RA 9344 (Juvenile Justice and Welfare Act, as amended by RA 10630); DSWD AO 10 s. 2007',
    isActive: true,
    programType: 'diversion',
    services: [
      'crisis_counseling', 'psychosocial_support', 'training_seminar',
      'community_service', 'youth_engagement', 'parent_effectiveness',
      'legal_assistance', 'home_visit',
    ],
  },
  {
    id: uuidv7(),
    name: 'Aftercare Support',
    category: 'Aftercare',
    waitingPeriodDays: 0,
    requiredDocuments: [
      'Valid ID of client',
      'Case closure / discharge document',
      'Referral letter (if from other agency)',
    ],
    fundSources: ['LGU - Municipal', 'DSWD'],
    legalBasis: 'DSWD AO 10 s. 2007 §VIII.G; DSWD aftercare guidelines',
    isActive: true,
    programType: 'aftercare',
    services: ['home_visit', 'crisis_counseling', 'psychosocial_support', 'scsr_generated'],
  },

  // --------------------------------------------------------------- Livelihood
  {
    id: uuidv7(),
    name: 'Sustainable Livelihood Program',
    category: 'Livelihood',
    waitingPeriodDays: 60,
    requiredDocuments: [
      'Valid ID of claimant',
      'Barangay Certificate of Indigency',
      'Business plan / project proposal',
      'Barangay endorsement',
      'Skills training certificate (if applicable)',
    ],
    fundSources: ['DSWD - SLP', 'LGU - Municipal'],
    legalBasis: 'RA 8425 (Social Reform and Poverty Alleviation Act); DSWD SLP Guidelines',
    isActive: true,
    programType: 'livelihood',
    services: ['livelihood_seed', 'training_seminar', 'home_visit'],
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
    programType: 'disaster_relief',
    services: ['food_pack', 'financial_grant'],
  },

  // ----------------------------------------------------------- Crisis support
  {
    id: uuidv7(),
    name: 'Crisis Intervention & Psychosocial Support',
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
    programType: 'counseling',
    services: ['crisis_counseling', 'psychosocial_support'],
  },
  {
    id: uuidv7(),
    name: 'Referral and Linkage Services',
    category: 'Legal',
    waitingPeriodDays: 0,
    requiredDocuments: [
      'Valid ID of client',
      'Referral letter (if any)',
      'Brief narrative of situation',
    ],
    fundSources: ['LGU - Municipal'],
    legalBasis: 'RA 7160 (Local Government Code)',
    isActive: true,
    programType: 'legal_referral',
    services: ['referral_pao', 'legal_assistance', 'scsr_generated'],
  },

  // ------------------------------------------------------------ 4Ps & feeding
  {
    id: uuidv7(),
    name: '4Ps — Pantawid Pamilyang Pilipino Program',
    category: 'CCT',
    waitingPeriodDays: 0,
    requiredDocuments: [
      '4Ps Household ID',
      'Valid ID of parent/guardian',
      'Birth certificates of children (PSA)',
      'Barangay Certificate of Indigency',
      'Enrollment certificate (for school-age children)',
    ],
    fundSources: ['DSWD - 4Ps National'],
    legalBasis: 'RA 11310 (Pantawid Pamilyang Pilipino Program Act)',
    isActive: true,
    programType: 'cct',
    services: ['financial_grant', 'crisis_counseling', 'parent_effectiveness', 'health_checkup', 'educational_assistance'],
  },

  // ------------------------------------------------------------- Calamities
  {
    id: uuidv7(),
    name: 'Emergency Shelter Assistance',
    category: 'Disaster Response',
    waitingPeriodDays: 14,
    requiredDocuments: [
      'Valid ID of claimant',
      'Barangay Certificate of Indigency',
      'Certification from BFP (if fire victim)',
      'Picture of damaged house',
    ],
    fundSources: ['LDRRMF - Municipal', 'DSWD - Disaster Response'],
    legalBasis: 'RA 10121 (Disaster Risk Reduction and Management Act); RA 7160',
    isActive: true,
    programType: 'shelter',
    services: ['shelter_assistance', 'financial_grant', 'home_visit'],
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
    programType: 'disaster_relief',
    services: ['food_pack', 'transport_assistance', 'financial_grant', 'crisis_counseling', 'home_visit'],
  },

  // ------------------------------------------------------------------ Medical
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
    programType: 'medical',
    services: ['medical_assistance', 'scsr_generated'],
  },

  // ------------------------------------------- National CDD / economic programs
  {
    id: uuidv7(),
    name: 'KALAHI-CIDSS (Community-Driven Development)',
    category: 'Community Development',
    waitingPeriodDays: 0,
    requiredDocuments: [
      'Barangay assembly resolution / endorsement',
      'Community sub-project proposal',
      'Listahanan/NHTS-PR reference for household validation',
      'Barangay Certificate of Indigency (for household grantees)',
    ],
    fundSources: ['DSWD - KALAHI-CIDSS'],
    legalBasis: 'RA 7160 (Local Government Code); DSWD KALAHI-CIDSS NCDDP Program Guidelines (NEDA Board-approved, 2013)',
    isActive: true,
    programType: 'livelihood',
    services: ['training_seminar', 'community_service'],
  },
  {
    id: uuidv7(),
    name: 'Walang Gutom Program (Food Stamp)',
    category: 'Food & Nutrition',
    waitingPeriodDays: 0,
    requiredDocuments: [
      'NHTS-PR / Listahanan reference or DSWD validation',
      'Valid ID of household grantee',
      'Barangay Certificate of Indigency',
      'Household composition certification',
    ],
    fundSources: ['DSWD - Walang Gutom Food Stamp'],
    legalBasis: 'EO 44 s. 2023 (Walang Gutom 2027: Food Stamp Program)',
    isActive: true,
    programType: 'supplemental_feeding',
    services: ['food_pack', 'health_checkup'],
  },
  {
    id: uuidv7(),
    name: 'UPLIFT (Economic Empowerment)',
    category: 'Livelihood',
    waitingPeriodDays: 0,
    requiredDocuments: [
      'Valid ID of participant',
      'Barangay Certificate of Indigency',
      'NHTS-PR / Listahanan reference or DSWD validation',
      'Household savings-group or association endorsement',
    ],
    fundSources: ['DSWD - UPLIFT'],
    legalBasis: 'EO 110 s. 2026 (Unified Package for Livelihoods, Industry, Food, and Transport)',
    isActive: true,
    programType: 'livelihood',
    services: ['livelihood_seed', 'training_seminar'],
  },

  // ---- GAD summary-report technical/legal programs (2026-09-28) ----------
  // Seeded so the summary report's columns can derive from the programs table;
  // each maps to a reference GAD database column. Intervention logging via the
  // existing picker attaches program_id, which the report counts. Programs
  // outside the typed catalog keep `programType: null` — they remain real
  // PPAs, just not ones the enrollments/AICS-budget phase keys off.
  {
    id: uuidv7(),
    name: 'Assistive Device Support',
    category: 'PWD Welfare',
    waitingPeriodDays: 30,
    requiredDocuments: [
      'Valid ID of claimant',
      'Barangay Certificate of Indigency',
      'Medical certificate / quotation for the device',
    ],
    fundSources: ['LGU - Municipal', 'DSWD'],
    legalBasis: 'RA 7277 (Magna Carta for Disabled Persons); RA 10754',
    isActive: true,
    programType: 'disability_aid',
    services: ['medical_assistance', 'scsr_generated'],
  },
  {
    id: uuidv7(),
    name: 'Legal Referral (PAO)',
    category: 'Legal',
    waitingPeriodDays: 0,
    requiredDocuments: ['Valid ID of client', 'Referral letter (if any)', 'Brief narrative of situation'],
    fundSources: ['LGU - Municipal'],
    legalBasis: 'RA 9999 (Free Legal Assistance Act); PAO Operations Manual',
    isActive: true,
    programType: 'legal_referral',
    services: ['referral_pao', 'legal_assistance'],
  },
  {
    id: uuidv7(),
    name: 'Referral – Others',
    category: 'Legal',
    waitingPeriodDays: 0,
    requiredDocuments: ['Valid ID of client', 'Referral letter (if any)', 'Brief narrative of situation'],
    fundSources: ['LGU - Municipal'],
    legalBasis: 'RA 7160 (Local Government Code)',
    isActive: true,
    programType: 'legal_referral',
    services: ['referral_pao'],
  },
  {
    id: uuidv7(),
    name: 'Birth Discrepancy Assistance',
    category: 'Technical',
    waitingPeriodDays: 15,
    requiredDocuments: [
      'Valid ID of client / parent (if minor)',
      'PSA Birth Certificate',
      'Affidavit of discrepancy / supporting documents',
    ],
    fundSources: ['LGU - Municipal', 'DSWD - AICS'],
    legalBasis: 'RA 9048; RA 10172 (clerical error / correction of first name)',
    isActive: true,
    programType: null,
    services: ['scsr_generated'],
  },
  {
    id: uuidv7(),
    name: 'Case Study Report (CSR)',
    category: 'Technical',
    waitingPeriodDays: 0,
    requiredDocuments: ['Valid ID of client', 'Referral letter (if any)'],
    fundSources: ['LGU - Municipal'],
    legalBasis: 'RA 9433 (Magnificat Act — MSWDO)',
    isActive: true,
    programType: null,
    services: ['scsr_generated'],
  },
  {
    id: uuidv7(),
    name: 'Home Visit',
    category: 'Technical',
    waitingPeriodDays: 0,
    requiredDocuments: ['Valid ID of client'],
    fundSources: ['LGU - Municipal'],
    legalBasis: 'RA 7160 (Local Government Code)',
    isActive: true,
    programType: null,
    services: ['home_visit'],
  },
  {
    id: uuidv7(),
    name: 'PhilHealth Assistance',
    category: 'Medical',
    waitingPeriodDays: 7,
    requiredDocuments: [
      'Valid ID of claimant',
      'PhilHealth member data record',
      'Medical certificate / hospital bill (depending on need)',
    ],
    fundSources: ['PhilHealth', 'LGU - Municipal'],
    legalBasis: 'RA 11223 (Universal Health Care Act)',
    isActive: true,
    programType: 'medical',
    services: ['medical_assistance', 'health_checkup'],
  },
  {
    id: uuidv7(),
    name: 'Child Custody Support',
    category: 'Technical',
    waitingPeriodDays: 0,
    requiredDocuments: ['Valid ID of parent / guardian', 'Referral letter (if any)'],
    fundSources: ['LGU - Municipal', 'DSWD'],
    legalBasis: 'RA 7610; Family Code of the Philippines (EO 209)',
    isActive: true,
    programType: 'child_welfare',
    services: ['legal_assistance', 'crisis_counseling', 'scsr_generated'],
  },
  {
    id: uuidv7(),
    name: 'Balik Probinsya Assistance',
    category: 'Technical',
    waitingPeriodDays: 7,
    requiredDocuments: [
      'Valid ID of claimant',
      'Barangay Certificate of Indigency',
      'Proof of return / provincial relocation plan',
    ],
    fundSources: ['DSWD - BAS'],
    legalBasis: 'EO 114 s. 2020 (Balik Probinsya, Bagong Pag-asa Program)',
    isActive: true,
    programType: 'disaster_relief',
    services: ['transport_assistance', 'financial_grant', 'scsr_generated'],
  },
  {
    id: uuidv7(),
    name: 'Travel Assessment',
    category: 'Technical',
    waitingPeriodDays: 7,
    requiredDocuments: ['Valid ID of claimant', 'Medical appointment slip / referral (if medical-related)'],
    fundSources: ['LGU - Municipal'],
    legalBasis: 'RA 7160 (Local Government Code)',
    isActive: true,
    programType: null,
    services: ['transport_assistance'],
  },
];

export async function seedPrograms(dataSource: DataSource) {
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
        `INSERT INTO programs (id, name, category, waiting_period_days, legal_basis, is_active, program_type)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [prog.id, prog.name, prog.category, prog.waitingPeriodDays, prog.legalBasis, prog.isActive, prog.programType],
      );

      for (const fundSource of prog.fundSources) {
        await q.query(
          `INSERT INTO program_fund_sources (program_id, name)
           VALUES ($1, $2)`,
          [prog.id, fundSource],
        );
      }

      for (const documentKey of prog.requiredDocuments) {
        await q.query(
          `INSERT INTO program_required_documents (program_id, document_key, mandatory)
           VALUES ($1, $2, $3)`,
          [prog.id, documentKey, !OPTIONAL_DOCUMENT_KEYS.has(documentKey)],
        );
      }

      // Program → Services matrix (spec Appendix B): a logged intervention is
      // a service the chosen program actually renders, so the logging UI
      // offers only these rows.
      for (const service of prog.services) {
        await q.query(
          `INSERT INTO program_services (program_id, intervention_type)
           VALUES ($1, $2)`,
          [prog.id, service],
        );
      }

      inserted.push(`  SEED  ${prog.name} [${prog.programType ?? 'untyped'}] (${prog.services.length} services)`);
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

if (require.main === module) {
  main().catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
}