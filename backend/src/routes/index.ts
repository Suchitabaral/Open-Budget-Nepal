import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler, limitParam, optionalString } from '../utils/http';

const router = Router();

router.get(
  '/health',
  asyncHandler(async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', database: 'connected', timestamp: new Date().toISOString() });
  }),
);

router.get(
  '/seed-summary',
  asyncHandler(async (_req, res) => {
    const [
      nationalBudget,
      fiscalTransfers,
      subnationalFinance,
      monthlyExecution,
      localGranularData,
      ministryAllocations,
      publicFinance,
      economicIndicators,
      localBudget,
      provincialBudget,
      gandakiProjects,
      contractors,
      contracts,
      contractorLocations,
      milestones,
    ] = await Promise.all([
      prisma.nationalBudgetSummary.count(),
      prisma.fiscalTransfer.count(),
      prisma.subnationalFinance.count(),
      prisma.monthlyExecution.count(),
      prisma.localGranularData.count(),
      prisma.ministryAllocation.count(),
      prisma.publicFinanceBalanceSheet.count(),
      prisma.economicIndicator.count(),
      prisma.localBudget.count(),
      prisma.provincialBudget.count(),
      prisma.gandakiProjectBudget.count(),
      prisma.contractor.count(),
      prisma.contract.count(),
      prisma.contractorLocation.count(),
      prisma.milestone.count(),
    ]);

    res.json({
      nationalBudget,
      fiscalTransfers,
      subnationalFinance,
      monthlyExecution,
      localGranularData,
      ministryAllocations,
      publicFinance,
      economicIndicators,
      localBudget,
      provincialBudget,
      gandakiProjects,
      contractors,
      contracts,
      contractorLocations,
      milestones,
    });
  }),
);

router.get('/national-budget', asyncHandler(async (_req, res) => {
  res.json(await prisma.nationalBudgetSummary.findMany({ orderBy: [{ fiscalYear: 'desc' }, { category: 'asc' }] }));
}));

router.get('/fiscal-transfers', asyncHandler(async (_req, res) => {
  res.json(await prisma.fiscalTransfer.findMany({ orderBy: [{ fiscalYear: 'desc' }, { targetName: 'asc' }] }));
}));

router.get('/subnational-finance', asyncHandler(async (_req, res) => {
  res.json(await prisma.subnationalFinance.findMany({ orderBy: [{ fiscalYear: 'desc' }, { entityName: 'asc' }] }));
}));

router.get('/monthly-execution', asyncHandler(async (_req, res) => {
  res.json(await prisma.monthlyExecution.findMany({ orderBy: [{ fiscalYear: 'desc' }, { monthIndex: 'asc' }] }));
}));

router.get('/local-granular-data', asyncHandler(async (req, res) => {
  res.json(await prisma.localGranularData.findMany({
    take: limitParam(req.query.limit),
    orderBy: [{ fiscalYear: 'desc' }, { entityName: 'asc' }],
  }));
}));

router.get('/ministry-allocations', asyncHandler(async (_req, res) => {
  res.json(await prisma.ministryAllocation.findMany({ orderBy: [{ fiscalYear: 'desc' }, { allocatedAmount: 'desc' }] }));
}));

router.get('/public-finance', asyncHandler(async (_req, res) => {
  res.json(await prisma.publicFinanceBalanceSheet.findMany({ orderBy: { fiscalYear: 'desc' } }));
}));

router.get('/economic-indicators', asyncHandler(async (_req, res) => {
  res.json(await prisma.economicIndicator.findMany({ orderBy: { fiscalYear: 'desc' } }));
}));

router.get('/local-budgets', asyncHandler(async (req, res) => {
  const name = optionalString(req.query.name);
  res.json(await prisma.localBudget.findMany({
    where: name ? { localLevelName: { contains: name, mode: 'insensitive' } } : undefined,
    take: limitParam(req.query.limit),
    orderBy: { localLevelName: 'asc' },
  }));
}));

router.get('/provincial-budget', asyncHandler(async (_req, res) => {
  res.json(await prisma.provincialBudget.findMany({ orderBy: { provinceName: 'asc' } }));
}));

router.get('/gandaki-projects', asyncHandler(async (req, res) => {
  res.json(await prisma.gandakiProjectBudget.findMany({
    take: limitParam(req.query.limit),
    orderBy: [{ district: 'asc' }, { project: 'asc' }],
  }));
}));

router.get('/contracts', asyncHandler(async (req, res) => {
  res.json(await prisma.contract.findMany({
    take: limitParam(req.query.limit),
    include: { contractors: { include: { contractor: true } }, milestones: true },
    orderBy: { createdAt: 'desc' },
  }));
}));

router.get('/contractors', asyncHandler(async (req, res) => {
  res.json(await prisma.contractor.findMany({
    take: limitParam(req.query.limit),
    include: { contracts: { include: { contract: true } } },
    orderBy: { name: 'asc' },
  }));
}));

router.get('/contractor-locations', asyncHandler(async (req, res) => {
  res.json(await prisma.contractorLocation.findMany({
    take: limitParam(req.query.limit),
    orderBy: [{ district: 'asc' }, { contractor: 'asc' }],
  }));
}));

router.get('/suspicious-activities', asyncHandler(async (_req, res) => {
  const [flaggedContractors, delayedContracts] = await Promise.all([
    prisma.contractor.findMany({ where: { isFlagged: true } }),
    prisma.contract.findMany({
      where: {
        contractStatus: { not: 'Completed' },
        endOrCompleteDate: { lt: new Date() },
      },
      include: { contractors: { include: { contractor: true } } },
    }),
  ]);

  res.json([
    ...flaggedContractors.map((contractor) => ({
      type: 'Flagged Contractor',
      severity: 'High',
      entity: contractor.name,
      issue: contractor.flagReason ?? 'Contractor is flagged in seed data.',
    })),
    ...delayedContracts.map((contract) => ({
      type: 'Delayed Contract',
      severity: 'Medium',
      entity: contract.contractName,
      contractCode: contract.contractCode,
      issue: 'Contract is not completed and the end date has passed.',
      contractors: contract.contractors.map((item) => item.contractor.name),
    })),
  ]);
}));

export default router;
