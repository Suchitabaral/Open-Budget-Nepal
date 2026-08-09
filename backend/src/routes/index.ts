import { Router } from 'express';
import { prisma } from '../infrastructure/database/prisma';
import { HttpError, asyncHandler, limitParam, optionalString } from '../shared/http';

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

router.get('/budget-insights/metadata', asyncHandler(async (_req, res) => {
  const [provinceRows, municipalityRows] = await Promise.all([
    prisma.subnationalFinance.findMany({
      where: { entityType: 'Province' },
      distinct: ['entityName'],
      select: { entityName: true },
      orderBy: { entityName: 'asc' },
    }),
    prisma.localBudget.findMany({
      distinct: ['localLevelName'],
      select: { localLevelName: true },
      orderBy: { localLevelName: 'asc' },
    }),
  ]);
  res.json({
    provinces: provinceRows.map((row) => row.entityName),
    municipalities: municipalityRows.map((row) => row.localLevelName).filter((name) => name !== 'Total Local Levels' && !name.endsWith('(District)')),
  });
}));

router.get('/budget-insights', asyncHandler(async (req, res) => {
  const scope = optionalString(req.query.scope);
  if (scope !== 'federal' && scope !== 'provincial' && scope !== 'local') {
    throw new HttpError(400, 'scope must be federal, provincial, or local.');
  }

  const fiscalYear = optionalString(req.query.fiscalYear);
  const reportType = optionalString(req.query.type) ?? 'actual';
  const indicator = optionalString(req.query.indicator) === 'percentage' ? 'percentage' : 'npr_million';
  const toMillion = (value: unknown) => Number(value ?? 0) / 1_000_000;
  const normalize = (series: { name: string; value: number }[]) => {
    if (indicator !== 'percentage') return series;
    const total = series.reduce((sum, item) => sum + item.value, 0);
    return series.map((item) => ({ ...item, value: total ? (item.value / total) * 100 : 0 }));
  };

  if (scope === 'federal') {
    const [selected, history, nationalRows, nationalHistory] = await Promise.all([
      prisma.publicFinanceBalanceSheet.findFirst({ where: fiscalYear ? { fiscalYear } : undefined }),
      prisma.publicFinanceBalanceSheet.findMany({ orderBy: { fiscalYear: 'asc' } }),
      prisma.nationalBudgetSummary.findMany({ where: { ...(fiscalYear ? { fiscalYear } : {}), category: 'Revenue' }, orderBy: { subCategory: 'asc' } }),
      prisma.nationalBudgetSummary.findMany({ where: { category: 'Revenue' }, orderBy: { fiscalYear: 'asc' } }),
    ]);
    if (reportType !== 'actual') {
      const rowValue = (row: (typeof nationalRows)[number]) => {
        const budget = toMillion(row.amountBudgeted);
        const actual = toMillion(row.amountActual);
        return reportType === 'budget_deviation' ? budget - actual : budget;
      };
      const components = normalize(nationalRows.map((row) => ({ name: row.subCategory, value: rowValue(row) })));
      const trendByYear = new Map<string, { budget: number; actual: number }>();
      for (const row of nationalHistory) {
        const current = trendByYear.get(row.fiscalYear) ?? { budget: 0, actual: 0 };
        current.budget += toMillion(row.amountBudgeted);
        current.actual += toMillion(row.amountActual);
        trendByYear.set(row.fiscalYear, current);
      }
      res.json({
        scope,
        unit: indicator,
        components,
        subcomponents: [],
        subSubcomponents: [],
        trend: Array.from(trendByYear, ([year, values]) => ({ fiscalYear: year, ...values })),
      });
      return;
    }
    const components = normalize([
      { name: 'Taxes', value: toMillion(selected?.totalTax) },
      { name: 'Grants', value: toMillion(selected?.foreignGrant) },
      { name: 'Other revenue', value: toMillion(selected?.totalNonTax) },
    ]);
    const subcomponents = normalize([
      { name: 'Income tax', value: toMillion(selected?.incomeTax) },
      { name: 'Value Added Tax', value: toMillion(selected?.vat) },
      { name: 'Customs', value: toMillion(selected?.customs) },
      { name: 'Excise', value: toMillion(selected?.excise) },
      { name: 'Other tax', value: toMillion(selected?.otherTax) },
      { name: 'Non-tax revenue', value: toMillion(selected?.totalNonTax) },
    ]);
    res.json({
      scope,
      unit: indicator,
      components,
      subcomponents,
      subSubcomponents: [],
      trend: history.map((row) => ({ fiscalYear: row.fiscalYear, budget: null, actual: toMillion(row.totalRevenue) })),
    });
    return;
  }

  const province = optionalString(req.query.province);
  const municipality = optionalString(req.query.municipality);
  if (reportType !== 'actual') {
    res.json({ scope, unit: indicator, components: [], subcomponents: [], subSubcomponents: [], trend: [] });
    return;
  }
  const entityType = scope === 'provincial' ? 'Province' : 'Local';
  const [selectedRows, history] = await Promise.all([
    prisma.subnationalFinance.findMany({
      where: {
        entityType,
        ...(fiscalYear ? { fiscalYear } : {}),
        ...(scope === 'provincial' && province && province !== 'all' ? { entityName: { equals: province, mode: 'insensitive' as const } } : {}),
        ...(scope === 'local' && municipality && municipality !== 'all' ? { entityName: { contains: municipality, mode: 'insensitive' as const } } : {}),
      },
    }),
    prisma.subnationalFinance.findMany({
      where: {
        entityType,
        ...(scope === 'provincial' && province && province !== 'all' ? { entityName: { equals: province, mode: 'insensitive' as const } } : {}),
        ...(scope === 'local' && municipality && municipality !== 'all' ? { entityName: { contains: municipality, mode: 'insensitive' as const } } : {}),
      },
      orderBy: { fiscalYear: 'asc' },
    }),
  ]);
  const sum = (key: 'revenueInternal' | 'revenueGrants') => selectedRows.reduce((total, row) => total + toMillion(row[key]), 0);
  const components = normalize([
    { name: 'Internal revenue', value: sum('revenueInternal') },
    { name: 'Grants', value: sum('revenueGrants') },
  ]);
  const trendByYear = new Map<string, number>();
  for (const row of history) {
    trendByYear.set(row.fiscalYear, (trendByYear.get(row.fiscalYear) ?? 0) + toMillion(row.revenueInternal) + toMillion(row.revenueGrants));
  }
  res.json({
    scope,
    unit: indicator,
    components,
    subcomponents: components,
    subSubcomponents: [],
    trend: Array.from(trendByYear, ([year, actual]) => ({ fiscalYear: year, budget: null, actual })),
  });
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
      id: `contractor-${contractor.id}`,
      type: 'Flagged Contractor',
      severity: 'High',
      entity: contractor.name,
      contractorId: contractor.id,
      contractor: contractor.name,
      project: 'Contractor profile review',
      issue: contractor.flagReason ?? 'Contractor is flagged in seed data.',
      score: 92,
      createdAt: contractor.flaggedAt ?? contractor.updatedAt,
    })),
    ...delayedContracts.map((contract) => ({
      id: `contract-${contract.id}`,
      type: 'Delayed Contract',
      severity: 'Medium',
      entity: contract.contractName,
      contractId: contract.id,
      contractCode: contract.contractCode,
      contractor: contract.contractors.map((item) => item.contractor.name).join(', ') || 'Unknown contractor',
      project: contract.contractName,
      issue: 'Contract is not completed and the end date has passed.',
      score: 67,
      contractors: contract.contractors.map((item) => item.contractor.name),
      status: contract.contractStatus,
      fiscalYear: contract.fiscalYear,
      contractAmount: contract.contractAmount,
      endOrCompleteDate: contract.endOrCompleteDate,
      createdAt: contract.updatedAt,
    })),
  ]);
}));

router.get('/feedback', asyncHandler(async (req, res) => {
  res.json(await prisma.userFeedback.findMany({
    take: limitParam(req.query.limit, 100, 500),
    include: {
      contractor: true,
      contract: true,
      project: true,
    },
    orderBy: { createdAt: 'desc' },
  }));
}));

router.post('/feedback', asyncHandler(async (req, res) => {
  const body = req.body as {
    userName?: unknown;
    userEmail?: unknown;
    feedbackType?: unknown;
    contractorId?: unknown;
    contractId?: unknown;
    projectId?: unknown;
    comment?: unknown;
    rating?: unknown;
    photoUrl?: unknown;
    issue?: unknown;
  };

  const comment = optionalString(body.comment);
  if (!comment) {
    throw new HttpError(400, 'Feedback comment is required.');
  }

  const rating = Number(body.rating);
  const normalizedRating = Number.isFinite(rating)
    ? Math.min(5, Math.max(1, Math.trunc(rating)))
    : null;

  const numberOrNull = (value: unknown) => {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  };

  const issue = typeof body.issue === 'object' && body.issue !== null ? body.issue : null;
  const storedComment = issue
    ? JSON.stringify({ comment, issue })
    : comment;

  const feedback = await prisma.userFeedback.create({
    data: {
      userName: optionalString(body.userName) ?? null,
      userEmail: optionalString(body.userEmail) ?? null,
      feedbackType: optionalString(body.feedbackType) ?? 'watchdog',
      contractorId: numberOrNull(body.contractorId),
      contractId: numberOrNull(body.contractId),
      projectId: numberOrNull(body.projectId),
      comment: storedComment,
      rating: normalizedRating,
      photoUrl: optionalString(body.photoUrl) ?? null,
      status: 'pending',
    },
  });

  res.status(201).json(feedback);
}));

export default router;
