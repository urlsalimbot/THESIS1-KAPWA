import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { AppDataSource } from './data-source';

const SALT_ROUNDS = 12;

const ACCOUNT = {
  admin:        { id: '10000000-0000-0000-0000-000000000001', email: 'admin@mswdo.test',       role: 'admin',          fullName: 'Rosario G. Mendoza',     phone: '09171000001' },
  worker1:      { id: '10000000-0000-0000-0000-000000000002', email: 'worker1@mswdo.test',     role: 'social_worker',  fullName: 'Juan Dela Cruz',         phone: '09171000002' },
  worker2:      { id: '10000000-0000-0000-0000-000000000003', email: 'worker2@mswdo.test',     role: 'social_worker',  fullName: 'Lorna B. Santos',        phone: '09171000003' },
  coordinator:  { id: '10000000-0000-0000-0000-000000000004', email: 'coordinator@mswdo.test', role: 'coordinator',    fullName: 'Emmanuel T. Reyes',      phone: '09171000004' },
  claimant1:    { id: '10000000-0000-0000-0000-000000000005', email: 'pedro.claimant@test.com',role: 'claimant',       fullName: 'Pedro P. Reyes',         phone: '09171000005' },
  claimant2:    { id: '10000000-0000-0000-0000-000000000006', email: 'ana.claimant@test.com',  role: 'claimant',       fullName: 'Ana Marie L. Fernandez', phone: '09171000006' },
  mayor:        { id: '10000000-0000-0000-0000-000000000007', email: 'mayor@mswdo.test',       role: 'mayor',          fullName: 'Felicisimo I. Santiago', phone: '09171000007' },
  auditor:      { id: '10000000-0000-0000-0000-000000000008', email: 'auditor@mswdo.test',     role: 'auditor',        fullName: 'Teresita Q. Valdez',     phone: '09171000008' },
  mfaAdmin:     { id: '10000000-0000-0000-0000-000000000009', email: 'mfa-admin@mswdo.test',   role: 'admin',          fullName: 'MFA Admin',              phone: null },
};

type AccountDef = typeof ACCOUNT[keyof typeof ACCOUNT];

const ACCOUNT_CREDENTIALS: Record<string, { password: string; mfaSecret: string | null }> = {
  admin:        { password: 'admin123',       mfaSecret: null },
  worker1:      { password: 'worker123',      mfaSecret: null },
  worker2:      { password: 'worker123',      mfaSecret: null },
  coordinator:  { password: 'coordinator123', mfaSecret: null },
  claimant1:    { password: 'claimant123',    mfaSecret: null },
  claimant2:    { password: 'claimant123',    mfaSecret: null },
  mayor:        { password: 'mayor123',       mfaSecret: null },
  auditor:      { password: 'auditor123',     mfaSecret: null },
  mfaAdmin:     { password: 'admin123',       mfaSecret: 'JBSWY3DPEHPK3PXP' },
};

function permittedBarangays(key: string): string[] {
  const map: Record<string, string[]> = {
    worker1: ['Bigte', 'Partida', 'Poblacion', 'Friendship Village Resources (FVR)', 'Tigbe', 'Matictic'],
    worker2: ['Matictic', 'San Mateo', 'Pinagtulayan', 'Minuyan', 'San Lorenzo', 'Baraka'],
    coordinator: ['Bigte', 'Matictic', 'Partida', 'San Mateo', 'Pinagtulayan', 'Bitungol', 'Bangkal', 'Poblacion', 'Friendship Village Resources (FVR)', 'Tigbe', 'Minuyan', 'San Lorenzo', 'Baraka'],
  };
  return map[key] || [];
}

async function seedAccounts(dataSource: DataSource) {
  const q = dataSource.createQueryRunner();
  await q.connect();

  try {
    const passwords = await Promise.all(
      Object.entries(ACCOUNT_CREDENTIALS).map(async ([key, cred]) => ({
        key,
        hash: await bcrypt.hash(cred.password, SALT_ROUNDS),
        mfaSecret: cred.mfaSecret,
      })),
    );

    for (const { key, hash, mfaSecret } of passwords) {
      const acct = ACCOUNT[key as keyof typeof ACCOUNT];
      if (!acct) continue;

      const bangs = permittedBarangays(key);

      await q.query(
        `INSERT INTO users (id, email, password, role, full_name, phone, permitted_barangays, is_active, email_verified, mfa_enabled, mfa_secret)
         VALUES ($1,$2,$3,$4,$5,$6,$7::text[],true,true,$8,$9)
         ON CONFLICT (id) DO NOTHING`,
        [acct.id, acct.email, hash, acct.role, acct.fullName, acct.phone, bangs, mfaSecret ? true : false, mfaSecret],
      );
    }

    console.log('Accounts seeded: ' + Object.keys(ACCOUNT).length);
    console.log('');
    console.log('  Credentials:');
    for (const [key, acct] of Object.entries(ACCOUNT)) {
      const cred = ACCOUNT_CREDENTIALS[key];
      console.log(`    ${key.padEnd(12)} → ${acct.email} / ${cred.password}`);
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
