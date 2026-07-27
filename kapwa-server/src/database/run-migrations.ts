import { AppDataSource } from './data-source';

async function main() {
  await AppDataSource.initialize();
  const migrations = await AppDataSource.runMigrations({ transaction: 'each' });
  console.log(`Ran ${migrations.length} migration(s):`);
  for (const m of migrations) {
    console.log(`  ${m.name}`);
  }
  await AppDataSource.destroy();
}

main().catch((err) => {
  console.error('Migration run failed:', err);
  process.exit(1);
});
