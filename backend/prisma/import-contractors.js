const fs = require('node:fs');
const path = require('node:path');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { isVerifiedDirectoryName } = require('./contractor-name-quality');

const DATASET = 'PPMO contract_details.csv';
const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/open_budget_nepal?schema=public';
const sourcePath = path.resolve(process.cwd(), process.env.CONTRACTOR_DATA_PATH || '../shared/data/contractor/contract_details.csv');
const prisma = new PrismaClient({ adapter: new PrismaPg(databaseUrl) });

function parseCsv(content) {
  const rows = []; let row = []; let cell = ''; let quoted = false;
  for (let index = 0; index < content.length; index += 1) {
    const char = content[index]; const next = content[index + 1];
    if (char === '"') { if (quoted && next === '"') { cell += '"'; index += 1; } else quoted = !quoted; continue; }
    if (char === ',' && !quoted) { row.push(cell); cell = ''; continue; }
    if ((char === '\n' || char === '\r') && !quoted) { if (char === '\r' && next === '\n') index += 1; row.push(cell); if (row.some(Boolean)) rows.push(row); row = []; cell = ''; continue; }
    cell += char;
  }
  if (cell || row.length) { row.push(cell); if (row.some(Boolean)) rows.push(row); }
  return rows;
}

function readRecords() {
  const rows = parseCsv(fs.readFileSync(sourcePath, 'utf8'));
  const headers = rows.shift().map(value => value.replace(/^\uFEFF/, '').trim());
  return rows.map(values => Object.fromEntries(headers.map((header, index) => [header, (values[index] || '').trim()])));
}

const field = (row, name) => row[`contractRecordsTO.${name}`] || '';
const nullable = value => value && !value.startsWith('--Select') ? value : null;
const normalize = value => value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const decimal = value => Number.isFinite(Number(value)) ? value : '0';
const integer = value => Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : null;
function date(value) {
  if (!value) return null;
  const match = value.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!match) return null;
  const parsed = new Date(`${match[3]}-${match[2]}-${match[1]}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function main() {
  const rows = readRecords();
  const namesByPan = new Map();
  for (const row of rows) for (const index of [1, 2, 3]) {
    const name = field(row, `contractorName${index}`); const pan = field(row, `vat_no${index}`);
    if (!name || !pan) continue;
    const counts = namesByPan.get(pan) || new Map();
    counts.set(name, (counts.get(name) || 0) + 1); namesByPan.set(pan, counts);
  }
  const canonicalNameByPan = new Map(Array.from(namesByPan, ([pan, counts]) => [pan, Array.from(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0]]));
  const contractorCache = new Map(); let links = 0;

  for (const [rowIndex, row] of rows.entries()) {
    const code = field(row, 'contractId') || row.contract_id;
    const contract = await prisma.contract.upsert({
      where: { contractCode: code },
      update: contractData(row),
      create: { contractCode: code, ...contractData(row) },
    });
    // This source is authoritative for the members of its own contracts.
    // Replace stale fixture links without touching unrelated contracts.
    await prisma.contractContractor.deleteMany({ where: { contractId: contract.id } });
    for (const index of [1, 2, 3]) {
      const sourceName = field(row, `contractorName${index}`); if (!sourceName) continue;
      const pan = nullable(field(row, `vat_no${index}`));
      const name = pan ? canonicalNameByPan.get(pan) || sourceName : sourceName;
      if (!isVerifiedDirectoryName(name, pan)) continue;
      const canonicalKey = pan ? `pan:${pan}` : `name:${normalize(name)}`;
      let contractor = contractorCache.get(canonicalKey);
      if (!contractor) {
        contractor = await prisma.contractor.upsert({
          where: { canonicalKey },
          update: { name, normalizedName: normalize(name), vatNumber: pan, country: nullable(field(row, `contractorCountry${index}`)), contractorType: 'Organization', sourceDataset: DATASET },
          create: { canonicalKey, name, normalizedName: normalize(name), vatNumber: pan, country: nullable(field(row, `contractorCountry${index}`)), contractorType: 'Organization', sourceDataset: DATASET },
        });
        contractorCache.set(canonicalKey, contractor);
      }
      await prisma.contractContractor.upsert({
        where: { contractId_contractorId: { contractId: contract.id, contractorId: contractor.id } },
        update: { sharePercentage: nullable(field(row, `sharedPercentage${index}`)) ? decimal(field(row, `sharedPercentage${index}`)) : null },
        create: { contractId: contract.id, contractorId: contractor.id, sharePercentage: nullable(field(row, `sharedPercentage${index}`)) ? decimal(field(row, `sharedPercentage${index}`)) : null },
      });
      links += 1;
    }
    if ((rowIndex + 1) % 250 === 0) console.log(`Imported ${rowIndex + 1}/${rows.length} contracts`);
  }
  const [contractors, contracts] = await Promise.all([prisma.contractor.count({ where: { sourceDataset: DATASET } }), prisma.contract.count({ where: { sourceDataset: DATASET } })]);
  console.log({ contractors, contracts, links, source: sourcePath });
}

function contractData(row) {
  return {
    contractName: field(row, 'contractName') || field(row, 'contractId'), contractAmount: decimal(field(row, 'contractAmount')),
    contractDate: date(field(row, 'contractDate')), startDate: date(field(row, 'startDate')), endOrCompleteDate: date(field(row, 'endOrCompleteDate')), deliveryDate: date(field(row, 'deliveryDate')),
    contractStatus: nullable(field(row, 'contractStatus')), percentageOfCompletion: nullable(field(row, 'percentageOfCompletion')) ? decimal(field(row, 'percentageOfCompletion')) : null,
    totalPayment: nullable(field(row, 'totalPayment')) ? decimal(field(row, 'totalPayment')) : null, outstandingValue: nullable(field(row, 'outstandingValue')) ? decimal(field(row, 'outstandingValue')) : null,
    estimatedCost: nullable(field(row, 'estimatedCost')) ? decimal(field(row, 'estimatedCost')) : null, procurementMethod: nullable(field(row, 'procurementMethodId')), procurementCategory: nullable(field(row, 'procurementCategoryId')),
    biddingProcess: nullable(field(row, 'biddingProcess')), publicEntityName: nullable(field(row, 'publicEntityName')), fiscalYear: nullable(field(row, 'fiscalYear')), projectDescription: nullable(field(row, 'projectDescription')), sourceOfFund: nullable(field(row, 'sourceOfFund')),
    contractAddress: nullable(field(row, 'contractAddress')), contractType: nullable(field(row, 'contractType')), jointVentureName: field(row, 'contractorType') === 'Joint Venture' ? nullable(field(row, 'contractorGenericName')) : null,
    beneficialOwner: nullable(field(row, 'beneficialOwner')), ifbNumber: nullable(field(row, 'ifbNo')), donorParty: nullable(field(row, 'donorParty')), warrantyPeriod: integer(field(row, 'warrantyPeriod')),
    dlpStartDate: date(field(row, 'dlpStartDate')), dlpEndDate: date(field(row, 'dlpEndDate')), sourceDataset: DATASET,
  };
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
