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

const AGENCIES: { code: string; email: string; password: string; firstName: string; lastName: string; phone: string }[] = [
  { code: 'RHU', email: 'rhu.staff@norzagaray.test', password: 'rhu123', firstName: 'RHU', lastName: 'Staff', phone: '09179999001' },
  { code: 'WCPD', email: 'wcpd.staff@norzagaray.test', password: 'wcpd123', firstName: 'WCPD', lastName: 'Staff', phone: '09179999002' },
  { code: 'PESO', email: 'peso.staff@norzagaray.test', password: 'peso123', firstName: 'PESO', lastName: 'Staff', phone: '09179999003' },
  { code: 'DILG', email: 'dilg.staff@norzagaray.test', password: 'dilg123', firstName: 'DILG', lastName: 'Staff', phone: '09179999004' },
  { code: 'DSWD', email: 'dswd.staff@norzagaray.test', password: 'dswd123', firstName: 'DSWD', lastName: 'Staff', phone: '09179999005' },
  { code: 'DepEd', email: 'deped.staff@norzagaray.test', password: 'deped123', firstName: 'DepEd', lastName: 'Staff', phone: '09179999006' },
];

const BASE_ACCOUNTS: { key: string; email: string; role: string; firstName: string; middleName?: string; lastName: string; nameExtension?: string; phone: string }[] = [
  { key: 'admin', email: 'admin@mswdo.test', role: 'admin', firstName: 'Rosario', middleName: 'G.', lastName: 'Mendoza', phone: '09171000001' },
  { key: 'worker1', email: 'worker1@mswdo.test', role: 'social_worker', firstName: 'Juan', lastName: 'Dela Cruz', phone: '09171000002' },
  { key: 'worker2', email: 'worker2@mswdo.test', role: 'social_worker', firstName: 'Lorna', middleName: 'B.', lastName: 'Santos', phone: '09171000003' },
  { key: 'claimant1', email: 'pedro.claimant@test.com', role: 'claimant', firstName: 'Pedro', middleName: 'P.', lastName: 'Reyes', phone: '09171000005' },
  { key: 'claimant2', email: 'ana.claimant@test.com', role: 'claimant', firstName: 'Ana Marie', middleName: 'L.', lastName: 'Fernandez', phone: '09171000006' },
  { key: 'mayor', email: 'mayor@mswdo.test', role: 'mayor', firstName: 'Felicisimo', middleName: 'I.', lastName: 'Santiago', nameExtension: 'Jr.', phone: '09171000007' },
  { key: 'auditor', email: 'auditor@mswdo.test', role: 'auditor', firstName: 'Teresita', middleName: 'Q.', lastName: 'Valdez', phone: '09171000008' },
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
  firstName: string;
  middleName?: string;
  lastName: string;
  nameExtension?: string;
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
      firstName: a.firstName,
      middleName: a.middleName,
      lastName: a.lastName,
      nameExtension: a.nameExtension,
      phone: a.phone,
    });
  }

  for (const b of BARANGAYS) {
    accounts.push({
      email: `coordinator.${b.slug}@mswdo.test`,
      password: 'coordinator123',
      role: 'coordinator',
      firstName: b.name,
      lastName: 'Coordinator',
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
      firstName: a.firstName,
      lastName: a.lastName,
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
        `INSERT INTO users (email, password, role, first_name, middle_name, last_name, name_extension, phone, is_active, email_verified)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true,true)
         ON CONFLICT (email) DO NOTHING`,
        [acct.email, hash, acct.role, acct.firstName, acct.middleName ?? null, acct.lastName, acct.nameExtension ?? null, acct.phone],
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
