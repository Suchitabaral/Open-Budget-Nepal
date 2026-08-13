import { WATCHDOG_RULES, type WatchdogRuleId, type WatchdogSeverity } from './config';

export type ScoreFactor = { label: string; value: string; points: number };
export type WatchdogFinding = {
  id: string; ruleId: WatchdogRuleId; ruleLabel: string; severity: WatchdogSeverity;
  riskScore: number; scoreMethod: string; scoreFactors: ScoreFactor[];
  contractor: string; project: string; details: string; dataQualityNotes: string[];
  contractId?: number; contractorId?: number; contractCode?: string; fiscalYear?: string;
  municipality?: string; contractStatus?: string; evaluatedAt: string;
};
export type ContractRuleInput = { contractId:number;contractCode:string;project:string;contractor:string;contractorId?:number;expectedDate:Date|null;completionPercentage:number|null;originalContractAmount:number|null;recordedDisbursement:number|null;contractStatus?:string|null;fiscalYear?:string|null };
export type ConcentrationInput = { contractId:number;contractCode:string;project:string;contractorId:number;contractor:string;municipality:string|null;fiscalYear:string|null;isInfrastructure:boolean;contractAmount:number|null;contractorSharePercentage:number|null };

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));
const rounded = (value: number) => Math.round(value);

function base(ruleId: WatchdogRuleId, evaluatedAt: Date) {
  const rule = WATCHDOG_RULES[ruleId];
  return { ruleId, ruleLabel: rule.label, severity: rule.severity, evaluatedAt: evaluatedAt.toISOString() };
}

export function evaluateContractRules(input: ContractRuleInput, currentDate: Date): WatchdogFinding[] {
  const findings: WatchdogFinding[] = [];
  const shared = { contractor:input.contractor,project:input.project,contractId:input.contractId,contractorId:input.contractorId,contractCode:input.contractCode,fiscalYear:input.fiscalYear??undefined,contractStatus:input.contractStatus??undefined };

  if (input.expectedDate !== null && input.completionPercentage !== null
    && currentDate.getTime() > input.expectedDate.getTime()
    && input.completionPercentage < WATCHDOG_RULES.SEVERE_DELAY.completionThreshold) {
    const rule = WATCHDOG_RULES.SEVERE_DELAY;
    const overdueDays = Math.floor((currentDate.getTime() - input.expectedDate.getTime()) / 86_400_000);
    const overduePoints = rule.score.overdueWeight * clamp(overdueDays / rule.score.overdueHorizonDays, 0, 1);
    const completionDeficit = rule.completionThreshold - input.completionPercentage;
    const completionPoints = rule.score.completionWeight * clamp(completionDeficit / rule.completionThreshold, 0, 1);
    const riskScore = rounded(rule.score.base + overduePoints + completionPoints);
    findings.push({
      ...base('SEVERE_DELAY', currentDate), ...shared, riskScore,
      id: `SEVERE_DELAY-contract-${input.contractId}`,
      scoreMethod: '40 base + up to 30 for days overdue over a five-year horizon + up to 30 for completion shortfall below 90%.',
      scoreFactors: [
        { label: 'Rule triggered', value: 'Severe Delay', points: rule.score.base },
        { label: 'Days overdue', value: overdueDays.toLocaleString('en-NP'), points: rounded(overduePoints) },
        { label: 'Recorded completion', value: `${input.completionPercentage}%`, points: rounded(completionPoints) },
      ],
      dataQualityNotes: input.completionPercentage === 0
        ? ['The source reports exactly 0% completion. This may be a valid value or an unupdated source record and should be verified.'] : [],
      details: `Expected completion passed on ${input.expectedDate.toISOString().slice(0,10)}; the project is ${overdueDays.toLocaleString('en-NP')} days overdue with ${input.completionPercentage}% completion recorded.`,
    });
  }

  if (input.originalContractAmount !== null && input.originalContractAmount > 0
    && input.recordedDisbursement !== null && input.recordedDisbursement > input.originalContractAmount) {
    const rule = WATCHDOG_RULES.COST_OVERRUN;
    const overrun = input.recordedDisbursement - input.originalContractAmount;
    const overrunPercentage = overrun / input.originalContractAmount * 100;
    const magnitudePoints = rule.score.magnitudeWeight * clamp(overrunPercentage / rule.score.overrunHorizonPercentage, 0, 1);
    const riskScore = rounded(rule.score.base + magnitudePoints);
    findings.push({
      ...base('COST_OVERRUN', currentDate), ...shared, riskScore,
      id: `COST_OVERRUN-contract-${input.contractId}`,
      scoreMethod: '50 base + up to 50 based on the overrun percentage, reaching the cap at 50% overrun.',
      scoreFactors: [
        { label: 'Rule triggered', value: 'Cost Overrun', points: rule.score.base },
        { label: 'Overrun', value: `${overrunPercentage.toFixed(1)}%`, points: rounded(magnitudePoints) },
      ],
      dataQualityNotes: [],
      details: `Recorded disbursement exceeds the original contract amount by NPR ${overrun.toLocaleString('en-NP',{maximumFractionDigits:2})} (${overrunPercentage.toFixed(1)}%).`,
    });
  }
  return findings;
}

export function evaluateConcentration(rows: ConcentrationInput[], currentDate: Date): WatchdogFinding[] {
  type Group={totals:Map<number,number>;contractors:Map<number,{name:string;value:number;contracts:ConcentrationInput[]}>};
  const groups=new Map<string,Group>();
  for(const row of rows){if(!row.isInfrastructure||!row.municipality||!row.fiscalYear||row.contractAmount===null||row.contractAmount<=0)continue;const key=`${row.municipality}\u0000${row.fiscalYear}`;const group=groups.get(key)??{totals:new Map(),contractors:new Map()};group.totals.set(row.contractId,row.contractAmount);if(row.contractorSharePercentage!==null){const item=group.contractors.get(row.contractorId)??{name:row.contractor,value:0,contracts:[]};item.value+=row.contractAmount*row.contractorSharePercentage/100;item.contracts.push(row);group.contractors.set(row.contractorId,item);}groups.set(key,group);}
  const findings:WatchdogFinding[]=[];
  for(const [key,group] of groups){const [municipality,fiscalYear]=key.split('\u0000');const total=Array.from(group.totals.values()).reduce((sum,value)=>sum+value,0);if(total<=0)continue;for(const [contractorId,item] of group.contractors){const percentage=item.value/total*100;if(percentage<=WATCHDOG_RULES.HIGH_CONCENTRATION.percentageThreshold)continue;const reference=item.contracts[0];const rule=WATCHDOG_RULES.HIGH_CONCENTRATION;const concentrationPoints=rule.score.magnitudeWeight*clamp((percentage-rule.percentageThreshold)/(100-rule.percentageThreshold),0,1);findings.push({...base('HIGH_CONCENTRATION',currentDate),id:`HIGH_CONCENTRATION-${contractorId}-${encodeURIComponent(municipality)}-${encodeURIComponent(fiscalYear)}`,riskScore:rounded(rule.score.base+concentrationPoints),scoreMethod:'40 base at the trigger threshold + up to 60 as contractor share increases from 40% to 100%.',scoreFactors:[{label:'Rule triggered',value:'High Concentration',points:rule.score.base},{label:'Contractor share',value:`${percentage.toFixed(1)}%`,points:rounded(concentrationPoints)}],dataQualityNotes:[],contractorId,contractor:item.name,project:`${municipality} infrastructure contracts`,contractId:reference?.contractId,contractCode:reference?.contractCode,municipality,fiscalYear,details:`${item.name} holds ${percentage.toFixed(1)}% of recorded infrastructure contract value in ${municipality} for FY ${fiscalYear}.`});}}
  return findings;
}

export function municipalityFromPublicEntity(value:string|null):string|null{if(!value||!/(municipality|metropolitan)/i.test(value))return null;return value.normalize('NFKC').replace(/\s+/g,' ').replace(/\s+(office|city office)$/i,'').trim();}
export function filterFindingsBySeverity(findings:WatchdogFinding[],severity?:WatchdogSeverity){return severity?findings.filter(finding=>finding.severity===severity):findings;}
export function summarizeFindings(findings:WatchdogFinding[]){return{total:findings.length,high:filterFindingsBySeverity(findings,'High').length,medium:filterFindingsBySeverity(findings,'Medium').length};}
