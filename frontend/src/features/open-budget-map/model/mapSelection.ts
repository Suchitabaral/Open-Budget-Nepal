export type MapSelectionIds = {
  provinceId: string | null;
  municipalityId: string | null;
};

export function selectProvince(provinceId: string | null): MapSelectionIds {
  return { provinceId, municipalityId: null };
}

export function selectMunicipality(
  provinceId: string,
  municipalityId: string | null,
  municipalityProvinceId: string | null,
): MapSelectionIds {
  return {
    provinceId,
    municipalityId:
      municipalityId && municipalityProvinceId === provinceId ? municipalityId : null,
  };
}

export function isCurrentRequest(requestedId: string, activeId: string | null) {
  return requestedId === activeId;
}

export function updateSelectionParams(
  current: URLSearchParams,
  selection: MapSelectionIds,
) {
  const next = new URLSearchParams(current);

  if (selection.provinceId) next.set("province", selection.provinceId);
  else next.delete("province");

  if (selection.municipalityId) {
    next.set("municipality", selection.municipalityId);
  } else {
    next.delete("municipality");
  }

  return next;
}
