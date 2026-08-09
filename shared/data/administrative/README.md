# Nepal administrative registry

`nepal-local-levels.json` is the canonical non-spatial administrative hierarchy shared by the frontend, backend import tooling, and future GeoJSON processing.

The registry is generated from the National Statistics Office geographical-code workbook. Do not edit the generated JSON manually. Regenerate it with `scripts/data/generate_local_level_registry.py`, then verify the declared counts before committing it.

Stable join keys:

- Province: one-digit NSO code
- District: three-digit NSO code
- Local level: five-digit NSO code

Future GeoJSON features should expose the local-level code as `properties.localLevelId`. Application data should join to geometry by code, never by display name.
