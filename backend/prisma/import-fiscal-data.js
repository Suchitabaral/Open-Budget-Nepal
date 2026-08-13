const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const IMPORTER_VERSION = '1.0.0';
const dryRun = process.argv.includes('--dry-run');
const root = path.resolve(__dirname, '../..');
const sourceRoot = path.join(root, 'budget_document/oagn');
const reportDir = path.join(__dirname, 'fiscal-import/reports');
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'fiscal-import/source-manifest.json'), 'utf8')).datasets[0];
const registry = JSON.parse(fs.readFileSync(path.join(root, 'shared/data/administrative/nepal-local-levels.json'), 'utf8'));
const localOverrides = JSON.parse(fs.readFileSync(path.join(__dirname, 'fiscal-import/local-level-overrides.json'), 'utf8')).overrides;
const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/open_budget_nepal?schema=public';

const financingColumns = [
  ['GON_COUNTERPART', 'Government of Nepal counterpart', 1],
  ['FOREIGN_GRANT_CASH', 'Foreign grant — cash', 2],
  ['FOREIGN_GRANT_REIMBURSABLE', 'Foreign grant — reimbursable', 3],
  ['FOREIGN_GRANT_DIRECT_PAYMENT', 'Foreign grant — direct payment', 4],
  ['FOREIGN_GRANT_COMMODITY', 'Foreign grant — commodity', 5],
  ['FOREIGN_GRANT_TOTAL', 'Foreign grant — total', 6],
  ['FOREIGN_LOAN_DIRECT_PAYMENT', 'Foreign loan — direct payment', 7],
  ['FOREIGN_LOAN_REIMBURSABLE', 'Foreign loan — reimbursable', 8],
  ['FOREIGN_LOAN_CASH', 'Foreign loan — cash', 9],
  ['FOREIGN_LOAN_TOTAL', 'Foreign loan — total', 10],
  ['SOURCE_BOOK_TOTAL', 'Source Book financing total', 11]
];
const classificationHierarchy = {
  SOURCE_BOOK_TOTAL: { level: 'CATEGORY', parent: null },
  GON_COUNTERPART: { level: 'COMPONENT', parent: 'SOURCE_BOOK_TOTAL' },
  FOREIGN_GRANT_TOTAL: { level: 'COMPONENT', parent: 'SOURCE_BOOK_TOTAL' },
  FOREIGN_GRANT_CASH: { level: 'SUBCOMPONENT', parent: 'FOREIGN_GRANT_TOTAL' },
  FOREIGN_GRANT_REIMBURSABLE: { level: 'SUBCOMPONENT', parent: 'FOREIGN_GRANT_TOTAL' },
  FOREIGN_GRANT_DIRECT_PAYMENT: { level: 'SUBCOMPONENT', parent: 'FOREIGN_GRANT_TOTAL' },
  FOREIGN_GRANT_COMMODITY: { level: 'SUBCOMPONENT', parent: 'FOREIGN_GRANT_TOTAL' },
  FOREIGN_LOAN_TOTAL: { level: 'COMPONENT', parent: 'SOURCE_BOOK_TOTAL' },
  FOREIGN_LOAN_DIRECT_PAYMENT: { level: 'SUBCOMPONENT', parent: 'FOREIGN_LOAN_TOTAL' },
  FOREIGN_LOAN_REIMBURSABLE: { level: 'SUBCOMPONENT', parent: 'FOREIGN_LOAN_TOTAL' },
  FOREIGN_LOAN_CASH: { level: 'SUBCOMPONENT', parent: 'FOREIGN_LOAN_TOTAL' }
};
const provinceBySuffix = { koshi: 'Koshi', madhesh: 'Madhesh', bagmati: 'Bagmati', gandaki: 'Gandaki', lumbini: 'Lumbini', karnali: 'Karnali', sudurpaschim: 'Sudurpashchim' };
const canonicalLocalLevels = registry.provinces.flatMap(province => province.districts.flatMap(district => district.localLevels));
function normalizeLocalName(value) { return value.toLowerCase().normalize('NFKD').replace(/\b(urban|rural|sub metropolitan|metropolitan|city|municipality)\b/g, '').replace(/[^a-z0-9]/g, ''); }
const localByNormalizedName = canonicalLocalLevels.reduce((map, item) => { const key = normalizeLocalName(item.nameEn); map.set(key, [...(map.get(key) || []), item]); return map; }, new Map());
const overrideByName = new Map(localOverrides.map(item => [item.sourceName, item.localLevelCode]));

function parseCsv(text) {
  const rows = []; let row = []; let cell = ''; let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted && c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
    else if (c === '"') quoted = !quoted;
    else if (!quoted && c === ',') { row.push(cell); cell = ''; }
    else if (!quoted && (c === '\n' || c === '\r')) {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); if (row.some(v => v.trim())) rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  row.push(cell); if (row.some(v => v.trim())) rows.push(row);
  return rows;
}
function walk(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]); }
function numeric(value) { const v = value.trim().replaceAll(',', ''); return /^-?\d+(\.\d+)?$/.test(v) ? v : null; }
function lakhToNpr(value) {
  const negative = value.startsWith('-'); const [whole, fraction = ''] = value.replace('-', '').split('.');
  const scaled = BigInt(whole || '0') * 100000n + BigInt((fraction + '00000').slice(0, 5));
  return `${negative ? '-' : ''}${scaled}.00`;
}
function pageOf(file) { return Number(file.match(/_page(\d+)_/)?.[1]) || null; }
function sha(files) { const h = crypto.createHash('sha256'); for (const f of files) h.update(path.relative(root, f)).update(fs.readFileSync(f)); return h.digest('hex'); }

async function main() {
  const files = walk(sourceRoot).filter(f => /source-book_kzajtb9_.*_(federal|local|koshi|madhesh|bagmati|gandaki|lumbini|karnali|sudurpaschim)\.csv$/i.test(f));
  const report = { importerVersion: IMPORTER_VERSION, dryRun, datasetKey: manifest.datasetKey, files: files.length, rowsRead: 0, factsAccepted: 0, rowsRejected: 0, reasons: {}, unmatchedGeography: [], limitations: [manifest.coverage, 'Local rows import only when a normalized exact name resolves uniquely to the canonical registry; ambiguous and unmatched rows remain excluded.', 'OAGN parsed audit reports are inventoried but not automatically imported because OCR metadata is contradictory.'] };
  const reject = (reason, detail) => { report.rowsRejected++; report.reasons[reason] = (report.reasons[reason] || 0) + 1; if (detail && report.unmatchedGeography.length < 100) report.unmatchedGeography.push(detail); };
  const staged = []; const mappedLocalCodes = new Set();
  for (const file of files) {
    const suffix = file.match(/_(federal|local|koshi|madhesh|bagmati|gandaki|lumbini|karnali|sudurpaschim)\.csv$/i)?.[1].toLowerCase();
    const level = suffix === 'federal' ? 'FEDERAL' : suffix === 'local' ? 'LOCAL' : 'PROVINCIAL';
    for (const [index, row] of parseCsv(fs.readFileSync(file, 'utf8')).entries()) {
      report.rowsRead++;
      if (row.length < 12) { reject('INVALID_COLUMN_COUNT'); continue; }
      const subject = row[0].replace(/^\uFEFF/, '').trim();
      if (!subject || /^\d+$/.test(subject) || /^(GoN Ref|Code|Details of Sources)/i.test(subject)) { reject('NON_FACT_OR_DETAIL_ROW'); continue; }
      const values = financingColumns.map(([code, label, col]) => ({ code, label, value: numeric(row[col] || '') })).filter(x => x.value !== null);
      if (!values.length) { reject('NO_NUMERIC_AMOUNT'); continue; }
      let localLevelCode = null;
      if (level === 'LOCAL') {
        const overrideCode = overrideByName.get(subject);
        const matches = overrideCode ? canonicalLocalLevels.filter(item => item.code === overrideCode) : (localByNormalizedName.get(normalizeLocalName(subject)) || []);
        if (matches.length !== 1) { reject(matches.length > 1 ? 'AMBIGUOUS_LOCAL_LEVEL' : 'UNMATCHED_LOCAL_LEVEL', `${path.basename(file)}:${index + 1}:${subject}`); continue; }
        localLevelCode = matches[0].code;
        if (mappedLocalCodes.has(localLevelCode)) { reject('DUPLICATE_LOCAL_LEVEL_MAPPING', `${path.basename(file)}:${index + 1}:${subject}:${localLevelCode}`); continue; }
        mappedLocalCodes.add(localLevelCode);
      }
      for (const value of values) staged.push({ file, index, level, provinceName: suffix === 'federal' || suffix === 'local' ? null : provinceBySuffix[suffix], localLevelCode, subject, page: pageOf(file), ...value });
    }
  }
  report.factsAccepted = staged.length;
  report.localCoverage = { expectedCanonicalCount: 753, uniquelyMappedCount: mappedLocalCodes.size, complete: mappedLocalCodes.size === 753, claim: mappedLocalCodes.size === 753 ? 'FULL' : 'PARTIAL' };
  fs.mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, `source-book-${dryRun ? 'dry-run' : 'import'}.json`);
  if (dryRun) { fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify({ ...report, reportPath }, null, 2)); return; }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
  try {
    const { root: _root, filePattern: _filePattern, dataStatus: _dataStatus, factType: _factType, ...sourceData } = manifest;
    const source = await prisma.fiscalDataSource.upsert({ where: { datasetKey: manifest.datasetKey }, update: sourceData, create: sourceData });
    const inputHash = sha(files);
    const prior = await prisma.fiscalImportBatch.findUnique({ where: { sourceId_inputHash_importerVersion_dryRun: { sourceId: source.id, inputHash, importerVersion: IMPORTER_VERSION, dryRun: false } } });
    if (prior?.status === 'COMPLETED') { console.log(`Already imported in batch ${prior.id}; no changes made.`); return; }
    const [provinces, localLevels] = await Promise.all([prisma.province.findMany(), prisma.localLevel.findMany({ select: { id: true, code: true } })]);
    const provinceIds = new Map(provinces.map(p => [p.nameEn.toLowerCase(), p.id]));
    const localLevelIds = new Map(localLevels.map(item => [item.code, item.id]));
    const batch = await prisma.fiscalImportBatch.upsert({ where: { sourceId_inputHash_importerVersion_dryRun: { sourceId: source.id, inputHash, importerVersion: IMPORTER_VERSION, dryRun: false } }, update: { status: 'RUNNING', report }, create: { sourceId: source.id, inputHash, importerVersion: IMPORTER_VERSION, dryRun: false, status: 'RUNNING', report } });
    await prisma.$transaction(async tx => {
      for (const code of ['SOURCE_BOOK_TOTAL', 'FOREIGN_GRANT_TOTAL', 'FOREIGN_LOAN_TOTAL']) {
        const nameEn = financingColumns.find(item => item[0] === code)[1]; const node = classificationHierarchy[code];
        await tx.fiscalClassification.upsert({ where: { code }, update: { nameEn, level: node.level }, create: { code, nameEn, level: node.level } });
      }
      let classes = new Map((await tx.fiscalClassification.findMany({ where: { code: { in: financingColumns.map(x => x[0]) } } })).map(c => [c.code, c.id]));
      for (const [code, nameEn] of financingColumns.filter(item => !['SOURCE_BOOK_TOTAL', 'FOREIGN_GRANT_TOTAL', 'FOREIGN_LOAN_TOTAL'].includes(item[0]))) {
        const node = classificationHierarchy[code]; const parentId = node.parent ? classes.get(node.parent) : null;
        await tx.fiscalClassification.upsert({ where: { code }, update: { nameEn, level: node.level, parentId }, create: { code, nameEn, level: node.level, parentId } });
      }
      const totalId = classes.get('SOURCE_BOOK_TOTAL');
      for (const code of ['FOREIGN_GRANT_TOTAL', 'FOREIGN_LOAN_TOTAL']) await tx.fiscalClassification.update({ where: { code }, data: { parentId: totalId } });
      classes = new Map((await tx.fiscalClassification.findMany({ where: { code: { in: financingColumns.map(x => x[0]) } } })).map(c => [c.code, c.id]));
      for (const fact of staged) {
        const provinceId = fact.provinceName ? provinceIds.get(fact.provinceName.toLowerCase()) : null;
        if (fact.level === 'PROVINCIAL' && !provinceId) { reject('UNMATCHED_PROVINCE', fact.provinceName); continue; }
        const localLevelId = fact.localLevelCode ? localLevelIds.get(fact.localLevelCode) : null;
        if (fact.level === 'LOCAL' && !localLevelId) { reject('CANONICAL_LOCAL_LEVEL_NOT_SEEDED', fact.localLevelCode); continue; }
        const sourceRowKey = `${path.relative(root, fact.file)}:${fact.index + 1}:${fact.code}`;
        await tx.fiscalFact.upsert({ where: { sourceId_sourceRowKey_factType: { sourceId: source.id, sourceRowKey, factType: 'BUDGET' } }, update: { amountNpr: lakhToNpr(fact.value), originalAmount: fact.value, importBatchId: batch.id }, create: { fiscalYear: manifest.fiscalYear, governmentLevel: fact.level, provinceId, localLevelId, factType: 'BUDGET', canonicalClassificationId: classes.get(fact.code), sourceClassificationCode: fact.code, sourceClassificationLabelEn: fact.label, subjectLabel: fact.subject, amountNpr: lakhToNpr(fact.value), originalAmount: fact.value, originalUnit: manifest.originalUnit, sourceId: source.id, importBatchId: batch.id, sourcePage: fact.page, sourceRowKey, dataStatus: manifest.dataStatus, notes: manifest.coverage } });
      }
      await tx.fiscalImportBatch.update({ where: { id: batch.id }, data: { status: 'COMPLETED', rowsRead: report.rowsRead, rowsAccepted: report.factsAccepted, rowsRejected: report.rowsRejected, report, finishedAt: new Date() } });
    });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ ...report, batchId: batch.id, reportPath }, null, 2));
  } finally { await prisma.$disconnect(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
