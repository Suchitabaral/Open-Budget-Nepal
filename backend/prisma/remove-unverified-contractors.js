require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { isVerifiedDirectoryName } = require('./contractor-name-quality');

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required.');
const prisma = new PrismaClient({ adapter: new PrismaPg(databaseUrl) });
const DATASET = 'PPMO contract_details.csv';

async function main() {
  const rows = await prisma.contractor.findMany({
    where: { sourceDataset: DATASET },
    select: { id: true, name: true, vatNumber: true },
  });
  const candidates = rows.filter(row => !isVerifiedDirectoryName(row.name, row.vatNumber));
  const ids = candidates.map(row => row.id);
  if (!ids.length) {
    console.log('No unverified contractor profiles found.');
    return;
  }

  const result = await prisma.$transaction(async tx => {
    const links = await tx.contractContractor.deleteMany({ where: { contractorId: { in: ids } } });
    await tx.userFeedback.updateMany({ where: { contractorId: { in: ids } }, data: { contractorId: null } });
    const contractors = await tx.contractor.deleteMany({ where: { id: { in: ids }, sourceDataset: DATASET } });
    return { contractors: contractors.count, links: links.count };
  });
  console.log(JSON.stringify({ ...result, removed: candidates.map(row => ({ name: row.name, pan: row.vatNumber })) }, null, 2));
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
