import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(frontendRoot, '..');
const geoRoot = path.join(frontendRoot, 'public/geo/nepal');
const registry = JSON.parse(fs.readFileSync(path.join(repoRoot, 'shared/data/administrative/nepal-local-levels.json'), 'utf8'));
const validTypes = new Set(['gaunpalika', 'nagarpalika', 'upamahanagarpalika', 'mahanagarpalika']);
const files = ['koshi', 'madhesh', 'bagmati', 'gandaki', 'lumbini', 'karnali', 'sudurpashchim'];

const normalize = value => String(value ?? '').toLowerCase().replace(/&/g, 'and').replace(/metropolitian/g, 'metropolitan').replace(/sub[- ]?metropolitan|municipality|rural|urban|city|gaunpalika|nagarpalika|upamahanagarpalika|mahanagarpalika/g, '').replace(/[^a-z0-9]/g, '');
const distance = (a, b) => {
  const x = normalize(a), y = normalize(b), row = Array.from({ length: y.length + 1 }, (_, i) => i);
  for (let i = 1; i <= x.length; i += 1) { let previous = row[0]; row[0] = i; for (let j = 1; j <= y.length; j += 1) { const old = row[j]; row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (x[i - 1] === y[j - 1] ? 0 : 1)); previous = old; } }
  return row[y.length];
};
const canonicalType = raw => ({ gaunpalika: 'rural_municipality', nagarpalika: 'municipality', upamahanagarpalika: 'sub_metropolitan', mahanagarpalika: 'metropolitan' })[String(raw).toLowerCase()];
const keyFor = properties => [properties.STATE_CODE, properties.DISTRICT, properties.GaPa_NaPa, properties.Type_GN].join('|');

function assign(source, canonical, label) {
  if (source.length !== canonical.length) throw new Error(`${label}: source count ${source.length} does not match canonical count ${canonical.length}.`);
  const available = new Set(canonical.map((_, index) => index));
  const matches = new Map();
  const exact = source.map((item, index) => ({ index, options: canonical.map((entry, candidate) => normalize(item.name) === normalize(entry.nameEn) ? candidate : -1).filter(candidate => candidate >= 0) }));
  for (const item of exact.filter(item => item.options.length === 1)) { if (available.has(item.options[0])) { matches.set(item.index, item.options[0]); available.delete(item.options[0]); } }
  const pending = source.map((_, index) => index).filter(index => !matches.has(index));
  while (pending.length) {
    let best;
    for (const sourceIndex of pending) for (const candidateIndex of available) {
      const score = distance(source[sourceIndex].name, canonical[candidateIndex].nameEn);
      if (!best || score < best.score) best = { sourceIndex, candidateIndex, score };
    }
    matches.set(best.sourceIndex, best.candidateIndex); available.delete(best.candidateIndex); pending.splice(pending.indexOf(best.sourceIndex), 1);
  }
  return matches;
}

const mapping = {};
const report = { provinces: 7, localLevels: 0, byProvince: {}, duplicatesRemoved: [], protectedFeaturesExcluded: 0, attribution: 'Open Knowledge Nepal — Local Boundaries, CC BY 4.0' };

for (const file of files) {
  const source = JSON.parse(fs.readFileSync(path.join(geoRoot, 'local-levels', `${file}.geojson`), 'utf8'));
  const provinceId = String(source.features.find(feature => validTypes.has(String(feature.properties.Type_GN).toLowerCase())).properties.STATE_CODE);
  const province = registry.provinces.find(item => item.id === provinceId);
  const unique = new Map();
  for (const feature of source.features) {
    if (!validTypes.has(String(feature.properties.Type_GN).toLowerCase())) { report.protectedFeaturesExcluded += 1; continue; }
    const key = keyFor(feature.properties);
    if (unique.has(key.toLowerCase())) { report.duplicatesRemoved.push(key); continue; }
    unique.set(key.toLowerCase(), feature);
  }
  const features = [...unique.values()];
  const districtMatches = assign(
    [...new Set(features.map(feature => feature.properties.DISTRICT))].map(name => ({ name })),
    province.districts.map(district => ({ ...district, nameEn: district.nameEn })),
    `${province.nameEn} districts`,
  );
  const rawDistricts = [...new Set(features.map(feature => feature.properties.DISTRICT))];
  for (const [rawDistrictIndex, canonicalDistrictIndex] of districtMatches) {
    const rawDistrict = rawDistricts[rawDistrictIndex];
    const district = province.districts[canonicalDistrictIndex];
    for (const type of ['rural_municipality', 'municipality', 'sub_metropolitan', 'metropolitan']) {
      const raw = features.filter(feature => feature.properties.DISTRICT === rawDistrict && canonicalType(feature.properties.Type_GN) === type).map(feature => ({ name: feature.properties.GaPa_NaPa, feature }));
      const canonical = district.localLevels.filter(level => level.type === type);
      const localMatches = assign(raw, canonical, `${province.nameEn}/${district.nameEn}/${type}`);
      for (const [rawIndex, canonicalIndex] of localMatches) {
        const feature = raw[rawIndex].feature; const level = canonical[canonicalIndex]; const key = keyFor(feature.properties);
        mapping[key] = level.id;
        feature.properties = { ...feature.properties, provinceId: province.id, provinceCode: province.code, provinceName: province.nameEn, districtId: district.id, districtName: district.nameEn, municipalityId: level.id, municipalityCode: level.code, municipalityName: level.nameEn, municipalityNameNe: level.nameNe, municipalityType: level.type };
      }
    }
  }
  const normalized = { type: 'FeatureCollection', features };
  fs.writeFileSync(path.join(geoRoot, 'local-levels', `${file}.normalized.geojson`), JSON.stringify(normalized));
  report.byProvince[province.nameEn] = features.length; report.localLevels += features.length;
}

if (report.localLevels !== 753 || Object.keys(mapping).length !== 753) throw new Error(`Expected 753 normalized local levels, received ${report.localLevels}.`);
if (new Set(Object.values(mapping)).size !== 753) throw new Error('Canonical local-level mappings are not one-to-one.');
fs.writeFileSync(path.join(geoRoot, 'geometry-mapping.json'), JSON.stringify(mapping, null, 2));
fs.writeFileSync(path.join(geoRoot, 'validation-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
