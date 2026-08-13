-- DropIndex
DROP INDEX "contractors_name_key";

-- AlterTable
ALTER TABLE "contractors" ADD COLUMN     "canonical_key" TEXT,
ADD COLUMN     "normalized_name" TEXT,
ADD COLUMN     "source_dataset" TEXT;

-- AlterTable
ALTER TABLE "contracts" ADD COLUMN     "beneficial_owner" TEXT,
ADD COLUMN     "contract_address" TEXT,
ADD COLUMN     "contract_type" TEXT,
ADD COLUMN     "dlp_end_date" TIMESTAMP(3),
ADD COLUMN     "dlp_start_date" TIMESTAMP(3),
ADD COLUMN     "donor_party" TEXT,
ADD COLUMN     "ifb_number" TEXT,
ADD COLUMN     "joint_venture_name" TEXT,
ADD COLUMN     "source_dataset" TEXT,
ADD COLUMN     "warranty_period" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "contractors_canonical_key_key" ON "contractors"("canonical_key");

-- CreateIndex
CREATE INDEX "contractors_name_idx" ON "contractors"("name");

-- CreateIndex
CREATE INDEX "contractors_normalized_name_idx" ON "contractors"("normalized_name");

-- CreateIndex
CREATE INDEX "contractors_vat_number_idx" ON "contractors"("vat_number");

-- CreateIndex
CREATE INDEX "contractors_contractor_type_idx" ON "contractors"("contractor_type");

-- CreateIndex
CREATE INDEX "contracts_procurement_category_idx" ON "contracts"("procurement_category");

-- CreateIndex
CREATE INDEX "contracts_source_dataset_idx" ON "contracts"("source_dataset");
