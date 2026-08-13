"""Generate the canonical Nepal administrative registry from the NSO XLS workbook.

Usage:
  PYTHONPATH=/path/to/xlrd python3 scripts/data/generate_local_level_registry.py \
    official-local-level-codes.xls shared/data/administrative/nepal-local-levels.json
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import xlrd

PROVINCES = {
    1: "Koshi",
    2: "Madhesh",
    3: "Bagmati",
    4: "Gandaki",
    5: "Lumbini",
    6: "Karnali",
    7: "Sudurpashchim",
}


def local_level_type(name: str) -> str:
    lowered = name.lower()
    if "sub-metropolitan" in lowered or "sub-metropolitian" in lowered:
        return "sub_metropolitan"
    if "metropolitan" in lowered or "metropolitian" in lowered:
        return "metropolitan"
    if "rural municipality" in lowered:
        return "rural_municipality"
    if "municipality" in lowered:
        return "municipality"
    raise ValueError(f"Unknown local-level type: {name}")


def main(source: Path, destination: Path) -> None:
    workbook = xlrd.open_workbook(source)
    district_sheet = workbook.sheet_by_name("district_code")
    local_sheet = workbook.sheet_by_name("localunit_code")

    districts = {
        int(district_sheet.cell_value(row, 4)): str(district_sheet.cell_value(row, 2)).title()
        for row in range(3, district_sheet.nrows)
        if district_sheet.cell_value(row, 4)
    }
    local_levels = []
    for row in range(3, local_sheet.nrows):
        raw_code = local_sheet.cell_value(row, 4)
        if not raw_code:
            continue
        code = f"{int(raw_code):05d}"
        district_code = int(code[:3])
        province_code = int(code[0])
        local_levels.append({
            "id": code,
            "code": code,
            "nameEn": str(local_sheet.cell_value(row, 2)).strip(),
            "nameNe": str(local_sheet.cell_value(row, 3)).strip(),
            "type": local_level_type(str(local_sheet.cell_value(row, 2))),
            "provinceId": str(province_code),
            "districtId": f"{district_code:03d}",
        })

    if len(PROVINCES) != 7 or len(districts) != 77 or len(local_levels) != 753:
        raise ValueError(f"Unexpected counts: {len(PROVINCES)} provinces, {len(districts)} districts, {len(local_levels)} local levels")

    nested = []
    for province_code, province_name in PROVINCES.items():
        province_districts = []
        for district_code, district_name in districts.items():
            if int(str(district_code)[0]) != province_code:
                continue
            children = [item for item in local_levels if item["districtId"] == f"{district_code:03d}"]
            province_districts.append({"id": f"{district_code:03d}", "code": f"{district_code:03d}", "nameEn": district_name, "provinceId": str(province_code), "localLevels": children})
        nested.append({"id": str(province_code), "code": str(province_code), "nameEn": province_name, "districts": province_districts})

    type_counts = {}
    for item in local_levels:
        type_counts[item["type"]] = type_counts.get(item["type"], 0) + 1

    payload = {
        "version": 1,
        "source": {
            "publisher": "National Statistics Office, Government of Nepal",
            "title": "Geographical codes — local units",
            "url": "https://nsonepal.gov.np/content/7694/7694-geographical-codes-map-provi/",
            "retrieved": "2026-07-21"
        },
        "counts": {"provinces": 7, "districts": 77, "localLevels": 753, "byType": type_counts},
        "provinces": nested,
    }
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(payload["counts"], ensure_ascii=False))


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("Expected source XLS and destination JSON paths")
    main(Path(sys.argv[1]), Path(sys.argv[2]))
