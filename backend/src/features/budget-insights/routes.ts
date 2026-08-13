import { Router } from 'express';
import type { FiscalFactType, GovernmentLevel } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma';
import { asyncHandler, HttpError } from '../../shared/http';
import { fiscalBreakdown, fiscalMetadata, fiscalTrend } from './service';

const router = Router();
const levelMap = { federal: 'FEDERAL', provincial: 'PROVINCIAL', local: 'LOCAL' } as const;
const typeMap = { budget: 'BUDGET', actual: 'ACTUAL' } as const;

router.get('/metadata', asyncHandler(async (_req, res) => {
  const [provinces, municipalities, classifications, metadata] = await Promise.all([
    prisma.province.findMany({ orderBy: { code: 'asc' }, select: { id: true, code: true, nameEn: true } }),
    prisma.localLevel.findMany({ orderBy: { nameEn: 'asc' }, select: { id: true, code: true, nameEn: true, nameNe: true, type: true, provinceId: true, districtId: true } }),
    prisma.fiscalClassification.findMany({ orderBy: [{ level: 'asc' }, { nameEn: 'asc' }] }),
    fiscalMetadata({}),
  ]);
  res.json({ provinceRecords: provinces, municipalityRecords: municipalities, provinces: provinces.map(item => item.nameEn), municipalities: municipalities.map(item => item.nameEn), classifications, ...metadata });
}));

router.get('/', asyncHandler(async (req, res) => {
  const scope = typeof req.query.scope === 'string' ? req.query.scope : '';
  const governmentLevel = levelMap[scope as keyof typeof levelMap];
  if (!governmentLevel) throw new HttpError(400, 'scope must be federal, provincial, or local.');
  const requestedType = typeof req.query.type === 'string' ? req.query.type : 'budget';
  const isDeviation = requestedType === 'budget_deviation';
  const factType = typeMap[requestedType as keyof typeof typeMap] ?? 'BUDGET';
  const fiscalYear = typeof req.query.fiscalYear === 'string' ? req.query.fiscalYear : undefined;
  const provinceValue = typeof req.query.provinceId === 'string' ? req.query.provinceId : typeof req.query.province === 'string' && req.query.province !== 'all' ? req.query.province : undefined;
  const province = provinceValue ? await prisma.province.findFirst({ where: { OR: [{ id: provinceValue }, { code: provinceValue }, { nameEn: { equals: provinceValue, mode: 'insensitive' } }] } }) : null;
  const municipalityCode = typeof req.query.municipalityCode === 'string' && req.query.municipalityCode !== 'all' ? req.query.municipalityCode : undefined;
  const municipality = municipalityCode ? await prisma.localLevel.findFirst({ where: { OR: [{ id: municipalityCode }, { code: municipalityCode }] } }) : null;
  const provinceId = province?.id;
  const localLevelId = municipality?.id;
  const query = { fiscalYear, governmentLevel: governmentLevel as GovernmentLevel, factType: factType as FiscalFactType, provinceId, localLevelId };
  const [breakdown, trend, metadata] = await Promise.all([isDeviation ? Promise.resolve([]) : fiscalBreakdown(query), fiscalTrend({ governmentLevel: query.governmentLevel, provinceId, localLevelId }), fiscalMetadata(query)]);
  const indicator = req.query.indicator === 'percentage' ? 'percentage' : 'npr_million';
  const total = breakdown.reduce((sum, row) => sum + Number(row.amountNpr ?? 0), 0);
  const components = breakdown.map(row => ({ name: row.name, value: indicator === 'percentage' ? (total ? Number(row.amountNpr) / total * 100 : 0) : Number(row.amountNpr) / 1_000_000 }));
  res.json({ scope, unit: indicator, components, subcomponents: [], subSubcomponents: [], trend: trend.map(row => ({ fiscalYear: row.fiscalYear, budget: row.budgetNpr === null ? null : Number(row.budgetNpr) / 1_000_000, actual: row.actualNpr === null ? null : Number(row.actualNpr) / 1_000_000 })), metadata });
}));

export default router;
