import assert from "node:assert/strict";
import test from "node:test";
import {
  isCurrentRequest,
  selectMunicipality,
  selectProvince,
  updateSelectionParams,
} from "./mapSelection.ts";

test("switching provinces clears the municipality and its URL parameter", () => {
  const selection = selectProvince("7");
  const params = updateSelectionParams(
    new URLSearchParams("province=4&municipality=pokhara&fy=2081%2F82"),
    selection,
  );

  assert.deepEqual(selection, { provinceId: "7", municipalityId: null });
  assert.equal(params.get("province"), "7");
  assert.equal(params.get("municipality"), null);
  assert.equal(params.get("fy"), "2081/82");
});

test("a municipality is accepted only under its parent province", () => {
  assert.deepEqual(selectMunicipality("4", "pokhara", "4"), {
    provinceId: "4",
    municipalityId: "pokhara",
  });
  assert.deepEqual(selectMunicipality("7", "pokhara", "4"), {
    provinceId: "7",
    municipalityId: null,
  });
});

test("rapid switching commits only the active province request", () => {
  const activeProvinceId = "7";
  assert.equal(isCurrentRequest("4", activeProvinceId), false);
  assert.equal(isCurrentRequest("3", activeProvinceId), false);
  assert.equal(isCurrentRequest("7", activeProvinceId), true);
});

test("breadcrumb transitions clear child geography", () => {
  assert.deepEqual(selectProvince("4"), {
    provinceId: "4",
    municipalityId: null,
  });
  assert.deepEqual(selectProvince(null), {
    provinceId: null,
    municipalityId: null,
  });
});
