const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { normalizeContractorName } = require('./contractor-name-quality');

const DATASET = 'FY2081/82 curated project registry';
const sourcePath = path.resolve(process.cwd(), process.env.FY_PROJECT_DATA_PATH || '../shared/data/projects/fy2081-82-projects.json');
const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/open_budget_nepal?schema=public';
const prisma = new PrismaClient({ adapter: new PrismaPg(databaseUrl) });

const nullable = value => value === null || value === undefined || value === '' ? null : value;
const decimal = value => nullable(value) === null ? null : String(value);

function date(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function sourceCode(row) {
  const identity = [row.project_name, row.fiscal_year, row.contractor_name, row.package_scope].join('|');
  const digest = crypto.createHash('sha256').update(identity).digest('hex').slice(0, 20);
  return `FY-PROJECT-${row.fiscal_year.replace('/', '-')}-${digest}`;
}

function contractData(row) {
  return {
    contractName: row.project_name,
    contractAmount: decimal(row.original_contract_amount),
    revisedContractAmount: decimal(row.revised_contract_amount),
    contractDate: date(row.award_date),
    startDate: date(row.start_date),
    endOrCompleteDate: date(row.expected_completion_date),
    actualCompletionDate: date(row.actual_completion_date),
    percentageOfCompletion: decimal(row.completion_percentage),
    totalPayment: decimal(row.actual_disbursement),
    procurementCategory: nullable(row.procurement_category),
    fiscalYear: nullable(row.fiscal_year),
    municipality: nullable(row.municipality),
    packageScope: nullable(row.package_scope),
    projectDescription: nullable(row.package_scope),
    bidderId: nullable(row.bidder_id),
    sourceVerificationStatus: nullable(row.verification_status),
    jointVentureName: /\bJV\b|joint venture/i.test(row.contractor_name || '') ? row.contractor_name : null,
    sourceDataset: DATASET,
  };
}

async function main() {
  const rows = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  let links = 0;

  for (const row of rows) {
    const contractCode = sourceCode(row);
    const contract = await prisma.contract.upsert({
      where: { contractCode },
      update: contractData(row),
      create: { contractCode, ...contractData(row) },
    });

    await prisma.contractContractor.deleteMany({ where: { contractId: contract.id } });
    if (!row.contractor_name) continue;

    const normalizedName = normalizeContractorName(row.contractor_name);
    const pan = nullable(row.pan);
    const canonicalKey = pan ? `pan:${pan}` : `name:${normalizedName.toLowerCase()}`;
    const existing = await prisma.contractor.findFirst({
      where: {
        OR: [
          { canonicalKey },
          ...(pan ? [{ vatNumber: pan }] : []),
          { normalizedName: normalizedName.toLowerCase() },
        ],
      },
    });
    const contractor = existing ?? await prisma.contractor.create({
      data: {
        canonicalKey,
        name: normalizedName,
        normalizedName: normalizedName.toLowerCase(),
        vatNumber: pan,
        contractorType: 'Organization',
        sourceDataset: DATASET,
      },
    });
    await prisma.contractContractor.create({
      data: {
        contractId: contract.id,
        contractorId: contractor.id,
        verificationStatus: nullable(row.verification_status),
      },
    });
    links += 1;
  }

  const contracts = await prisma.contract.count({ where: { sourceDataset: DATASET } });
  console.log({ contracts, links, source: sourcePath });
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
