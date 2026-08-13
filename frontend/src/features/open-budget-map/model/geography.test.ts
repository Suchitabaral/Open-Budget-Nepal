import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd(), "public/geo/nepal");
const report = JSON.parse(fs.readFileSync(path.join(root, "validation-report.json"), "utf8"));
const mapping = JSON.parse(fs.readFileSync(path.join(root, "geometry-mapping.json"), "utf8"));

test("national geography has seven provinces and 753 canonical local levels", () => {
  const provinces = JSON.parse(fs.readFileSync(path.join(root, "provinces.geojson"), "utf8"));
  assert.equal(provinces.features.length, 7);
  assert.equal(report.localLevels, 753);
  assert.equal(Object.keys(mapping).length, 753);
  assert.equal(new Set(Object.values(mapping)).size, 753);
});

test("protected areas are excluded and duplicate polygons are recorded", () => {
  assert.equal(report.protectedFeaturesExcluded, 22);
  assert.deepEqual(report.duplicatesRemoved, ["4|NAWALPARASI_E|Binayee Tribeni|Gaunpalika", "5|BARDIYA|Bansagadhi|Nagarpalika"]);
  for (const file of fs.readdirSync(path.join(root, "local-levels")).filter(file => file.endsWith(".normalized.geojson"))) {
    const data = JSON.parse(fs.readFileSync(path.join(root, "local-levels", file), "utf8"));
    assert.ok(data.features.every((feature: { properties: { municipalityId?: string } }) => feature.properties.municipalityId));
  }
});

test("province totals match the canonical registry", () => {
  assert.deepEqual(report.byProvince, { Koshi: 137, Madhesh: 136, Bagmati: 119, Gandaki: 85, Lumbini: 109, Karnali: 79, Sudurpashchim: 88 });
});
