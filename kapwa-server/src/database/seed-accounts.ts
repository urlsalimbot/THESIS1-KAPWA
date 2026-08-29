import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { AppDataSource } from './data-source';

const SALT_ROUNDS = 12;

const BARANGAYS: { slug: string; name: string }[] = [
  { slug: 'bigte', name: 'Bigte' },
  { slug: 'matictic', name: 'Matictic' },
  { slug: 'partida', name: 'Partida' },
  { slug: 'sanmateo', name: 'San Mateo' },
  { slug: 'pinagtulayan', name: 'Pinagtulayan' },
  { slug: 'bitungol', name: 'Bitungol' },
  { slug: 'bangkal', name: 'Bangkal' },
  { slug: 'poblacion', name: 'Poblacion' },
  { slug: 'fvr', name: 'Friendship Village Resources (FVR)' },
  { slug: 'tigbe', name: 'Tigbe' },
  { slug: 'minuyan', name: 'Minuyan' },
  { slug: 'sanlorenzo', name: 'San Lorenzo' },
  { slug: 'baraka', name: 'Baraka' },
];

const AGENCIES: { code: string; email: string; password: string; fullName: string; phone: string }[] = [
  { code: 'RHU', email: 'rhu.staff@norzagaray.test', password: 'rhu123', fullName: 'RHU Staff', phone: '09179999001' },
  { code: 'WCPD', email: 'wcpd.staff@norzagaray.test', password: 'wcpd123', fullName: 'WCPD Staff', phone: '09179999002' },
  { code: 'PESO', email: 'peso.staff@norzagaray.test', password: 'peso123', fullName: 'PESO Staff', phone: '09179999003' },
  { code: 'DILG', email: 'dilg.staff@norzagaray.test', password: 'dilg123', fullName: 'DILG Staff', phone: '09179999004' },
  { code: 'DSWD', email: 'dswd.staff@norzagaray.test', password: 'dswd123', fullName: 'DSWD Staff', phone: '09179999005' },
  { code: 'DepEd', email: 'deped.staff@norzagaray.test', password: 'deped123', fullName: 'DepEd Staff', phone: '09179999006' },
];

const BASE_ACCOUNTS: { key: string; email: string; role: string; fullName: string; phone: string }[] = [
  { key: 'admin', email: 'admin@mswdo.test', role: 'admin', fullName: 'Rosario G. Mendoza', phone: '09171000001' },
  { key: 'worker1', email: 'worker1@mswdo.test', role: 'social_worker', fullName: 'Juan Dela Cruz', phone: '09171000002' },
  { key: 'worker2', email: 'worker2@mswdo.test', role: 'social_worker', fullName: 'Lorna B. Santos', phone: '09171000003' },
  { key: 'claimant1', email: 'pedro.claimant@test.com', role: 'claimant', fullName: 'Pedro P. Reyes', phone: '09171000005' },
  { key: 'claimant2', email: 'ana.claimant@test.com', role: 'claimant', fullName: 'Ana Marie L. Fernandez', phone: '09171000006' },
  { key: 'mayor', email: 'mayor@mswdo.test', role: 'mayor', fullName: 'Felicisimo I. Santiago', phone: '09171000007' },
  { key: 'auditor', email: 'auditor@mswdo.test', role: 'auditor', fullName: 'Teresita Q. Valdez', phone: '09171000008' },
];

const BASE_CREDENTIALS: Record<string, string> = {
  admin: 'admin123',
  worker1: 'worker123',
  worker2: 'worker123',
  claimant1: 'claimant123',
  claimant2: 'claimant123',
  mayor: 'mayor123',
  auditor: 'auditor123',
};

interface SeedAccount {
  email: string;
  password: string;
  role: string;
  fullName: string;
  phone: string;
  assignedBarangay?: string;
  permittedBarangays?: string[];
}

function buildAccounts(): SeedAccount[] {
  const accounts: SeedAccount[] = [];

  for (const a of BASE_ACCOUNTS) {
    accounts.push({
      email: a.email,
      password: BASE_CREDENTIALS[a.key],
      role: a.role,
      fullName: a.fullName,
      phone: a.phone,
    });
  }

  for (const b of BARANGAYS) {
    accounts.push({
      email: `coordinator.${b.slug}@mswdo.test`,
      password: 'coordinator123',
      role: 'coordinator',
      fullName: `${b.name} Coordinator`,
      phone: `09171001${String(BARANGAYS.indexOf(b) + 1).padStart(2, '0')}`,
      assignedBarangay: b.name,
      permittedBarangays: [b.name],
    });
  }

  for (const a of AGENCIES) {
    accounts.push({
      email: a.email,
      password: a.password,
      role: 'agency_staff',
      fullName: a.fullName,
      phone: a.phone,
    });
  }

  return accounts;
}

const AGENCY_LINKS: { code: string; emails: string[] }[] = [
  { code: 'RHU', emails: ['rhu.staff@norzagaray.test'] },
  { code: 'WCPD', emails: ['wcpd.staff@norzagaray.test'] },
  { code: 'PESO', emails: ['peso.staff@norzagaray.test'] },
  { code: 'DILG', emails: ['dilg.staff@norzagaray.test'] },
  { code: 'DSWD', emails: ['dswd.staff@norzagaray.test'] },
  { code: 'DepEd', emails: ['deped.staff@norzagaray.test'] },
  { code: 'MSWDO', emails: ['admin@mswdo.test', 'worker1@mswdo.test', 'worker2@mswdo.test'] },
];

async function seedAccounts(dataSource: DataSource) {
  const q = dataSource.createQueryRunner();
  await q.connect();

  try {
    const accounts = buildAccounts();

    const hashed = await Promise.all(
      accounts.map(async (acct) => ({
        acct,
        hash: await bcrypt.hash(acct.password, SALT_ROUNDS),
      })),
    );

    for (const { acct, hash } of hashed) {
      await q.query(
        `INSERT INTO users (email, password, role, full_name, phone, is_active, email_verified)
         VALUES ($1,$2,$3,$4,$5,true,true)
         ON CONFLICT (email) DO NOTHING`,
        [acct.email, hash, acct.role, acct.fullName, acct.phone],
      );
    }

    // 3NF: seed barangay assignments into the child table instead of legacy columns.
    const seededBarangays = hashed.filter(h => h.acct.assignedBarangay);
    for (const { acct } of seededBarangays) {
      const rows = await q.query(
        `SELECT id FROM users WHERE email = $1 LIMIT 1`,
        [acct.email],
      );
      if (!rows.length) continue;
      const userId = rows[0].id;
      await q.query(
        `DELETE FROM user_barangay_assignments WHERE user_id = $1`,
        [userId],
      );
      if (acct.assignedBarangay) {
        await q.query(
          `INSERT INTO user_barangay_assignments (user_id, barangay, is_primary) VALUES ($1,$2,true)`,
          [userId, acct.assignedBarangay],
        );
      }
      for (const b of acct.permittedBarangays ?? []) {
        await q.query(
          `INSERT INTO user_barangay_assignments (user_id, barangay, is_primary) VALUES ($1,$2,false)`,
          [userId, b],
        );
      }
    }

    for (const link of AGENCY_LINKS) {
      await q.query(
        `UPDATE users SET agency_id = (SELECT id FROM agencies WHERE code = $1)
         WHERE email = ANY($2)`,
        [link.code, link.emails],
      );
    }

    console.log('Accounts seeded: ' + accounts.length);
    console.log('');
    console.log('  Credentials:');
    for (const acct of accounts) {
      console.log(`    ${acct.email.padEnd(42)} → ${acct.password}`);
    }
  } finally {
    await q.release();
  }
}

async function main() {
  await AppDataSource.initialize();
  console.log('Seeding accounts...');
  await seedAccounts(AppDataSource);
  await AppDataSource.destroy();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
