import assert from 'node:assert/strict';
import test from 'node:test';
import {
  evaluateConcentration,
  evaluateContractRules,
  filterFindingsBySeverity,
  summarizeFindings,
  type ConcentrationInput,
  type ContractRuleInput,
} from './service';

const now = new Date('2026-08-12T00:00:00.000Z');
const baseContract: ContractRuleInput = {
  contractId: 1,
  contractCode: 'C-1',
  project: 'Road construction',
  contractor: 'ABC Builders',
  contractorId: 10,
  expectedDate: new Date('2026-08-01T00:00:00.000Z'),
  completionPercentage: 70,
  originalContractAmount: 100,
  recordedDisbursement: 90,
  contractStatus: 'In progress',
  fiscalYear: '2082/83',
};

test('severe delay requires a passed date and completion below 90 percent', () => {
  assert.deepEqual(evaluateContractRules(baseContract, now).map((item) => item.ruleId), ['SEVERE_DELAY']);
  assert.equal(evaluateContractRules({ ...baseContract, completionPercentage: 90 }, now).length, 0);
  assert.equal(evaluateContractRules({ ...baseContract, expectedDate: new Date('2026-08-13') }, now).length, 0);
  assert.equal(evaluateContractRules({ ...baseContract, completionPercentage: null }, now).length, 0);
  assert.equal(evaluateContractRules({ ...baseContract, expectedDate: null }, now).length, 0);
});

test('cost overrun requires disbursement strictly above the original amount', () => {
  assert.deepEqual(evaluateContractRules({ ...baseContract, expectedDate: null, recordedDisbursement: 101 }, now).map((item) => item.ruleId), ['COST_OVERRUN']);
  assert.equal(evaluateContractRules({ ...baseContract, expectedDate: null, recordedDisbursement: 100 }, now).length, 0);
  assert.equal(evaluateContractRules({ ...baseContract, expectedDate: null, recordedDisbursement: null }, now).length, 0);
  assert.equal(evaluateContractRules({ ...baseContract, expectedDate: null, originalContractAmount: 0, recordedDisbursement: 100 }, now).length, 0);
});

const concentrationRows = (share: number): ConcentrationInput[] => [
  { contractId: 1, contractCode: 'C-1', project: 'Road A', contractorId: 10, contractor: 'ABC Builders', municipality: 'Kathmandu Metropolitan City', fiscalYear: '2082/83', isInfrastructure: true, contractAmount: share, contractorSharePercentage: 100 },
  { contractId: 2, contractCode: 'C-2', project: 'Road B', contractorId: 20, contractor: 'XYZ Builders', municipality: 'Kathmandu Metropolitan City', fiscalYear: '2082/83', isInfrastructure: true, contractAmount: 100 - share, contractorSharePercentage: 100 },
];

test('high concentration is strict above 40 percent and skips incomplete grouping data', () => {
  assert.equal(evaluateConcentration(concentrationRows(41), now).some((item) => item.contractorId === 10), true);
  assert.equal(evaluateConcentration(concentrationRows(40), now).some((item) => item.contractorId === 10), false);
  assert.equal(evaluateConcentration(concentrationRows(39), now).some((item) => item.contractorId === 10), false);
  assert.equal(evaluateConcentration([{ ...concentrationRows(60)[0], municipality: null }], now).length, 0);
  assert.equal(evaluateConcentration([{ ...concentrationRows(60)[0], contractorSharePercentage: null }], now).length, 0);
});

test('multiple findings are preserved and summaries and severity filters are exact', () => {
  const findings = evaluateContractRules({ ...baseContract, recordedDisbursement: 120 }, now);
  assert.deepEqual(findings.map((item) => item.ruleId), ['SEVERE_DELAY', 'COST_OVERRUN']);
  assert.deepEqual(findings.map((item) => item.riskScore), [47, 70]);
  assert.equal(findings.every((item) => item.scoreFactors.length > 0 && item.scoreMethod.length > 0), true);
  assert.deepEqual(summarizeFindings(findings), { total: 2, high: 2, medium: 0 });
  assert.equal(filterFindingsBySeverity(findings, 'High').length, 2);
  assert.deepEqual(summarizeFindings([]), { total: 0, high: 0, medium: 0 });
});
