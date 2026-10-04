/**
 * Analytics seed — 300 beneficiaries with cases/interventions/households so
 * every analytics endpoint has enough data locally:
 *   demographics   (300 persons, all age/sex/civil-status/occupation/income
 *                   cells >= MIN_CELL so nothing gets suppressed)
 *   concentration  (9 barangays with cases + interventions)
 *   equity         (households across 9 barangays, ~20% 4Ps roles)
 *   inequality     (>=20 households with estimated_income > 0)
 *   forecast       (cases + interventions spread over the last 24 months
 *                   with seasonality so Holt's linear model has signal)
 *   associations   (300 transactions, engineered service co-occurrence so
 *                   support/confidence rules actually appear)
 *
 * Direct DB inserts (no API), deterministic pseudo-random data, idempotent:
 * skips everything when persons.surname LIKE 'AnalyticsSeed%' already exists.
 * Pass --reset to delete prior AnalyticsSeed rows and re-seed.
 *
 * Run: npx ts-node src/database/seed-analytics.ts
 */
import { randomUUID } from 'crypto';
import { AppDataSource } from './data-source';

const N = 300; // beneficiaries / persons / cases
const PREFIX = 'AnalyticsSeed';
const BARANGAYS = ['Bigte', 'FVR', 'Matictic', 'Minuyan', 'Mt. Orion', 'Poblacion', 'San Mateo', 'Partida', 'Tigbe'];

// --- deterministic PRNG (mulberry32) so re-runs on a wiped DB reproduce exactly
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260929);

const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];

const OCCUPATIONS = [
  'Farmer', 'Street Vendor', 'Construction Worker', 'Tricycle Driver',
  'Housewife', 'Sari-sari Store Owner', 'Fisherfolk', 'Laundry Worker',
  'Retired', 'Unemployed', 'Student', 'Security Guard',
];

const FIRST_NAMES = ['Juan', 'Maria', 'Pedro', 'Ana', 'Jose', 'Liza', 'Ramon', 'Carla', 'Miguel', 'Nena', 'Rico', 'Grace', 'Dante', 'Fe', 'Nestor', 'Aida'];

// Age distribution must keep every demographics age-sex cell >= MIN_CELL (5).
const AGE_BRACKETS: Array<[number, number, number]> = [
  [0, 5, 8], [6, 12, 8], [13, 17, 8], [18, 24, 15],
  [25, 34, 20], [35, 44, 16], [45, 59, 15], [60, 85, 10],
];

function ageFor(): number {
  let roll = rand() * 100;
  for (const [min, max, weight] of AGE_BRACKETS) {
    if (roll < weight) return min + Math.floor(rand() * (max - min + 1));
    roll -= weight;
  }
  return 30;
}

const dobFor = (age: number) => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - age);
  d.setMonth(d.getMonth() - Math.floor(rand() * 11));
  d.setDate(1 + Math.floor(rand() * 28));
  return d.toISOString().slice(0, 10);
};

// Seasonality for forecast: weight per day-of-year (Dec + typhoon months high,
// dry months low) → 24-month series that is NOT flat.
const seasonalWeight = (dayOfYear: number) => 1 + 0.8 * Math.sin((2 * Math.PI * (dayOfYear - 60)) / 365);

function caseCreatedAt(i: number): Date {
  const today = new Date();
  const total = 24 * 30; // ~24 months in days
  let offset = 0;
  const target = (i / N) * total; // 0..720 deterministic, weighted by season
  let cursor = 0;
  let seed = 0;
  while (cursor < target) {
    const doy = (today.getTime() / 86400000 - seed) % 365;
    seed++;
    cursor += seasonalWeight(doy);
    offset++;
  }
  const d = new Date(today.getTime() - (offset + Math.floor(rand() * 20)) * 86400000);
  return d;
}

const SERVICES: Array<{ name: string; amount: number; fundSource: string }> = [
  { name: 'AICS — Assistance to Individuals in Crisis Situation', amount: 3500, fundSource: 'DSWD - AICS' },
  { name: 'AICS — Assistance to Individuals in Crisis Situation', amount: 1200, fundSource: 'LGU - Municipal' },
  { name: 'AICS — Assistance to Individuals in Crisis Situation', amount: 5000, fundSource: 'LGU - Municipal' },
  { name: 'AICS — Assistance to Individuals in Crisis Situation', amount: 8000, fundSource: 'DSWD - AICS' },
  { name: 'Cash for Work', amount: 1500, fundSource: 'LGU - Municipal' },
  { name: 'Sustainable Livelihood Program', amount: 5000, fundSource: 'DSWD - SLP' },
  { name: 'Social Pension for Indigent Senior Citizens', amount: 5000, fundSource: 'DSWD - Social Pension Program' },
  { name: 'PWD Assistance', amount: 3000, fundSource: 'LGU - Municipal' },
  { name: 'AICS — Assistance to Individuals in Crisis Situation', amount: 3000, fundSource: 'DSWD - AICS' },
];

// Engineered co-occurrence: the assistance programs appear together so
// pairwise rules pass minSupport (0.05) + minConfidence (0.5).
const COMPANION: Record<string, string> = {
  'AICS — Assistance to Individuals in Crisis Situation': 'Medical Assistance',
  'Medical Assistance': 'Burial Assistance',
  'Burial Assistance': 'Food Assistance',
  'Educational Assistance': 'Medical Assistance',
  'Emergency Cash/Food for Work': 'Food Assistance',
  'Sustainable Livelihood Program': 'Food Assistance',
  'Social Pension for Indigent Senior Citizens': 'Medical Assistance',
  'PWD Assistance': 'Medical Assistance',
  'Food Assistance': 'Educational Assistance',
  'Financial Assistance (General)': 'Food Assistance',
};

const incomeFor = (): number | null => {
  const roll = rand();
  if (roll < 0.08) return null; // excludedMissing bucket
  const base = [3000, 7000, 12000, 25000, 45000][Math.floor(rand() * 5)];
  return base + Math.floor(rand() * 2000);
};

async function main(): Promise<void> {
  await AppDataSource.initialize();

  const reset = process.argv.includes('--reset');
  if (reset) {
    console.log('reset — deleting existing AnalyticsSeed rows');
    await AppDataSource.query(`
      DELETE FROM case_interventions WHERE case_id IN (
        SELECT id::text FROM cases WHERE beneficiary_id IN (
          SELECT id FROM beneficiaries WHERE person_id IN (
            SELECT id FROM persons WHERE surname LIKE '${PREFIX}%')))
    `);
    await AppDataSource.query(`DELETE FROM beneficiary_roles WHERE person_id IN (SELECT id FROM persons WHERE surname LIKE '${PREFIX}%')`);
    await AppDataSource.query(`DELETE FROM household_memberships WHERE person_id IN (SELECT id FROM persons WHERE surname LIKE '${PREFIX}%')`);
    await AppDataSource.query(`DELETE FROM cases WHERE beneficiary_id IN (SELECT id FROM beneficiaries WHERE person_id IN (SELECT id FROM persons WHERE surname LIKE '${PREFIX}%'))`);
    await AppDataSource.query(`DELETE FROM beneficiaries WHERE person_id IN (SELECT id FROM persons WHERE surname LIKE '${PREFIX}%')`);
    await AppDataSource.query(`DELETE FROM households WHERE access_card_code LIKE 'ANC-ANL-%'`);
    await AppDataSource.query(`DELETE FROM persons WHERE surname LIKE '${PREFIX}%'`);
  }

  const existing = await AppDataSource.query(
    `SELECT 1 FROM persons WHERE surname LIKE '${PREFIX}%' LIMIT 1`,
  );
  if (existing[0]) {
    console.log(`skip — ${PREFIX}* already seeded`);
    await AppDataSource.destroy();
    return;
  }

  const q = AppDataSource.createQueryRunner();
  await q.connect();
  await q.startTransaction();

  const insertMany = async (table: string, columns: string[], rows: Array<Array<string | number | boolean | null>>) => {
    const placeholders = rows.map((_, r) => `(${columns.map((_, c) => `$${r * columns.length + c + 1}`).join(',')})`).join(',');
    const flat = rows.flat();
    await q.query(`INSERT INTO ${table} (${columns.join(',')}) VALUES ${placeholders}`, flat);
  };

  // Household size distribution: 160 households covering all sizes 1..7 and 8+
  // with exactly 5 households each (MIN_CELL) so the demographics householdSize
  // cells are never suppressed: 125 singles + 5 each of size 2,3,4,5,6,7,8.
  // 125 + 5*(2+3+4+5+6+7+8) = 300 persons.
  const sizes: number[] = [
    ...new Array(125).fill(1), ...new Array(5).fill(2), ...new Array(5).fill(3),
    ...new Array(5).fill(4), ...new Array(5).fill(5), ...new Array(5).fill(6),
    ...new Array(5).fill(7), ...new Array(5).fill(8),
  ];
  for (let g = sizes.length - 1; g > 0; g--) {
    const j = Math.floor(rand() * (g + 1));
    [sizes[g], sizes[j]] = [sizes[j], sizes[g]];
  }

  const persons: Array<Array<string | number | null>> = [];
  const households: Array<Array<string | number | null>> = [];
  const memberships: Array<Array<string | number | boolean | null>> = [];
  const beneficiaries: Array<Array<string | null>> = [];
  const cases: Array<Array<string | number | null>> = [];
  const interventions: Array<Array<string | number | null>> = [];
  const roles: Array<Array<string | null>> = [];

  let householdSeq = 0;
  let groupIdx = 0;
  let inGroup = 0;
  let householdId: string | null = null;
  for (let i = 0; i < N; i++) {
    const suffix = String(i + 1).padStart(3, '0');
    const gender = rand() < 0.52 ? 'Female' : 'Male';
    const age = ageFor();
    const civilStatus = pick(['Married', 'Married', 'Single', 'Widowed', 'Divorced']);
    const occupation = age <= 17 ? 'Student' : pick(OCCUPATIONS);
    const barangay = BARANGAYS[Math.floor((i * 7) % BARANGAYS.length)];
    const income = incomeFor();

    const personId = randomUUID();
    persons.push([
      personId, `${PREFIX}${suffix}`, pick(FIRST_NAMES), 'A',
      gender, dobFor(age), `FILSYS-ANL-${suffix}`, 'Norzagaray, Bulacan',
      civilStatus, rand() < 0.6 ? `PHL-ANL-${suffix}` : null, occupation, income,
    ]);

    // Household membership: rotate through shuffled size groups; first member
    // creates the household, subsequent members of the group join it.
    if (inGroup >= sizes[groupIdx]) {
      groupIdx++;
      inGroup = 0;
      householdId = null;
    }
    if (!householdId) {
      householdId = randomUUID();
      householdSeq++;
      households.push([
        householdId, null, barangay, income, null,
        `ANC-ANL-${String(householdSeq).padStart(3, '0')}`,
      ]);
    }
    inGroup++;
    // Clustering features join household_memberships (INNER JOIN) — one row per
    // member; first member is household head (is_primary).
    memberships.push([randomUUID(), personId, householdId, inGroup === 1 ? 'Head' : pick(['Spouse', 'Child', 'Parent', 'Sibling']), inGroup === 1]);

    const beneficiaryId = randomUUID();
    beneficiaries.push([beneficiaryId, personId, householdId]);

    // Case: status active, created_at seasonal over last 24 months.
    const caseId = randomUUID();
    const created = caseCreatedAt(i);
    cases.push([
      caseId, `ANL-2026-${1000 + i}`, beneficiaryId, 'active',
      created.toISOString(), pick(['General', 'Indigent', 'Senior Citizen', 'PWD']),
    ]);

    // 1-3 interventions per case; second service engineered co-occurrence.
    const svcA = SERVICES[i % SERVICES.length];
    const count = 1 + (i % 3);
    const services = [svcA.name];
    if (count >= 2) {
      const comp = COMPANION[svcA.name] ?? 'AICS — Assistance to Individuals in Crisis Situation';
      services.push(comp);
    }
    if (count >= 3) services.push(pick(SERVICES).name);
    for (const svcName of services) {
      const svc = SERVICES.find(s => s.name === svcName) ?? svcA;
      const delivery = new Date(created.getTime() + (5 + (i % 40)) * 86400000);
      interventions.push([
        randomUUID(), caseId, svcName, 'FA', delivery.toISOString().slice(0, 10),
        svc.amount, pick(['Cash', 'In-kind']), svc.fundSource, 'Analytics seed intervention', 'MSWDO',
      ]);
    }

    // Beneficiary role: ~20% 4Ps (equity four_ps), rest generic categories.
    const roleRoll = i % 10;
    const roleCategory = roleRoll < 2 ? '4Ps Beneficiary' : roleRoll === 2 ? 'Senior Citizen' : roleRoll === 3 ? 'PWD' : 'General Beneficiary';
    roles.push([personId, householdId, roleCategory, `CAR-ANL-${suffix}`]);
  }

  try {
    await insertMany('persons', ['id', 'surname', 'first_name', 'middle_name', 'gender', 'dob', 'philsys_number', 'place_of_birth', 'civil_status', 'occupation', 'estimated_monthly_income'], persons);
    await insertMany('households', ['id', 'primary_beneficiary_id', 'barangay', 'estimated_income', 'verified_by', 'access_card_code'], households);
    await insertMany('beneficiaries', ['id', 'person_id', 'household_id'], beneficiaries);
    await insertMany('household_memberships', ['id', 'person_id', 'household_id', 'relationship', 'is_primary'], memberships);
    await insertMany('cases', ['id', 'control_no', 'beneficiary_id', 'status', 'created_at', 'client_category'], cases);
    await insertMany('case_interventions', ['id', 'case_id', 'service_name', 'category', 'delivery_date', 'amount', 'mode_of_delivery', 'fund_source', 'notes', 'delivered_by'], interventions);
    await insertMany('beneficiary_roles', ['person_id', 'household_id', 'category', 'access_card_code'], roles);
    await q.commitTransaction();
  } catch (err) {
    await q.rollbackTransaction();
    throw err;
  } finally {
    await q.release();
    await AppDataSource.destroy();
  }

  console.log(`seeded: persons=${persons.length} households=${households.length} memberships=${memberships.length} beneficiaries=${beneficiaries.length} cases=${cases.length} interventions=${interventions.length} roles=${roles.length}`);
}

main().catch(e => {
  console.error('seed-analytics failed:', e.message);
  process.exit(1);
});