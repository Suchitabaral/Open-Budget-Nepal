import { Router } from 'express';
import type { FiscalFactType, GovernmentLevel } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma';
import { asyncHandler, HttpError } from '../../shared/http';
import { fiscalBreakdownByCodes, fiscalMetadata, fiscalTrend } from './service';

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
  const component = typeof req.query.component === 'string' ? req.query.component : 'all';
  const componentCodes = ['GON_COUNTERPART', 'FOREIGN_GRANT_TOTAL', 'FOREIGN_LOAN_TOTAL'];
  const detailCodesByComponent: Record<string, string[]> = {
    foreign_grant: ['FOREIGN_GRANT_CASH', 'FOREIGN_GRANT_REIMBURSABLE', 'FOREIGN_GRANT_DIRECT_PAYMENT', 'FOREIGN_GRANT_COMMODITY'],
    foreign_loan: ['FOREIGN_LOAN_DIRECT_PAYMENT', 'FOREIGN_LOAN_REIMBURSABLE', 'FOREIGN_LOAN_CASH'],
    gon_counterpart: ['GON_COUNTERPART'],
  };
  const allDetailCodes = [...detailCodesByComponent.foreign_grant, ...detailCodesByComponent.foreign_loan, 'GON_COUNTERPART'];
  const detailCodes = detailCodesByComponent[component] ?? allDetailCodes;
  const [breakdown, details, trend, metadata] = await Promise.all([
    isDeviation ? Promise.resolve([]) : fiscalBreakdownByCodes(query, componentCodes),
    isDeviation ? Promise.resolve([]) : fiscalBreakdownByCodes(query, detailCodes),
    fiscalTrend({ governmentLevel: query.governmentLevel, provinceId, localLevelId }),
    fiscalMetadata(query),
  ]);
  const indicator = req.query.indicator === 'percentage' ? 'percentage' : 'npr_million';
  const total = breakdown.reduce((sum, row) => sum + Number(row.amountNpr ?? 0), 0);
  const components = breakdown.map(row => ({ name: row.name, value: indicator === 'percentage' ? (total ? Number(row.amountNpr) / total * 100 : 0) : Number(row.amountNpr) / 1_000_000 }));
  const detailTotal = details.reduce((sum, row) => sum + Number(row.amountNpr ?? 0), 0);
  const subcomponents = details.map(row => ({ name: row.name, value: indicator === 'percentage' ? (detailTotal ? Number(row.amountNpr) / detailTotal * 100 : 0) : Number(row.amountNpr) / 1_000_000 }));
  res.json({ scope, unit: indicator, components, subcomponents, subSubcomponents: [], trend: trend.map(row => ({ fiscalYear: row.fiscalYear, budget: row.budgetNpr === null ? null : Number(row.budgetNpr) / 1_000_000, actual: row.actualNpr === null ? null : Number(row.actualNpr) / 1_000_000 })), metadata });
}));

export default router;
