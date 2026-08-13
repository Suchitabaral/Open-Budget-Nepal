import registry from "@shared-data/administrative/nepal-local-levels.json";

export type LocalLevelType = "metropolitan" | "sub_metropolitan" | "municipality" | "rural_municipality";
export type LocalLevel = {
  id: string;
  code: string;
  nameEn: string;
  nameNe: string;
  type: LocalLevelType;
  provinceId: string;
  districtId: string;
};

const localLevels = registry.provinces.flatMap(province =>
  province.districts.flatMap(district => district.localLevels as LocalLevel[]),
);

if (localLevels.length !== registry.counts.localLevels) {
  throw new Error("Administrative registry count does not match its metadata.");
}

export const administrativeRegistry = {
  provinces: registry.provinces.map(province => ({ id: province.id, label: province.nameEn })),
  localLevels,
};
