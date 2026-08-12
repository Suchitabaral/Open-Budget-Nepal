import registry from "@shared-data/administrative/nepal-local-levels.json";

export type ProvinceOption = { id: string; code: string; name: string; slug: string };
export type MunicipalityProperties = { provinceId: string; provinceCode: string; provinceName: string; districtId: string; districtName: string; municipalityId: string; municipalityCode: string; municipalityName: string; municipalityNameNe: string; municipalityType: string };
export type GeoFeature = GeoJSON.Feature<GeoJSON.Geometry, Record<string, unknown>>;
export type GeoCollection = GeoJSON.FeatureCollection<GeoJSON.Geometry, Record<string, unknown>>;

const slugs = ["koshi", "madhesh", "bagmati", "gandaki", "lumbini", "karnali", "sudurpashchim"];
export const provinces: ProvinceOption[] = registry.provinces.map((province, index) => ({ id: province.id, code: province.code, name: province.nameEn, slug: slugs[index] }));
export const localLevels = registry.provinces.flatMap(province => province.districts.flatMap(district => district.localLevels.map(level => ({ ...level, provinceName: province.nameEn, districtName: district.nameEn }))));
export const localLevelById = new Map(localLevels.map(level => [level.id, level]));
export const VALID_LOCAL_TYPES = new Set(["rural_municipality", "municipality", "sub_metropolitan", "metropolitan"]);

const cache = new Map<string, GeoCollection>();
export async function loadProvinceGeometry(province: ProvinceOption, signal?: AbortSignal) {
  const cached = cache.get(province.id); if (cached) return cached;
  const response = await fetch(`/geo/nepal/local-levels/${province.slug}.normalized.geojson`, { signal });
  if (!response.ok) throw new Error(`Boundary file returned ${response.status}.`);
  const data = await response.json() as GeoCollection;
  if (data.type !== "FeatureCollection" || !Array.isArray(data.features)) throw new Error("Boundary file is not valid GeoJSON.");
  const selectable = data.features.filter(feature => VALID_LOCAL_TYPES.has(String(feature.properties?.municipalityType)));
  const expected = localLevels.filter(level => level.provinceId === province.id).length;
  if (selectable.length !== expected || new Set(selectable.map(feature => feature.properties?.municipalityId)).size !== expected) throw new Error(`Expected ${expected} canonical local levels for ${province.name}, received ${selectable.length}.`);
  cache.set(province.id, { ...data, features: selectable }); return cache.get(province.id)!;
}

export function validUrlSelection(provinceId: string | null, municipalityId: string | null) {
  const province = provinces.find(item => item.id === provinceId) ?? null;
  const municipality = municipalityId ? localLevelById.get(municipalityId) ?? null : null;
  return { province, municipality: province && municipality?.provinceId === province.id ? municipality : null };
}
