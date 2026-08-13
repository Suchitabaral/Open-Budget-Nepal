ALTER TABLE "public"."contracts"
  ALTER COLUMN "contract_amount" DROP NOT NULL,
  ADD COLUMN "revised_contract_amount" DECIMAL(18,2),
  ADD COLUMN "actual_completion_date" TIMESTAMP(3),
  ADD COLUMN "municipality" TEXT,
  ADD COLUMN "package_scope" TEXT,
  ADD COLUMN "bidder_id" TEXT,
  ADD COLUMN "source_verification_status" TEXT;

ALTER TABLE "public"."contract_contractors"
  ADD COLUMN "verification_status" TEXT;

CREATE INDEX "contracts_municipality_fiscal_year_idx"
  ON "public"."contracts"("municipality", "fiscal_year");
