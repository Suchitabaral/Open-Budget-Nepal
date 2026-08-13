CREATE TYPE "GovernmentLevel" AS ENUM ('FEDERAL', 'PROVINCIAL', 'LOCAL');
CREATE TYPE "FiscalFactType" AS ENUM ('BUDGET', 'ACTUAL');
CREATE TYPE "FiscalDataStatus" AS ENUM ('FINAL', 'PRELIMINARY', 'PARTIAL', 'SYNTHETIC');
CREATE TYPE "FiscalClassificationLevel" AS ENUM ('CATEGORY', 'SUBCATEGORY', 'COMPONENT', 'SUBCOMPONENT', 'SUB_SUBCOMPONENT');
CREATE TYPE "FiscalSourceType" AS ENUM ('SOURCE_BOOK', 'AUDIT_REPORT', 'OTHER');

CREATE TABLE "fiscal_classifications" (
  "id" SERIAL PRIMARY KEY, "code" TEXT NOT NULL UNIQUE, "name_en" TEXT NOT NULL,
  "name_ne" TEXT, "level" "FiscalClassificationLevel" NOT NULL, "parent_id" INTEGER,
  CONSTRAINT "fiscal_classifications_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "fiscal_classifications"("id")
);
CREATE INDEX "fiscal_classifications_parent_id_idx" ON "fiscal_classifications"("parent_id");
CREATE INDEX "fiscal_classifications_level_idx" ON "fiscal_classifications"("level");

CREATE TABLE "fiscal_data_sources" (
  "id" SERIAL PRIMARY KEY, "dataset_key" TEXT NOT NULL UNIQUE, "source_agency" TEXT NOT NULL,
  "document_title" TEXT NOT NULL, "source_url" TEXT, "published_date" TIMESTAMP(3),
  "fiscal_year" TEXT NOT NULL, "pages" TEXT, "original_unit" TEXT NOT NULL,
  "source_type" "FiscalSourceType" NOT NULL, "coverage" TEXT NOT NULL, "notes" TEXT,
  "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "fiscal_data_sources_fiscal_year_source_type_idx" ON "fiscal_data_sources"("fiscal_year", "source_type");

CREATE TABLE "fiscal_import_batches" (
  "id" SERIAL PRIMARY KEY, "source_id" INTEGER NOT NULL, "input_hash" TEXT NOT NULL,
  "importer_version" TEXT NOT NULL, "dry_run" BOOLEAN NOT NULL DEFAULT false, "status" TEXT NOT NULL,
  "rows_read" INTEGER NOT NULL DEFAULT 0, "rows_accepted" INTEGER NOT NULL DEFAULT 0,
  "rows_rejected" INTEGER NOT NULL DEFAULT 0, "report" JSONB, "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finished_at" TIMESTAMP(3), CONSTRAINT "fiscal_import_batches_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "fiscal_data_sources"("id")
);
CREATE UNIQUE INDEX "fiscal_import_batches_source_id_input_hash_importer_version_dry_run_key" ON "fiscal_import_batches"("source_id", "input_hash", "importer_version", "dry_run");
CREATE INDEX "fiscal_import_batches_status_started_at_idx" ON "fiscal_import_batches"("status", "started_at");

CREATE TABLE "fiscal_facts" (
  "id" SERIAL PRIMARY KEY, "fiscal_year" TEXT NOT NULL, "government_level" "GovernmentLevel" NOT NULL,
  "province_id" TEXT, "local_level_id" TEXT, "fact_type" "FiscalFactType" NOT NULL,
  "canonical_classification_id" INTEGER, "source_classification_code" TEXT,
  "source_classification_label_ne" TEXT, "source_classification_label_en" TEXT,
  "subject_code" TEXT, "subject_label" TEXT, "amount_npr" DECIMAL(24,2),
  "original_amount" DECIMAL(24,4), "original_unit" TEXT NOT NULL, "source_id" INTEGER NOT NULL,
  "import_batch_id" INTEGER, "source_page" INTEGER, "source_row_key" TEXT NOT NULL,
  "data_status" "FiscalDataStatus" NOT NULL, "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "fiscal_facts_province_id_fkey" FOREIGN KEY ("province_id") REFERENCES "provinces"("id"),
  CONSTRAINT "fiscal_facts_local_level_id_fkey" FOREIGN KEY ("local_level_id") REFERENCES "local_levels"("id"),
  CONSTRAINT "fiscal_facts_canonical_classification_id_fkey" FOREIGN KEY ("canonical_classification_id") REFERENCES "fiscal_classifications"("id"),
  CONSTRAINT "fiscal_facts_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "fiscal_data_sources"("id"),
  CONSTRAINT "fiscal_facts_import_batch_id_fkey" FOREIGN KEY ("import_batch_id") REFERENCES "fiscal_import_batches"("id"),
  CONSTRAINT "fiscal_fact_geography_check" CHECK (
    ("government_level" = 'FEDERAL' AND "province_id" IS NULL AND "local_level_id" IS NULL) OR
    ("government_level" = 'PROVINCIAL' AND "province_id" IS NOT NULL AND "local_level_id" IS NULL) OR
    ("government_level" = 'LOCAL' AND "local_level_id" IS NOT NULL)
  )
);
CREATE UNIQUE INDEX "fiscal_facts_source_id_source_row_key_fact_type_key" ON "fiscal_facts"("source_id", "source_row_key", "fact_type");
CREATE INDEX "fiscal_facts_fiscal_year_government_level_fact_type_idx" ON "fiscal_facts"("fiscal_year", "government_level", "fact_type");
CREATE INDEX "fiscal_facts_province_id_fiscal_year_idx" ON "fiscal_facts"("province_id", "fiscal_year");
CREATE INDEX "fiscal_facts_local_level_id_fiscal_year_idx" ON "fiscal_facts"("local_level_id", "fiscal_year");
CREATE INDEX "fiscal_facts_canonical_classification_id_fiscal_year_idx" ON "fiscal_facts"("canonical_classification_id", "fiscal_year");
CREATE INDEX "fiscal_facts_source_id_data_status_idx" ON "fiscal_facts"("source_id", "data_status");
