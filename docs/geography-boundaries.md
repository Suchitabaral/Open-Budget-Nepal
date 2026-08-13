# Nepal administrative boundaries

The Open Budget Map uses boundary geometry from **Open Knowledge Nepal — Local Boundaries**, licensed under **CC BY 4.0**.

Source files: `https://github.com/openknowledgenp/localboundaries`, retrieved for the map implementation on 2026-08-13. Runtime requests use only the copies under `frontend/public/geo/nepal`; the application does not fetch GitHub.

Canonical administrative identity comes from `shared/data/administrative/nepal-local-levels.json` (National Statistics Office codes). The preparation script filters actual government types, removes exact duplicate polygons, assigns each geometry to one canonical NSO record within its province, district, and municipality type, and writes normalized GeoJSON plus a validation report.

Run:

```bash
cd frontend
node scripts/prepare-nepal-geo.mjs
```

The script fails unless all 753 canonical local levels resolve one-to-one.
