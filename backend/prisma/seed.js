const fs = require('node:fs');
const path = require('node:path');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const databaseUrl =
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/open_budget_nepal?schema=public';
const adapter = new PrismaPg(databaseUrl);
const prisma = new PrismaClient({ adapter });

const csvDir = path.resolve(process.cwd(), process.env.SEED_CSV_DIR || '../csv');
const administrativeRegistryPath = path.resolve(
  process.cwd(),
  process.env.ADMINISTRATIVE_REGISTRY_PATH || '../shared/data/administrative/nepal-local-levels.json',
);

function parseCsv(content) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];
    const next = content[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(cell.trim());
      cell = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') {
        i += 1;
      }
      row.push(cell.trim());
      if (row.some((value) => value !== '')) {
        rows.push(row);
      }
      row = [];
      cell = '';
      continue;
    }

    cell += char;
  }

  if (cell || row.length) {
    row.push(cell.trim());
    if (row.some((value) => value !== '')) {
      rows.push(row);
    }
  }

  return rows;
}

function readCsv(fileName, headerRow = 0) {
  const filePath = path.join(csvDir, fileName);
  if (!fs.existsSync(filePath)) {
    console.warn(`Skipping missing seed file: ${fileName}`);
    return [];
  }

  const rows = parseCsv(fs.readFileSync(filePath, 'utf8'));
  if (rows.length <= headerRow) return [];

  const headers = rows[headerRow].map((header) => header.trim());
  return rows.slice(headerRow + 1).map((values) => {
    const record = {};
    headers.forEach((header, index) => {
      record[header] = values[index] ?? '';
    });
    return record;
  });
}

function nullable(value) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized === '' ? null : normalized;
}

function decimal(value, fallback = '0') {
  const normalized = nullable(value);
  if (!normalized) return fallback;
  const cleaned = normalized.replace(/,/g, '');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? cleaned : fallback;
}

function int(value) {
  const parsed = Number.parseInt(String(value || '').trim(), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function bool(value) {
  return ['true', 'yes', '1', 'y'].includes(String(value || '').trim().toLowerCase());
}

function date(value) {
  const normalized = nullable(value);
  if (!normalized) return null;

  const iso = new Date(normalized);
  if (!Number.isNaN(iso.getTime())) return iso;

  const match = normalized.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!match) return null;

  const [, day, month, year] = match;
  const parsed = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function pick(row, ...keys) {
  for (const key of keys) {
    const value = nullable(row[key]);
    if (value !== null) return value;
  }
  return null;
}

async function seedAdministrativeRegistry() {
  const registry = JSON.parse(fs.readFileSync(administrativeRegistryPath, 'utf8'));

  for (const province of registry.provinces) {
    await prisma.province.upsert({
      where: { id: province.id },
      update: { code: province.code, nameEn: province.nameEn },
      create: { id: province.id, code: province.code, nameEn: province.nameEn },
    });

    for (const district of province.districts) {
      await prisma.district.upsert({
        where: { id: district.id },
        update: { code: district.code, nameEn: district.nameEn, provinceId: province.id },
        create: { id: district.id, code: district.code, nameEn: district.nameEn, provinceId: province.id },
      });

      for (const localLevel of district.localLevels) {
        await prisma.localLevel.upsert({
          where: { id: localLevel.id },
          update: {
            code: localLevel.code,
            nameEn: localLevel.nameEn,
            nameNe: localLevel.nameNe,
            type: localLevel.type,
            provinceId: province.id,
            districtId: district.id,
          },
          create: {
            id: localLevel.id,
            code: localLevel.code,
            nameEn: localLevel.nameEn,
            nameNe: localLevel.nameNe,
            type: localLevel.type,
            provinceId: province.id,
            districtId: district.id,
          },
        });
      }
    }
  }

  const [provinces, districts, localLevels] = await Promise.all([
    prisma.province.count(),
    prisma.district.count(),
    prisma.localLevel.count(),
  ]);
  const expected = registry.counts;
  if (provinces !== expected.provinces || districts !== expected.districts || localLevels !== expected.localLevels) {
    throw new Error(`Administrative registry count mismatch: ${provinces}/${districts}/${localLevels}`);
  }
  return localLevels;
}

async function clearSeededTables() {
  await prisma.userFeedback.deleteMany();
  await prisma.milestone.deleteMany();
  await prisma.localGranularData.deleteMany();
  await prisma.contractContractor.deleteMany();
  await prisma.contract.deleteMany();
  await prisma.contractor.deleteMany();
  await prisma.contractorLocation.deleteMany();
  await prisma.gandakiProjectBudget.deleteMany();
  await prisma.provincialBudget.deleteMany();
  await prisma.localBudget.deleteMany();
  await prisma.economicIndicator.deleteMany();
  await prisma.publicFinanceBalanceSheet.deleteMany();
  await prisma.ministryAllocation.deleteMany();
  await prisma.monthlyExecution.deleteMany();
  await prisma.subnationalFinance.deleteMany();
  await prisma.fiscalTransfer.deleteMany();
  await prisma.nationalBudgetSummary.deleteMany();
}

async function seedNationalBudget() {
  const rows = readCsv('national_budget_summary.csv');
  for (const row of rows) {
    await prisma.nationalBudgetSummary.create({
      data: {
        fiscalYear: row.fiscal_year,
        category: row.category,
        subCategory: row.sub_category,
        amountBudgeted: decimal(row.amount_budgeted),
        amountActual: nullable(row.amount_actual) ? decimal(row.amount_actual) : null,
        inflationRate: nullable(row.inflation_rate) ? decimal(row.inflation_rate) : null,
      },
    });
  }
  return rows.length;
}

async function seedFiscalTransfers() {
  const rows = readCsv('fiscal_transfers.csv');
  for (const row of rows) {
    await prisma.fiscalTransfer.create({
      data: {
        fiscalYear: row.fiscal_year,
        sourceLevel: row.source_level,
        targetLevel: row.target_level,
        targetName: row.target_name,
        grantType: row.grant_type,
        amount: decimal(row.amount),
      },
    });
  }
  return rows.length;
}

async function seedSubnationalFinance() {
  const rows = readCsv('subnational_finance(1).csv');
  for (const row of rows) {
    await prisma.subnationalFinance.create({
      data: {
        entityName: row.entity_name,
        entityType: row.entity_type,
        fiscalYear: row.fiscal_year,
        revenueInternal: decimal(row.revenue_internal),
        revenueGrants: decimal(row.revenue_grants),
        sectorHealth: decimal(row.sector_health),
        sectorEducation: decimal(row.sector_education),
        sectorInfra: decimal(row.sector_infra),
        sectorAgriculture: decimal(row.sector_agriculture),
      },
    });
  }
  return rows.length;
}

async function seedMonthlyExecution() {
  const rows = readCsv('monthly_execution.csv');
  for (const row of rows) {
    await prisma.monthlyExecution.create({
      data: {
        entityName: row.entity_name,
        fiscalYear: row.fiscal_year,
        monthIndex: int(row.month_index) || 0,
        monthName: row.month_name,
        cumulativeSpendCapital: decimal(row.cumulative_spend_capital),
        cumulativeSpendRecurrent: decimal(row.cumulative_spend_recurrent),
        targetSpend: decimal(row.target_spend),
      },
    });
  }
  return rows.length;
}

async function seedLocalGranularData() {
  const rows = readCsv('local_granular_data.csv');
  for (const row of rows) {
    await prisma.localGranularData.create({
      data: {
        entityName: row.entity_name,
        fiscalYear: row.fiscal_year,
        wardNumber: int(row.ward_number),
        wardPopulation: int(row.ward_population),
        wardTotalBudget: nullable(row.ward_total_budget) ? decimal(row.ward_total_budget) : null,
        projectName: nullable(row.project_name),
        projectBudget: nullable(row.project_budget) ? decimal(row.project_budget) : null,
        projectExpenditure: nullable(row.project_expenditure)
          ? decimal(row.project_expenditure)
          : null,
        physicalProgress: nullable(row.physical_progress) ? decimal(row.physical_progress) : null,
        status: nullable(row.status),
      },
    });
  }
  return rows.length;
}

async function seedMinistryAllocations() {
  const rows = readCsv('ministry_allocations.csv');
  for (const row of rows) {
    await prisma.ministryAllocation.create({
      data: {
        ministryName: row.ministry_name,
        fiscalYear: row.fiscal_year,
        allocatedAmount: decimal(row.allocated_amount),
        spentAmount: decimal(row.spent_amount),
      },
    });
  }
  return rows.length;
}

async function seedPublicFinance() {
  const rows = readCsv('MOF_public_finance_BS.csv', 1).filter((row) =>
    nullable(row['FiscalYear(BS)']),
  );

  for (const row of rows) {
    await prisma.publicFinanceBalanceSheet.create({
      data: {
        fiscalYear: row['FiscalYear(BS)'],
        totalRevenue: nullable(row['Total Revenue']) ? decimal(row['Total Revenue']) : null,
        totalTax: nullable(row['Total Tax']) ? decimal(row['Total Tax']) : null,
        customs: nullable(row.Customs) ? decimal(row.Customs) : null,
        excise: nullable(row.Excise) ? decimal(row.Excise) : null,
        incomeTax: nullable(row['Income Tax']) ? decimal(row['Income Tax']) : null,
        vat: nullable(row.VAT) ? decimal(row.VAT) : null,
        otherTax: nullable(row['Other Tax']) ? decimal(row['Other Tax']) : null,
        totalNonTax: nullable(row['Total  Non Tax']) ? decimal(row['Total  Non Tax']) : null,
        totalExpenditure: nullable(row['Total Expenditure'])
          ? decimal(row['Total Expenditure'])
          : null,
        recurrentExpenditure: nullable(row['Recurrent Expenditure'])
          ? decimal(row['Recurrent Expenditure'])
          : null,
        capitalExpenditure: nullable(row['Capital         Expenditure'])
          ? decimal(row['Capital         Expenditure'])
          : null,
        financing: nullable(row.Financing) ? decimal(row.Financing) : null,
        totalOutstandingDebt: nullable(row['Total Outstanding Debt'])
          ? decimal(row['Total Outstanding Debt'])
          : null,
        outstandingDomesticDebt: nullable(row['Outstanding Domestic Debt'])
          ? decimal(row['Outstanding Domestic Debt'])
          : null,
        outstandingForeignDebt: nullable(row['Outstanding Foreign Debt'])
          ? decimal(row['Outstanding Foreign Debt'])
          : null,
        domesticBorrowingYearly: nullable(row['Domestic Borrowing (Yearly)'])
          ? decimal(row['Domestic Borrowing (Yearly)'])
          : null,
        totalForeignFinancing: nullable(row['Total Foreign Financing'])
          ? decimal(row['Total Foreign Financing'])
          : null,
        foreignGrant: nullable(row['Foreign Grant']) ? decimal(row['Foreign Grant']) : null,
        foreignLoan: nullable(row['Foreign Loan']) ? decimal(row['Foreign Loan']) : null,
        totalPublicDebt: nullable(row['Total Public Debt'])
          ? decimal(row['Total Public Debt'])
          : null,
      },
    });
  }
  return rows.length;
}

async function seedEconomicIndicators() {
  const rows = readCsv('nepal_economic_indicators.csv');
  for (const row of rows) {
    await prisma.economicIndicator.create({
      data: {
        fiscalYear: row.fiscalYear,
        gdpGrowthRate: decimal(row.gdpGrowthRate),
        inflationRate: decimal(row.inflationRate),
        budgetGrowthRate: decimal(row.budgetGrowthRate),
        taxRevenueGrowthRate: decimal(row.taxRevenueGrowthRate),
        minimumWageMonthly: decimal(row.minimumWageMonthly),
        averageSalaryGrowthRate: decimal(row.averageSalaryGrowthRate),
        remittanceGrowthRate: decimal(row.remittanceGrowthRate),
      },
    });
  }
  return rows.length;
}

async function seedLocalBudget() {
  const rows = readCsv('local_budget.csv');
  for (const row of rows) {
    await prisma.localBudget.create({
      data: {
        localLevelName: row['Local Level Name'],
        equalization: decimal(row.Equalization),
        conditional: decimal(row.Conditional),
        special: decimal(row.Special),
        complementary: decimal(row.Complementary),
        totalRecurring: decimal(row['Total Recurring']),
        totalCapital: decimal(row['Total Capital']),
        grandTotal: decimal(row['Grand Total']),
      },
    });
  }
  return rows.length;
}

async function seedProvincialBudget() {
  const rows = readCsv('provincial_budget.csv');
  for (const row of rows) {
    await prisma.provincialBudget.create({
      data: {
        provinceCode: row['Province Code'],
        provinceName: row['Province Name'],
        equalizationGrant: decimal(row['Equalization Grant']),
        conditionalGrant: decimal(row['Conditional Grant']),
        specialGrant: decimal(row['Special Grant']),
        complementaryGrant: decimal(row['Complementary Grant']),
        recurringTotal: decimal(row['Recurring Total']),
        capitalTotal: decimal(row['Capital Total']),
        grandTotal: decimal(row['Grand Total']),
      },
    });
  }
  return rows.length;
}

async function seedGandakiProjects() {
  const rows = readCsv('gandaki_district_project_budget_2082_83.csv');
  for (const row of rows) {
    await prisma.gandakiProjectBudget.create({
      data: {
        project: row.Project,
        district: row.District,
        amountThousandNpr: decimal(row.Amount_Thousand_NPR),
      },
    });
  }
  return rows.length;
}

async function seedContractors() {
  const contractorRows = readCsv('contractors.csv');
  for (const row of contractorRows) {
    await prisma.contractor.create({
      data: {
        name: row.name,
        registrationNumber: nullable(row.registration_number),
        address: nullable(row.address),
        owners: nullable(row.owners),
        isFlagged: bool(row.is_blacklisted),
        flagReason: bool(row.is_blacklisted) ? 'Blacklisted in seed CSV' : null,
      },
    });
  }

  const locationRows = readCsv('contractor_location.csv');
  for (const row of locationRows) {
    await prisma.contractorLocation.create({
      data: {
        district: row.District,
        contractor: row.Contractor,
      },
    });
  }

  return contractorRows.length + locationRows.length;
}

async function upsertContractorFromName(name, extra = {}) {
  const cleaned = nullable(name);
  if (!cleaned) return null;

  return prisma.contractor.upsert({
    where: { name: cleaned },
    update: extra,
    create: { name: cleaned, ...extra },
  });
}

async function seedContracts() {
  const simpleRows = readCsv('contracts.csv');
  for (const row of simpleRows) {
    await prisma.contract.create({
      data: {
        contractCode: row.contract_code,
        contractName: row.contract_name,
        contractAmount: decimal(row.contract_amount),
        procurementCategory: nullable(row.procurement_category),
        procurementMethod: nullable(row.procurement_method),
        contractStatus: nullable(row.status),
        publicEntityName: nullable(row.pe_name),
      },
    });
  }

  const detailRows = readCsv('contract_details.csv');
  let linkedContractors = 0;

  for (const row of detailRows) {
    const code = pick(row, 'contract_id', 'contractRecordsTO.contractId');
    if (!code) continue;

    const contract = await prisma.contract.upsert({
      where: { contractCode: code },
      update: {
        contractName: pick(row, 'contractRecordsTO.contractName') || undefined,
        contractAmount: decimal(pick(row, 'contractRecordsTO.contractAmount')),
        contractDate: date(pick(row, 'contractRecordsTO.contractDate')),
        startDate: date(pick(row, 'contractRecordsTO.startDate')),
        endOrCompleteDate: date(pick(row, 'contractRecordsTO.endOrCompleteDate')),
        deliveryDate: date(pick(row, 'contractRecordsTO.deliveryDate')),
        contractStatus: pick(row, 'contractRecordsTO.contractStatus'),
        percentageOfCompletion: nullable(row['contractRecordsTO.percentageOfCompletion'])
          ? decimal(row['contractRecordsTO.percentageOfCompletion'])
          : null,
        totalPayment: nullable(row['contractRecordsTO.totalPayment'])
          ? decimal(row['contractRecordsTO.totalPayment'])
          : null,
        outstandingValue: nullable(row['contractRecordsTO.outstandingValue'])
          ? decimal(row['contractRecordsTO.outstandingValue'])
          : null,
        estimatedCost: nullable(row['contractRecordsTO.estimatedCost'])
          ? decimal(row['contractRecordsTO.estimatedCost'])
          : null,
        procurementMethod: pick(row, 'contractRecordsTO.procurementMethodId'),
        procurementCategory: pick(row, 'contractRecordsTO.procurementCategoryId'),
        biddingProcess: pick(row, 'contractRecordsTO.biddingProcess'),
        publicEntityName: pick(row, 'contractRecordsTO.publicEntityName'),
        fiscalYear: pick(row, 'contractRecordsTO.fiscalYear'),
        projectDescription: pick(row, 'contractRecordsTO.projectDescription'),
        sourceOfFund: pick(row, 'contractRecordsTO.sourceOfFund'),
      },
      create: {
        contractCode: code,
        contractName: pick(row, 'contractRecordsTO.contractName') || code,
        contractAmount: decimal(pick(row, 'contractRecordsTO.contractAmount')),
        contractDate: date(pick(row, 'contractRecordsTO.contractDate')),
        startDate: date(pick(row, 'contractRecordsTO.startDate')),
        endOrCompleteDate: date(pick(row, 'contractRecordsTO.endOrCompleteDate')),
        deliveryDate: date(pick(row, 'contractRecordsTO.deliveryDate')),
        contractStatus: pick(row, 'contractRecordsTO.contractStatus'),
        percentageOfCompletion: nullable(row['contractRecordsTO.percentageOfCompletion'])
          ? decimal(row['contractRecordsTO.percentageOfCompletion'])
          : null,
        totalPayment: nullable(row['contractRecordsTO.totalPayment'])
          ? decimal(row['contractRecordsTO.totalPayment'])
          : null,
        outstandingValue: nullable(row['contractRecordsTO.outstandingValue'])
          ? decimal(row['contractRecordsTO.outstandingValue'])
          : null,
        estimatedCost: nullable(row['contractRecordsTO.estimatedCost'])
          ? decimal(row['contractRecordsTO.estimatedCost'])
          : null,
        procurementMethod: pick(row, 'contractRecordsTO.procurementMethodId'),
        procurementCategory: pick(row, 'contractRecordsTO.procurementCategoryId'),
        biddingProcess: pick(row, 'contractRecordsTO.biddingProcess'),
        publicEntityName: pick(row, 'contractRecordsTO.publicEntityName'),
        fiscalYear: pick(row, 'contractRecordsTO.fiscalYear'),
        projectDescription: pick(row, 'contractRecordsTO.projectDescription'),
        sourceOfFund: pick(row, 'contractRecordsTO.sourceOfFund'),
      },
    });

    for (const index of [1, 2, 3]) {
      const contractorName = pick(row, `contractRecordsTO.contractorName${index}`);
      const contractor = await upsertContractorFromName(contractorName, {
        country: pick(row, `contractRecordsTO.contractorCountry${index}`),
        vatNumber: pick(row, `contractRecordsTO.vat_no${index}`),
        contractorType: pick(row, 'contractRecordsTO.contractorType'),
      });

      if (!contractor) continue;

      await prisma.contractContractor.upsert({
        where: {
          contractId_contractorId: {
            contractId: contract.id,
            contractorId: contractor.id,
          },
        },
        update: {
          sharePercentage: nullable(row[`contractRecordsTO.sharedPercentage${index}`])
            ? decimal(row[`contractRecordsTO.sharedPercentage${index}`])
            : null,
        },
        create: {
          contractId: contract.id,
          contractorId: contractor.id,
          sharePercentage: nullable(row[`contractRecordsTO.sharedPercentage${index}`])
            ? decimal(row[`contractRecordsTO.sharedPercentage${index}`])
            : null,
        },
      });
      linkedContractors += 1;
    }
  }

  return simpleRows.length + detailRows.length + linkedContractors;
}

async function seedMilestones() {
  const rows = readCsv('milestones.csv');
  let count = 0;
  for (const row of rows) {
    const contract = await prisma.contract.findFirst({
      orderBy: { id: 'asc' },
      skip: Math.max((int(row.contract_id) || 1) - 1, 0),
    });
    if (!contract) continue;

    await prisma.milestone.create({
      data: {
        contractId: contract.id,
        description: row.description,
        targetDate: date(row.target_date),
        completionDate: date(row.completion_date),
        status: nullable(row.status),
      },
    });
    count += 1;
  }
  return count;
}

async function main() {
  if (process.argv.includes('--registry-only')) {
    const localLevels = await seedAdministrativeRegistry();
    console.log(`Administrative registry ready: ${localLevels} local levels`);
    return;
  }

  console.log(`Seeding database from ${csvDir}`);
  await clearSeededTables();

  const results = {};
  results.administrativeLocalLevels = await seedAdministrativeRegistry();
  results.nationalBudget = await seedNationalBudget();
  results.fiscalTransfers = await seedFiscalTransfers();
  results.subnationalFinance = await seedSubnationalFinance();
  results.monthlyExecution = await seedMonthlyExecution();
  results.localGranularData = await seedLocalGranularData();
  results.ministryAllocations = await seedMinistryAllocations();
  results.publicFinance = await seedPublicFinance();
  results.economicIndicators = await seedEconomicIndicators();
  results.localBudget = await seedLocalBudget();
  results.provincialBudget = await seedProvincialBudget();
  results.gandakiProjects = await seedGandakiProjects();
  results.contractorsAndLocations = await seedContractors();
  results.contractsAndContractors = await seedContracts();
  results.milestones = await seedMilestones();

  console.table(results);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
