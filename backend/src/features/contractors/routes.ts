import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma';
import { asyncHandler, HttpError, optionalString } from '../../shared/http';

const router = Router();
const DATASET = 'PPMO contract_details.csv';

function pageNumber(value: unknown, fallback: number, max: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(Math.trunc(parsed), max) : fallback;
}

router.get('/metadata', asyncHandler(async (_req, res) => {
  const [categories, fiscalYears] = await Promise.all([
    prisma.contract.findMany({ where: { sourceDataset: DATASET, procurementCategory: { not: null } }, distinct: ['procurementCategory'], select: { procurementCategory: true }, orderBy: { procurementCategory: 'asc' } }),
    prisma.contract.findMany({ where: { sourceDataset: DATASET, fiscalYear: { not: null } }, distinct: ['fiscalYear'], select: { fiscalYear: true }, orderBy: { fiscalYear: 'desc' } }),
  ]);
  res.json({
    categories: categories.flatMap(item => item.procurementCategory ? [item.procurementCategory] : []),
    fiscalYears: fiscalYears.flatMap(item => item.fiscalYear ? [item.fiscalYear] : []),
    source: { name: 'Public Procurement Monitoring Office contract records', dataset: DATASET },
  });
}));

router.get('/contractors', asyncHandler(async (req, res) => {
  const search = optionalString(req.query.search);
  const pan = optionalString(req.query.pan);
  const category = optionalString(req.query.category);
  const fiscalYear = optionalString(req.query.fiscalYear);
  const entityType = optionalString(req.query.entityType);
  const page = pageNumber(req.query.page, 1, 100000);
  const pageSize = pageNumber(req.query.pageSize, 20, 100);
  const contractWhere: Prisma.ContractWhereInput = {
    sourceDataset: DATASET,
    ...(category && category !== 'all' ? { procurementCategory: category } : {}),
    ...(fiscalYear && fiscalYear !== 'all' ? { fiscalYear } : {}),
  };
  const where: Prisma.ContractorWhereInput = {
    sourceDataset: DATASET,
    contracts: { some: { contract: { sourceDataset: DATASET } } },
    ...(search ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { vatNumber: { contains: search } }] } : {}),
    ...(pan ? { vatNumber: { contains: pan } } : {}),
    ...(entityType && entityType !== 'all' ? { contractorType: entityType } : {}),
    ...(category || fiscalYear ? { contracts: { some: { contract: contractWhere } } } : {}),
  };
  const order = { name: optionalString(req.query.sort) === 'name_desc' ? 'desc' as const : 'asc' as const };
  const [total, rows] = await Promise.all([
    prisma.contractor.count({ where }),
    prisma.contractor.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: order,
      include: { contracts: { where: { contract: contractWhere }, include: { contract: true } } },
    }),
  ]);
  const data = rows.map(contractor => {
    const awardedValue = contractor.contracts.reduce((sum, item) => sum + Number(item.contract.contractAmount), 0);
    const categories = Array.from(new Set(contractor.contracts.flatMap(item => item.contract.procurementCategory ? [item.contract.procurementCategory] : [])));
    return { id: contractor.id, name: contractor.name, pan: contractor.vatNumber, country: contractor.country, entityType: contractor.contractorType, contractCount: contractor.contracts.length, awardedValue, categories, hasDetails: contractor.contracts.length > 0 };
  });
  res.json({ data, pagination: { page, pageSize, total, pages: Math.ceil(total / pageSize) } });
}));

router.get('/contractors/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new HttpError(400, 'Invalid contractor ID.');
  const contractor = await prisma.contractor.findFirst({
    where: { id, sourceDataset: DATASET },
    include: { contracts: { include: { contract: { include: { contractors: { include: { contractor: true } } } } }, orderBy: { contract: { contractDate: 'desc' } } } },
  });
  if (!contractor) throw new HttpError(404, 'Contractor not found.');
  const contracts = contractor.contracts.map(link => ({
    id: link.contract.id, code: link.contract.contractCode, name: link.contract.contractName,
    amount: Number(link.contract.contractAmount), status: link.contract.contractStatus,
    fiscalYear: link.contract.fiscalYear, category: link.contract.procurementCategory,
    publicEntity: link.contract.publicEntityName, date: link.contract.contractDate,
    sharePercentage: link.sharePercentage === null ? null : Number(link.sharePercentage),
    jointVentureName: link.contract.jointVentureName,
    partners: link.contract.contractors.filter(item => item.contractorId !== id).map(item => ({ id: item.contractor.id, name: item.contractor.name, pan: item.contractor.vatNumber, sharePercentage: item.sharePercentage === null ? null : Number(item.sharePercentage) })),
  }));
  res.json({
    id: contractor.id, name: contractor.name, pan: contractor.vatNumber,
    registrationNumber: contractor.registrationNumber, address: contractor.address,
    country: contractor.country, entityType: contractor.contractorType, owners: contractor.owners,
    classifications: Array.from(new Set(contracts.flatMap(item => item.category ? [item.category] : []))),
    totals: { contracts: contracts.length, awardedValue: contracts.reduce((sum, item) => sum + item.amount, 0) },
    contracts,
    source: { name: 'Public Procurement Monitoring Office contract records', dataset: DATASET, limitations: ['Registration number and registered office address are not included in this dataset.', 'Beneficial-owner information is sparsely populated at contract level.'] },
  });
}));

router.get('/contracts/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new HttpError(400, 'Invalid contract ID.');
  const contract = await prisma.contract.findFirst({ where: { id, sourceDataset: DATASET }, include: { contractors: { include: { contractor: true } } } });
  if (!contract) throw new HttpError(404, 'Contract not found.');
  res.json({ ...contract, contractAmount: Number(contract.contractAmount), estimatedCost: contract.estimatedCost === null ? null : Number(contract.estimatedCost), totalPayment: contract.totalPayment === null ? null : Number(contract.totalPayment), outstandingValue: contract.outstandingValue === null ? null : Number(contract.outstandingValue), percentageOfCompletion: contract.percentageOfCompletion === null ? null : Number(contract.percentageOfCompletion), contractors: contract.contractors.map(item => ({ id: item.contractor.id, name: item.contractor.name, pan: item.contractor.vatNumber, sharePercentage: item.sharePercentage === null ? null : Number(item.sharePercentage) })) });
}));

export default router;
