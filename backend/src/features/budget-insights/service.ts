import type { FiscalFactType, GovernmentLevel, Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma';

export const SUPPORTED_FISCAL_YEARS = ['2075/76', '2076/77', '2077/78', '2078/79', '2079/80', '2080/81', '2081/82', '2082/83'];

export type FiscalQuery = {
  fiscalYear?: string;
  governmentLevel?: GovernmentLevel;
  factType?: FiscalFactType;
  provinceId?: string;
  localLevelId?: string;
  classificationId?: number;
};

function whereFor(query: FiscalQuery): Prisma.FiscalFactWhereInput {
  return {
    amountNpr: { not: null },
    ...(query.fiscalYear ? { fiscalYear: query.fiscalYear } : {}),
    ...(query.governmentLevel ? { governmentLevel: query.governmentLevel } : {}),
    ...(query.factType ? { factType: query.factType } : {}),
    ...(query.provinceId ? { provinceId: query.provinceId } : {}),
    ...(query.localLevelId ? { localLevelId: query.localLevelId } : {}),
    ...(query.classificationId ? { canonicalClassificationId: query.classificationId } : {}),
  };
}

export async function fiscalBreakdown(query: FiscalQuery) {
  const rows = await prisma.fiscalFact.groupBy({
    by: ['canonicalClassificationId', 'sourceClassificationLabelEn'], where: { ...whereFor(query), canonicalClassification: { children: { none: {} } } },
    _sum: { amountNpr: true }, orderBy: { _sum: { amountNpr: 'desc' } },
  });
  const classifications = await prisma.fiscalClassification.findMany({ where: { id: { in: rows.flatMap(row => row.canonicalClassificationId ? [row.canonicalClassificationId] : []) } } });
  const names = new Map(classifications.map(item => [item.id, item.nameEn]));
  return rows.map(row => ({ classificationId: row.canonicalClassificationId, name: row.canonicalClassificationId ? names.get(row.canonicalClassificationId) : row.sourceClassificationLabelEn ?? 'Unmapped', amountNpr: row._sum.amountNpr?.toString() ?? null }));
}

export async function fiscalBreakdownByCodes(query: FiscalQuery, codes: string[]) {
  const rows = await prisma.fiscalFact.groupBy({
    by: ['sourceClassificationCode', 'sourceClassificationLabelEn'],
    where: { ...whereFor(query), sourceClassificationCode: { in: codes } },
    _sum: { amountNpr: true }, orderBy: { _sum: { amountNpr: 'desc' } },
  });
  return rows.map(row => ({
    code: row.sourceClassificationCode,
    name: row.sourceClassificationLabelEn ?? row.sourceClassificationCode ?? 'Unmapped',
    amountNpr: row._sum.amountNpr?.toString() ?? null,
  }));
}

export async function fiscalTrend(query: Omit<FiscalQuery, 'fiscalYear'>) {
  const rows = await prisma.fiscalFact.groupBy({ by: ['fiscalYear', 'factType'], where: { ...whereFor(query), sourceClassificationCode: 'SOURCE_BOOK_TOTAL' }, _sum: { amountNpr: true }, orderBy: { fiscalYear: 'asc' } });
  const result = new Map(SUPPORTED_FISCAL_YEARS.map(year => [year, { fiscalYear: year, budgetNpr: null as string | null, actualNpr: null as string | null }]));
  for (const row of rows) {
    const item = result.get(row.fiscalYear) ?? { fiscalYear: row.fiscalYear, budgetNpr: null, actualNpr: null };
    if (row.factType === 'BUDGET') item.budgetNpr = row._sum.amountNpr?.toString() ?? null;
    else item.actualNpr = row._sum.amountNpr?.toString() ?? null;
    result.set(row.fiscalYear, item);
  }
  return [...result.values()];
}

export async function fiscalMetadata(query: FiscalQuery) {
  const sources = await prisma.fiscalDataSource.findMany({ where: query.fiscalYear ? { fiscalYear: query.fiscalYear } : undefined, orderBy: { datasetKey: 'asc' } });
  return {
    currency: 'NPR', fiscalYears: SUPPORTED_FISCAL_YEARS,
    sources: sources.map(source => ({ datasetKey: source.datasetKey, title: source.documentTitle, fiscalYear: source.fiscalYear, coverage: source.coverage, originalUnit: source.originalUnit, sourceType: source.sourceType, notes: source.notes })),
    limitation: sources.length ? 'Totals include only the selected source coverage and must not be interpreted as Nepal’s complete budget unless coverage says so.' : 'No official fiscal facts have been imported for this selection.',
  };
}
