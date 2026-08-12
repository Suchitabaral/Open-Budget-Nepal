import { Router } from 'express';
import { prisma } from '../../infrastructure/database/prisma';
import { asyncHandler } from '../../shared/http';
import { WATCHDOG_SOURCE_DATASETS, WATCHDOG_SEVERITY_ORDER } from './config';
import {
  evaluateConcentration,
  evaluateContractRules,
  municipalityFromPublicEntity,
  summarizeFindings,
  type ConcentrationInput,
  type WatchdogFinding,
} from './service';

const router = Router();

router.get('/', asyncHandler(async (_req, res) => {
  const evaluatedAt = new Date();
  const contracts = await prisma.contract.findMany({
    where: { sourceDataset: { in: [...WATCHDOG_SOURCE_DATASETS] } },
    include: { contractors: { include: { contractor: true } } },
  });

  const contractFindings = contracts.flatMap(contract => evaluateContractRules({
    contractId: contract.id,
    contractCode: contract.contractCode,
    project: contract.contractName,
    contractor: contract.contractors.map(link => link.contractor.name).join(', ') || 'Contractor not recorded',
    contractorId: contract.contractors.length === 1 ? contract.contractors[0].contractorId : undefined,
    expectedDate: contract.deliveryDate ?? contract.endOrCompleteDate,
    completionPercentage: contract.percentageOfCompletion === null ? null : Number(contract.percentageOfCompletion),
    originalContractAmount: contract.contractAmount === null ? null : Number(contract.contractAmount),
    recordedDisbursement: contract.totalPayment === null ? null : Number(contract.totalPayment),
    contractStatus: contract.contractStatus,
    fiscalYear: contract.fiscalYear,
  }, evaluatedAt));

  const concentrationRows: ConcentrationInput[] = contracts.flatMap(contract => contract.contractors.map(link => ({
    contractId: contract.id,
    contractCode: contract.contractCode,
    project: contract.contractName,
    contractorId: link.contractorId,
    contractor: link.contractor.name,
    municipality: contract.municipality ?? municipalityFromPublicEntity(contract.publicEntityName),
    fiscalYear: contract.fiscalYear,
    isInfrastructure: contract.procurementCategory === 'Works',
    contractAmount: contract.contractAmount === null ? null : Number(contract.contractAmount),
    contractorSharePercentage: link.sharePercentage === null
      ? (contract.contractors.length === 1 ? 100 : null)
      : Number(link.sharePercentage),
  })));

  const findings = [...contractFindings, ...evaluateConcentration(concentrationRows, evaluatedAt)];
  findings.sort((a, b) => a.ruleLabel.localeCompare(b.ruleLabel) || a.contractor.localeCompare(b.contractor) || a.id.localeCompare(b.id));

  const findingsByContract = new Map<number, WatchdogFinding[]>();
  for (const finding of findings) {
    if (finding.contractId === undefined) continue;
    const current = findingsByContract.get(finding.contractId) ?? [];
    current.push(finding);
    findingsByContract.set(finding.contractId, current);
  }

  const contractorRisk = new Map<number, WatchdogFinding>();
  for (const contract of contracts) {
    for (const finding of findingsByContract.get(contract.id) ?? []) {
      const contractorIds = finding.contractorId !== undefined
        ? [finding.contractorId]
        : contract.contractors.map(link => link.contractorId);
      for (const contractorId of contractorIds) {
        const current = contractorRisk.get(contractorId);
        if (!current
          || WATCHDOG_SEVERITY_ORDER[finding.severity] > WATCHDOG_SEVERITY_ORDER[current.severity]
          || (finding.severity === current.severity && finding.riskScore > current.riskScore)) {
          contractorRisk.set(contractorId, finding);
        }
      }
    }
  }

  const projects = contracts.map(contract => {
    const projectFindings = findingsByContract.get(contract.id) ?? [];
    const municipality = contract.municipality ?? municipalityFromPublicEntity(contract.publicEntityName);
    const delayEligible = (contract.deliveryDate !== null || contract.endOrCompleteDate !== null)
      && contract.percentageOfCompletion !== null;
    const overrunEligible = contract.contractAmount !== null && contract.totalPayment !== null;
    const concentrationEligible = contract.procurementCategory === 'Works'
      && municipality !== null
      && contract.fiscalYear !== null
      && contract.contractAmount !== null
      && contract.contractors.length > 0;
    const directEvaluationStatus = projectFindings.length > 0
      ? 'TRIGGERED'
      : (delayEligible || overrunEligible || concentrationEligible ? 'NO_FINDING' : 'INSUFFICIENT_DATA');
    const highestFinding = [...projectFindings].sort((a, b) =>
      WATCHDOG_SEVERITY_ORDER[b.severity] - WATCHDOG_SEVERITY_ORDER[a.severity]
      || b.riskScore - a.riskScore)[0];
    const inheritedFinding = directEvaluationStatus === 'INSUFFICIENT_DATA'
      ? contract.contractors
        .flatMap(link => contractorRisk.get(link.contractorId) ?? [])
        .sort((a, b) => WATCHDOG_SEVERITY_ORDER[b.severity] - WATCHDOG_SEVERITY_ORDER[a.severity]
          || b.riskScore - a.riskScore)[0]
      : undefined;
    const displayedFinding = highestFinding ?? inheritedFinding;
    const evaluationStatus = inheritedFinding ? 'INHERITED_CONTRACTOR_RISK' : directEvaluationStatus;
    const inheritedNote = inheritedFinding
      ? `This project has insufficient fields for direct evaluation. Its linked contractor has a ${inheritedFinding.ruleLabel} finding on “${inheritedFinding.project}” (${inheritedFinding.contractCode ?? inheritedFinding.id}).`
      : null;

    return {
      id: `contract-${contract.id}`,
      contractId: contract.id,
      contractCode: contract.contractCode,
      project: contract.contractName,
      contractor: contract.contractors.map(link => link.contractor.name).join(', ') || 'Contractor not recorded',
      contractorId: contract.contractors.length === 1 ? contract.contractors[0].contractorId : undefined,
      fiscalYear: contract.fiscalYear,
      municipality,
      contractStatus: contract.contractStatus,
      sourceDataset: contract.sourceDataset,
      sourceVerificationStatus: contract.sourceVerificationStatus,
      evaluationStatus,
      riskScore: displayedFinding?.riskScore ?? null,
      severity: displayedFinding?.severity ?? null,
      ruleLabel: inheritedFinding ? `Contractor history: ${inheritedFinding.ruleLabel}` : (projectFindings.map(finding => finding.ruleLabel).join(', ') || null),
      scoreMethod: inheritedFinding
        ? 'Inherited from the highest-severity finding attached to the same contractor through an exact database relationship. This project was not directly scored.'
        : (highestFinding?.scoreMethod ?? null),
      scoreFactors: inheritedFinding
        ? [{ label: 'Contractor finding', value: `${inheritedFinding.ruleLabel} on ${inheritedFinding.project}`, points: inheritedFinding.riskScore }]
        : (highestFinding?.scoreFactors ?? []),
      dataQualityNotes: Array.from(new Set([
        ...projectFindings.flatMap(finding => finding.dataQualityNotes),
        ...(inheritedNote ? [inheritedNote] : []),
      ])),
      inheritedFrom: inheritedFinding ? {
        findingId: inheritedFinding.id,
        contractId: inheritedFinding.contractId,
        contractCode: inheritedFinding.contractCode,
        project: inheritedFinding.project,
        ruleLabel: inheritedFinding.ruleLabel,
      } : null,
      details: inheritedNote ?? (projectFindings.map(finding => finding.details).join(' ') || (evaluationStatus === 'NO_FINDING'
        ? 'Available fields were evaluated and no configured Watchdog rule was triggered.'
        : 'Required financial, schedule, completion, or location fields are not available for rule evaluation.')),
      findings: projectFindings,
      evaluatedAt: evaluatedAt.toISOString(),
    };
  }).sort((a, b) => a.project.localeCompare(b.project) || a.contractCode.localeCompare(b.contractCode));

  res.json({
    findings,
    projects,
    summary: {
      ...summarizeFindings(findings),
      monitoredProjects: projects.length,
      triggeredProjects: projects.filter(project => project.evaluationStatus === 'TRIGGERED').length,
      inheritedRiskProjects: projects.filter(project => project.evaluationStatus === 'INHERITED_CONTRACTOR_RISK').length,
      noFindingProjects: projects.filter(project => project.evaluationStatus === 'NO_FINDING').length,
      insufficientDataProjects: projects.filter(project => project.evaluationStatus === 'INSUFFICIENT_DATA').length,
    },
    evaluatedAt: evaluatedAt.toISOString(),
  });
}));

export default router;
