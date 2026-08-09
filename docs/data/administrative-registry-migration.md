# Administrative registry database migration

No database schema was changed in this pass. Perform this migration with a database backup and review the reconciliation report before making foreign keys required.

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
2. Add the three reference tables with `prisma migrate dev --name add_administrative_registry`.
3. Write a seed importer that reads `shared/data/administrative/nepal-local-levels.json` and upserts by code.
4. Assert exactly 7 provinces, 77 districts, and 753 local levels after seeding.
5. Add nullable `provinceId`, `districtId`, or `localLevelId` columns to relevant fact tables. Start with `LocalBudget`, `SubnationalFinance`, `LocalGranularData`, `FiscalTransfer`, and `UserPreferences`.
6. Produce an alias/reconciliation report matching current names to registry codes. Do not silently accept fuzzy matches.
7. Manually resolve unmatched or ambiguous names, then backfill the nullable foreign keys.
8. Verify that every intended fact row resolves to exactly one administrative record.
9. Add foreign-key indexes. Make a relation required only where the source data guarantees it.
10. Update API filters to query codes (`localLevelId`, `provinceId`) instead of names.

## GeoJSON join

Normalize future GeoJSON once during ingestion so each feature contains `properties.localLevelId` with the same five-digit NSO code. Keep geometry outside the relational reference rows—PostGIS or versioned GeoJSON can own geometry—while application and fiscal tables join through the code.
