# Administrative registry database migration

The Prisma schema and idempotent seed importer now include the three administrative reference tables. No migration has been executed against a database, and no existing fact table has been altered. Back up the database and review the reconciliation report before adding required foreign keys.

## Proposed tables

```prisma
model Province {
  id        String      @id
  code      String      @unique
  nameEn    String      @map("name_en")
  districts District[]
  localLevels LocalLevel[]
  @@map("provinces")
}

model District {
  id         String       @id
  code       String       @unique
  nameEn     String       @map("name_en")
  provinceId String       @map("province_id")
  province   Province     @relation(fields: [provinceId], references: [id])
  localLevels LocalLevel[]
  @@index([provinceId])
  @@map("districts")
}

model LocalLevel {
  id         String   @id
  code       String   @unique
  nameEn     String   @map("name_en")
  nameNe     String   @map("name_ne")
  type       String
  provinceId String   @map("province_id")
  districtId String   @map("district_id")
  province   Province @relation(fields: [provinceId], references: [id])
  district   District @relation(fields: [districtId], references: [id])
  @@index([provinceId])
  @@index([districtId])
  @@index([type])
  @@map("local_levels")
}
```

## Safe migration sequence

1. Back up PostgreSQL and record current row counts.
2. Create the three reference tables with `npm run prisma:migrate -- --name add_administrative_registry` from `backend/`.
3. Run `npm run db:seed:registry`; the importer reads `shared/data/administrative/nepal-local-levels.json` and idempotently upserts only the hierarchy. The general `db:seed` command reloads development fixture tables and must not be used on a database containing data that should be preserved.
4. Assert exactly 7 provinces, 77 districts, and 753 local levels after seeding.
5. Add nullable `provinceId`, `districtId`, or `localLevelId` columns to relevant fact tables. Start with `LocalBudget`, `SubnationalFinance`, `LocalGranularData`, `FiscalTransfer`, and `UserPreferences`.
6. Produce an alias/reconciliation report matching current names to registry codes. Do not silently accept fuzzy matches.
7. Manually resolve unmatched or ambiguous names, then backfill the nullable foreign keys.
8. Verify that every intended fact row resolves to exactly one administrative record.
9. Add foreign-key indexes. Make a relation required only where the source data guarantees it.
10. Update API filters to query codes (`localLevelId`, `provinceId`) instead of names.

## GeoJSON join

Normalize future GeoJSON once during ingestion so each feature contains `properties.localLevelId` with the same five-digit NSO code. Keep geometry outside the relational reference rows—PostGIS or versioned GeoJSON can own geometry—while application and fiscal tables join through the code.
