const { spawnSync } = require('node:child_process');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required.');

const prisma = new PrismaClient({ adapter: new PrismaPg(databaseUrl) });

async function main() {
  const [budgets, projects, contracts, contractors] = await Promise.all([
    prisma.nationalBudgetSummary.count(),
    prisma.localGranularData.count(),
    prisma.contract.count(),
    prisma.contractor.count(),
  ]);

  if (budgets > 0 && projects > 0 && contracts > 0 && contractors > 0) {
    console.log('All core application datasets are present; skipping initial seed.');
    return;
  }

  console.log(`Core datasets are incomplete (budgets=${budgets}, projects=${projects}, contracts=${contracts}, contractors=${contractors}); rebuilding bundled development data.`);
  const result = spawnSync(process.execPath, ['prisma/seed.js'], {
    stdio: 'inherit',
    env: process.env,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
