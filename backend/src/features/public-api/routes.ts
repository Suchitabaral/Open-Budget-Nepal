import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma';
import { asyncHandler, HttpError } from '../../shared/http';
import { evaluateConcentration, evaluateContractRules, municipalityFromPublicEntity, type ConcentrationInput } from '../watchdog/service';
import { WATCHDOG_SOURCE_DATASETS } from '../watchdog/config';
import { collection, enumValue, integerId, pagination, publicRateLimit, stringValue } from './http';
import { contractDto, decimalString, source } from './serializers';

const router = Router();
router.use(publicRateLimit);

const CONTRACT_SORTS = ['name_asc', 'name_desc', 'amount_asc', 'amount_desc', 'date_asc', 'date_desc'] as const;
const PROJECT_SORTS = ['name_asc', 'name_desc', 'budget_asc', 'budget_desc'] as const;
const CONTRACTOR_SORTS = ['name_asc', 'name_desc'] as const;

router.get('/health', asyncHandler(async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ data: { status: 'ok', database: 'connected', timestamp: new Date().toISOString() } });
}));

router.get('/meta/fiscal-years', asyncHandler(async (_req, res) => {
  const [contracts, projects, budgets] = await Promise.all([
    prisma.contract.findMany({ where: { fiscalYear: { not: null } }, distinct: ['fiscalYear'], select: { fiscalYear: true } }),
    prisma.localGranularData.findMany({ distinct: ['fiscalYear'], select: { fiscalYear: true } }),
    prisma.nationalBudgetSummary.findMany({ distinct: ['fiscalYear'], select: { fiscalYear: true } }),
  ]);
  const years = [...new Set([...contracts, ...projects, ...budgets].map(row => row.fiscalYear).filter(Boolean))].sort().reverse();
  res.json({ data: years });
}));
router.get('/meta/provinces', asyncHandler(async (_req, res) => res.json({ data: await prisma.province.findMany({ orderBy: { code: 'asc' } }) })));
router.get('/meta/districts', asyncHandler(async (req, res) => {
  const provinceId = stringValue(req.query.provinceId, 'provinceId', 80);
  res.json({ data: await prisma.district.findMany({ where: provinceId ? { provinceId } : undefined, orderBy: { nameEn: 'asc' } }) });
}));
router.get('/meta/municipalities', asyncHandler(async (req, res) => {
  const provinceId = stringValue(req.query.provinceId, 'provinceId', 80);
  const districtId = stringValue(req.query.districtId, 'districtId', 80);
  res.json({ data: await prisma.localLevel.findMany({ where: { ...(provinceId ? { provinceId } : {}), ...(districtId ? { districtId } : {}) }, orderBy: { nameEn: 'asc' } }) });
}));
router.get('/meta/procurement-categories', asyncHandler(async (_req, res) => {
  const rows = await prisma.contract.findMany({ where: { procurementCategory: { not: null } }, distinct: ['procurementCategory'], select: { procurementCategory: true }, orderBy: { procurementCategory: 'asc' } });
  res.json({ data: rows.map(row => row.procurementCategory).filter(Boolean) });
}));

router.get('/budgets', asyncHandler(async (req, res) => {
  const { page, limit, skip } = pagination(req.query);
  const fiscalYear = stringValue(req.query.fiscalYear, 'fiscalYear', 20);
  const governmentLevel = enumValue(req.query.governmentLevel, 'governmentLevel', ['federal'] as const);
  const ministry = stringValue(req.query.ministry, 'ministry');
  if (governmentLevel && governmentLevel !== 'federal') throw new HttpError(400, 'Only federal budget rows currently have a normalized public listing.');
  const where: Prisma.NationalBudgetSummaryWhereInput = { ...(fiscalYear ? { fiscalYear } : {}), ...(ministry ? { subCategory: { contains: ministry, mode: 'insensitive' } } : {}) };
  const [total, rows] = await Promise.all([prisma.nationalBudgetSummary.count({ where }), prisma.nationalBudgetSummary.findMany({ where, skip, take: limit, orderBy: [{ fiscalYear: 'desc' }, { subCategory: 'asc' }] })]);
  res.json(collection(rows.map(row => ({ id: row.id, fiscalYear: row.fiscalYear, governmentLevel: 'federal', category: row.category, classification: row.subCategory, budgetAmount: decimalString(row.amountBudgeted), actualAmount: decimalString(row.amountActual), currency: 'NPR', sources: [] })), page, limit, total));
}));
router.get('/budgets/:id', asyncHandler(async (req, res) => {
  const row = await prisma.nationalBudgetSummary.findUnique({ where: { id: integerId(req.params.id) } });
  if (!row) throw new HttpError(404, 'Budget record not found.');
  res.json({ data: { id: row.id, fiscalYear: row.fiscalYear, governmentLevel: 'federal', category: row.category, classification: row.subCategory, budgetAmount: decimalString(row.amountBudgeted), actualAmount: decimalString(row.amountActual), currency: 'NPR', sources: [] } });
}));

router.get('/projects', asyncHandler(async (req, res) => {
  const { page, limit, skip } = pagination(req.query);
  const q = stringValue(req.query.q, 'q');
  const fiscalYear = stringValue(req.query.fiscalYear, 'fiscalYear', 20);
  const provinceId = stringValue(req.query.provinceId, 'provinceId', 80);
  const municipalityId = stringValue(req.query.municipalityId, 'municipalityId', 80);
  const sort = enumValue(req.query.sort, 'sort', PROJECT_SORTS) ?? 'name_asc';
  let province: string | undefined;
  let municipality: string | undefined;
  if (provinceId) province = (await prisma.province.findUnique({ where: { id: provinceId }, select: { nameEn: true } }))?.nameEn;
  if (municipalityId) municipality = (await prisma.localLevel.findUnique({ where: { id: municipalityId }, select: { nameEn: true } }))?.nameEn;
  const where: Prisma.LocalGranularDataWhereInput = { projectName: { not: null }, ...(q ? { projectName: { contains: q, mode: 'insensitive' } } : {}), ...(fiscalYear ? { fiscalYear } : {}), ...(provinceId ? { province: province ?? '__NO_MATCH__' } : {}), ...(municipalityId ? { entityName: municipality ?? '__NO_MATCH__' } : {}) };
  const orderBy: Prisma.LocalGranularDataOrderByWithRelationInput = sort.startsWith('budget') ? { projectBudget: sort.endsWith('desc') ? 'desc' : 'asc' } : { projectName: sort.endsWith('desc') ? 'desc' : 'asc' };
  const [total, rows] = await Promise.all([prisma.localGranularData.count({ where }), prisma.localGranularData.findMany({ where, skip, take: limit, orderBy } )]);
  res.json(collection(rows.map(row => ({ id: row.id, name: row.projectName, fiscalYear: row.fiscalYear, municipality: row.entityName, province: row.province, wardNumber: row.wardNumber, annualBudget: decimalString(row.projectBudget), expenditure: decimalString(row.projectExpenditure), currency: 'NPR', completionPercentage: decimalString(row.physicalProgress), status: row.status, sources: [] })), page, limit, total));
}));
router.get('/projects/:id', asyncHandler(async (req, res) => {
  const row = await prisma.localGranularData.findUnique({ where: { id: integerId(req.params.id) }, include: { contract: true } });
  if (!row || !row.projectName) throw new HttpError(404, 'Project record not found.');
  res.json({ data: { id: row.id, name: row.projectName, fiscalYear: row.fiscalYear, municipality: row.entityName, province: row.province, wardNumber: row.wardNumber, annualBudget: decimalString(row.projectBudget), expenditure: decimalString(row.projectExpenditure), currency: 'NPR', completionPercentage: decimalString(row.physicalProgress), status: row.status, linkedContractId: row.contractId, sources: source(row.contract?.sourceDataset) } });
}));

router.get('/contractors', asyncHandler(async (req, res) => {
  const { page, limit, skip } = pagination(req.query);
  const q = stringValue(req.query.q, 'q'); const pan = stringValue(req.query.pan, 'pan', 30);
  const contractorType = stringValue(req.query.contractorType, 'contractorType', 100);
  const sort = enumValue(req.query.sort, 'sort', CONTRACTOR_SORTS) ?? 'name_asc';
  const where: Prisma.ContractorWhereInput = { ...(q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { vatNumber: { contains: q } }] } : {}), ...(pan ? { vatNumber: pan } : {}), ...(contractorType ? { contractorType } : {}) };
  const [total, rows] = await Promise.all([prisma.contractor.count({ where }), prisma.contractor.findMany({ where, skip, take: limit, orderBy: { name: sort.endsWith('desc') ? 'desc' : 'asc' }, include: { _count: { select: { contracts: true } } } })]);
  res.json(collection(rows.map(row => ({ id: row.id, name: row.name, pan: row.vatNumber, contractorType: row.contractorType, country: row.country, province: row.province, district: row.district, contractCount: row._count.contracts, sources: source(row.sourceDataset) })), page, limit, total));
}));
router.get('/contractors/:id', asyncHandler(async (req, res) => {
  const id = integerId(req.params.id); const row = await prisma.contractor.findUnique({ where: { id }, include: { _count: { select: { contracts: true } } } });
  if (!row) throw new HttpError(404, 'Contractor not found.');
  res.json({ data: { id: row.id, name: row.name, pan: row.vatNumber, registrationNumber: row.registrationNumber, address: row.address, owners: row.owners, contractorType: row.contractorType, country: row.country, province: row.province, district: row.district, contractCount: row._count.contracts, sources: source(row.sourceDataset) } });
}));
router.get('/contractors/:id/contracts', asyncHandler(async (req, res) => {
  const id = integerId(req.params.id); const { page, limit, skip } = pagination(req.query);
  if (!await prisma.contractor.findUnique({ where: { id }, select: { id: true } })) throw new HttpError(404, 'Contractor not found.');
  const where = { contractorId: id };
  const [total, links] = await Promise.all([prisma.contractContractor.count({ where }), prisma.contractContractor.findMany({ where, skip, take: limit, orderBy: { contract: { contractDate: 'desc' } }, include: { contract: { include: { contractors: { include: { contractor: true } } } } } })]);
  res.json(collection(links.map(link => contractDto(link.contract)), page, limit, total));
}));

function contractWhere(req: any): Prisma.ContractWhereInput {
  const fiscalYear = stringValue(req.query.fiscalYear, 'fiscalYear', 20);
  const contractorId = req.query.contractorId === undefined ? undefined : integerId(req.query.contractorId, 'contractorId');
  const projectId = req.query.projectId === undefined ? undefined : integerId(req.query.projectId, 'projectId');
  const category = stringValue(req.query.procurementCategory, 'procurementCategory', 100);
  return { ...(fiscalYear ? { fiscalYear } : {}), ...(Number.isInteger(contractorId) ? { contractors: { some: { contractorId } } } : {}), ...(Number.isInteger(projectId) ? { localGranularData: { some: { id: projectId } } } : {}), ...(category ? { procurementCategory: category } : {}) };
}
function contractOrder(sort: typeof CONTRACT_SORTS[number]): Prisma.ContractOrderByWithRelationInput {
  if (sort.startsWith('amount')) return { contractAmount: sort.endsWith('desc') ? 'desc' : 'asc' };
  if (sort.startsWith('date')) return { contractDate: sort.endsWith('desc') ? 'desc' : 'asc' };
  return { contractName: sort.endsWith('desc') ? 'desc' : 'asc' };
}
async function contractsList(req: any, res: any, procurementOnly = false) {
  const { page, limit, skip } = pagination(req.query); const sort = enumValue(req.query.sort, 'sort', CONTRACT_SORTS) ?? 'date_desc';
  const q = stringValue(req.query.q, 'q');
  const where: Prisma.ContractWhereInput = { ...contractWhere(req), AND: [
    ...(q ? [{ OR: [{ contractName: { contains: q, mode: 'insensitive' as const } }, { contractCode: { contains: q, mode: 'insensitive' as const } }, { publicEntityName: { contains: q, mode: 'insensitive' as const } }] }] : []),
    ...(procurementOnly ? [{ OR: [{ procurementMethod: { not: null } }, { procurementCategory: { not: null } }] }] : []),
  ] };
  const [total, rows] = await Promise.all([prisma.contract.count({ where }), prisma.contract.findMany({ where, skip, take: limit, orderBy: contractOrder(sort), include: { contractors: { include: { contractor: true } } } })]);
  res.json(collection(rows.map(row => contractDto(row)), page, limit, total, procurementOnly ? { limitation: 'The database currently stores awarded contract/procurement records, not a separate tender-notice dataset.' } : {}));
}
router.get('/contracts', asyncHandler(async (req, res) => contractsList(req, res)));
router.get('/contracts/:id', asyncHandler(async (req, res) => { const row = await prisma.contract.findUnique({ where: { id: integerId(req.params.id) }, include: { contractors: { include: { contractor: true } } } }); if (!row) throw new HttpError(404, 'Contract not found.'); res.json({ data: contractDto(row, true) }); }));
router.get('/procurements', asyncHandler(async (req, res) => contractsList(req, res, true)));
router.get('/procurements/:id', asyncHandler(async (req, res) => { const row = await prisma.contract.findUnique({ where: { id: integerId(req.params.id) }, include: { contractors: { include: { contractor: true } } } }); if (!row || (!row.procurementMethod && !row.procurementCategory)) throw new HttpError(404, 'Procurement record not found.'); res.json({ data: contractDto(row, true) }); }));

async function watchdogFindings() {
  const evaluatedAt = new Date();
  const contracts = await prisma.contract.findMany({ where: { sourceDataset: { in: [...WATCHDOG_SOURCE_DATASETS] } }, include: { contractors: { include: { contractor: true } } } });
  const direct = contracts.flatMap(contract => evaluateContractRules({ contractId: contract.id, contractCode: contract.contractCode, project: contract.contractName, contractor: contract.contractors.map(link => link.contractor.name).join(', ') || 'Contractor not recorded', contractorId: contract.contractors.length === 1 ? contract.contractors[0].contractorId : undefined, expectedDate: contract.deliveryDate ?? contract.endOrCompleteDate, completionPercentage: contract.percentageOfCompletion == null ? null : Number(contract.percentageOfCompletion), originalContractAmount: contract.contractAmount == null ? null : Number(contract.contractAmount), recordedDisbursement: contract.totalPayment == null ? null : Number(contract.totalPayment), contractStatus: contract.contractStatus, fiscalYear: contract.fiscalYear }, evaluatedAt));
  const concentration: ConcentrationInput[] = contracts.flatMap(contract => contract.contractors.map(link => ({ contractId: contract.id, contractCode: contract.contractCode, project: contract.contractName, contractorId: link.contractorId, contractor: link.contractor.name, municipality: contract.municipality ?? municipalityFromPublicEntity(contract.publicEntityName), fiscalYear: contract.fiscalYear, isInfrastructure: contract.procurementCategory === 'Works', contractAmount: contract.contractAmount == null ? null : Number(contract.contractAmount), contractorSharePercentage: link.sharePercentage == null ? (contract.contractors.length === 1 ? 100 : null) : Number(link.sharePercentage) })));
  return [...direct, ...evaluateConcentration(concentration, evaluatedAt)];
}
router.get('/watchdog/findings', asyncHandler(async (req, res) => {
  const { page, limit } = pagination(req.query); const rule = enumValue(req.query.rule, 'rule', ['SEVERE_DELAY', 'COST_OVERRUN', 'HIGH_CONCENTRATION'] as const); const severity = enumValue(req.query.severity, 'severity', ['High', 'Medium'] as const); const fiscalYear = stringValue(req.query.fiscalYear, 'fiscalYear', 20); const contractorId = req.query.contractorId === undefined ? undefined : integerId(req.query.contractorId, 'contractorId');
  const all = (await watchdogFindings()).filter(row => (!rule || row.ruleId === rule) && (!severity || row.severity === severity) && (!fiscalYear || row.fiscalYear === fiscalYear) && (!Number.isInteger(contractorId) || row.contractorId === contractorId));
  const data = all.slice((page - 1) * limit, page * limit).map(row => ({ ...row, evidence: Object.fromEntries(row.scoreFactors.map(factor => [factor.label, factor.value])) }));
  res.json(collection(data, page, limit, all.length, { methodology: 'Deterministic rule-based findings; risk scores are not probabilities.' }));
}));
router.get('/watchdog/findings/:id', asyncHandler(async (req, res) => { const findingId = stringValue(req.params.id, 'id'); const row = (await watchdogFindings()).find(item => item.id === findingId); if (!row) throw new HttpError(404, 'Watchdog finding not found.'); res.json({ data: { ...row, evidence: Object.fromEntries(row.scoreFactors.map(factor => [factor.label, factor.value])) } }); }));

export default router;
