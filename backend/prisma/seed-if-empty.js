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

  if (budgets + projects + contracts + contractors > 0) {
    console.log('Existing application data found; skipping initial seed.');
    return;
  }

  console.log('No application data found; running the initial seed.');
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
