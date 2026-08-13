const assert = require('node:assert/strict');
const test = require('node:test');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

test('fiscal dry run inventories sources and never claims incomplete local coverage', () => {
  const result = spawnSync(process.execPath, [path.join(__dirname, 'import-fiscal-data.js'), '--dry-run'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.datasetKey, 'source-book-2025-26-foreign-assistance');
  assert.equal(report.dryRun, true);
  assert.ok(report.files > 100);
  assert.ok(report.factsAccepted > 0);
  assert.equal(report.localCoverage.expectedCanonicalCount, 753);
  assert.equal(report.localCoverage.complete, report.localCoverage.uniquelyMappedCount === 753);
  assert.ok(report.reasons.UNMATCHED_LOCAL_LEVEL > 0);
  assert.match(report.limitations.join(' '), /Foreign-assisted project financing only/);
});
