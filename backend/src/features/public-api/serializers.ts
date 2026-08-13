export const decimalString = (value: { toString(): string } | null | undefined) => value == null ? null : value.toString();

export const source = (dataset: string | null | undefined) => dataset ? [{ dataset }] : [];

export function contractDto(contract: any, detail = false) {
  const base = {
    id: contract.id,
    contractCode: contract.contractCode,
    name: contract.contractName,
    fiscalYear: contract.fiscalYear,
    amount: decimalString(contract.contractAmount),
    revisedAmount: decimalString(contract.revisedContractAmount),
    currency: 'NPR',
    status: contract.contractStatus,
    procurementMethod: contract.procurementMethod,
    procurementCategory: contract.procurementCategory,
    procuringEntity: contract.publicEntityName,
    municipality: contract.municipality,
    contractDate: contract.contractDate,
    completionPercentage: decimalString(contract.percentageOfCompletion),
    contractors: (contract.contractors ?? []).map((link: any) => ({
      id: link.contractor.id,
      name: link.contractor.name,
      pan: link.contractor.vatNumber,
      sharePercentage: decimalString(link.sharePercentage),
    })),
    sources: source(contract.sourceDataset),
  };
  return detail ? {
    ...base,
    projectDescription: contract.projectDescription,
    startDate: contract.startDate,
    expectedCompletionDate: contract.endOrCompleteDate ?? contract.deliveryDate,
    actualCompletionDate: contract.actualCompletionDate,
    totalPayment: decimalString(contract.totalPayment),
    estimatedCost: decimalString(contract.estimatedCost),
    sourceOfFund: contract.sourceOfFund,
  } : base;
}
