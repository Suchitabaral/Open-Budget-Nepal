-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "public"."contract_contractors" (
    "id" SERIAL NOT NULL,
    "contract_id" INTEGER NOT NULL,
    "contractor_id" INTEGER NOT NULL,
    "share_percentage" DECIMAL(8,2),

    CONSTRAINT "contract_contractors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."contractor_locations" (
    "id" SERIAL NOT NULL,
    "district" TEXT NOT NULL,
    "contractor" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contractor_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."contractors" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "registration_number" TEXT,
    "address" TEXT,
    "owners" TEXT,
    "country" TEXT,
    "vat_number" TEXT,
    "contractor_type" TEXT,
    "district" TEXT,
    "province" TEXT,
    "is_flagged" BOOLEAN NOT NULL DEFAULT false,
    "flag_reason" TEXT,
    "flagged_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contractors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."contracts" (
    "id" SERIAL NOT NULL,
    "contract_code" TEXT NOT NULL,
    "contract_name" TEXT NOT NULL,
    "contract_amount" DECIMAL(18,2) NOT NULL,
    "contract_date" TIMESTAMP(3),
    "start_date" TIMESTAMP(3),
    "end_or_complete_date" TIMESTAMP(3),
    "delivery_date" TIMESTAMP(3),
    "contract_status" TEXT,
    "percentage_of_completion" DECIMAL(8,2),
    "total_payment" DECIMAL(18,2),
    "outstanding_value" DECIMAL(18,2),
    "estimated_cost" DECIMAL(18,2),
    "procurement_method" TEXT,
    "procurement_category" TEXT,
    "bidding_process" TEXT,
    "public_entity_name" TEXT,
    "fiscal_year" TEXT,
    "project_description" TEXT,
    "source_of_fund" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."economic_indicators" (
    "id" SERIAL NOT NULL,
    "fiscal_year" TEXT NOT NULL,
    "gdp_growth_rate" DECIMAL(8,2) NOT NULL,
    "inflation_rate" DECIMAL(8,2) NOT NULL,
    "budget_growth_rate" DECIMAL(8,2) NOT NULL,
    "tax_revenue_growth_rate" DECIMAL(8,2) NOT NULL,
    "minimum_wage_monthly" DECIMAL(12,2) NOT NULL,
    "average_salary_growth_rate" DECIMAL(8,2) NOT NULL,
    "remittance_growth_rate" DECIMAL(8,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "economic_indicators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."fiscal_transfers" (
    "id" SERIAL NOT NULL,
    "fiscal_year" TEXT NOT NULL,
    "source_level" TEXT NOT NULL,
    "target_level" TEXT NOT NULL,
    "target_name" TEXT NOT NULL,
    "grant_type" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fiscal_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."gandaki_project_budget" (
    "id" SERIAL NOT NULL,
    "project" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "amount_thousand_npr" DECIMAL(18,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gandaki_project_budget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."local_budget" (
    "id" SERIAL NOT NULL,
    "local_level_name" TEXT NOT NULL,
    "equalization" DECIMAL(18,2) NOT NULL,
    "conditional" DECIMAL(18,2) NOT NULL,
    "special" DECIMAL(18,2) NOT NULL,
    "complementary" DECIMAL(18,2) NOT NULL,
    "total_recurring" DECIMAL(18,2) NOT NULL,
    "total_capital" DECIMAL(18,2) NOT NULL,
    "grand_total" DECIMAL(18,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "local_budget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."local_granular_data" (
    "id" SERIAL NOT NULL,
    "entity_name" TEXT NOT NULL,
    "fiscal_year" TEXT NOT NULL,
    "ward_number" INTEGER,
    "ward_population" INTEGER,
    "ward_total_budget" DECIMAL(18,2),
    "project_name" TEXT,
    "project_budget" DECIMAL(18,2),
    "project_expenditure" DECIMAL(18,2),
    "physical_progress" DECIMAL(8,2),
    "status" TEXT,
    "province" TEXT,
    "contract_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "local_granular_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."milestones" (
    "id" SERIAL NOT NULL,
    "contract_id" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "target_date" TIMESTAMP(3),
    "completion_date" TIMESTAMP(3),
    "status" TEXT,

    CONSTRAINT "milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ministry_allocations" (
    "id" SERIAL NOT NULL,
    "ministry_name" TEXT NOT NULL,
    "fiscal_year" TEXT NOT NULL,
    "allocated_amount" DECIMAL(18,2) NOT NULL,
    "spent_amount" DECIMAL(18,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ministry_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."monthly_execution" (
    "id" SERIAL NOT NULL,
    "entity_name" TEXT NOT NULL,
    "fiscal_year" TEXT NOT NULL,
    "month_index" INTEGER NOT NULL,
    "month_name" TEXT NOT NULL,
    "cumulative_spend_capital" DECIMAL(18,2) NOT NULL,
    "cumulative_spend_recurrent" DECIMAL(18,2) NOT NULL,
    "target_spend" DECIMAL(18,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monthly_execution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."national_budget_summary" (
    "id" SERIAL NOT NULL,
    "fiscal_year" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "sub_category" TEXT NOT NULL,
    "amount_budgeted" DECIMAL(18,2) NOT NULL,
    "amount_actual" DECIMAL(18,2),
    "inflation_rate" DECIMAL(8,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "national_budget_summary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."provincial_budget" (
    "id" SERIAL NOT NULL,
    "province_code" TEXT NOT NULL,
    "province_name" TEXT NOT NULL,
    "equalization_grant" DECIMAL(18,2) NOT NULL,
    "conditional_grant" DECIMAL(18,2) NOT NULL,
    "special_grant" DECIMAL(18,2) NOT NULL,
    "complementary_grant" DECIMAL(18,2) NOT NULL,
    "recurring_total" DECIMAL(18,2) NOT NULL,
    "capital_total" DECIMAL(18,2) NOT NULL,
    "grand_total" DECIMAL(18,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provincial_budget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."public_finance_balance_sheet" (
    "id" SERIAL NOT NULL,
    "fiscal_year" TEXT NOT NULL,
    "total_revenue" DECIMAL(18,2),
    "total_tax" DECIMAL(18,2),
    "customs" DECIMAL(18,2),
    "excise" DECIMAL(18,2),
    "income_tax" DECIMAL(18,2),
    "vat" DECIMAL(18,2),
    "other_tax" DECIMAL(18,2),
    "total_non_tax" DECIMAL(18,2),
    "total_expenditure" DECIMAL(18,2),
    "recurrent_expenditure" DECIMAL(18,2),
    "capital_expenditure" DECIMAL(18,2),
    "financing" DECIMAL(18,2),
    "total_outstanding_debt" DECIMAL(18,2),
    "outstanding_domestic_debt" DECIMAL(18,2),
    "outstanding_foreign_debt" DECIMAL(18,2),
    "domestic_borrowing_yearly" DECIMAL(18,2),
    "total_foreign_financing" DECIMAL(18,2),
    "foreign_grant" DECIMAL(18,2),
    "foreign_loan" DECIMAL(18,2),
    "total_public_debt" DECIMAL(18,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "public_finance_balance_sheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."subnational_finance" (
    "id" SERIAL NOT NULL,
    "entity_name" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "fiscal_year" TEXT NOT NULL,
    "revenue_internal" DECIMAL(18,2) NOT NULL,
    "revenue_grants" DECIMAL(18,2) NOT NULL,
    "sector_health" DECIMAL(18,2) NOT NULL,
    "sector_education" DECIMAL(18,2) NOT NULL,
    "sector_infra" DECIMAL(18,2) NOT NULL,
    "sector_agriculture" DECIMAL(18,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subnational_finance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_feedback" (
    "id" SERIAL NOT NULL,
    "user_name" TEXT,
    "user_email" TEXT,
    "feedback_type" TEXT NOT NULL DEFAULT 'comment',
    "contractor_id" INTEGER,
    "contract_id" INTEGER,
    "project_id" INTEGER,
    "comment" TEXT,
    "rating" INTEGER,
    "photo_url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_preferences" (
    "id" SERIAL NOT NULL,
    "session_id" TEXT NOT NULL,
    "province" TEXT,
    "district" TEXT,
    "municipality" TEXT,
    "ward_number" INTEGER,
    "email" TEXT,
    "name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contract_contractors_contract_id_contractor_id_key" ON "public"."contract_contractors"("contract_id" ASC, "contractor_id" ASC);

-- CreateIndex
CREATE INDEX "contractor_locations_district_idx" ON "public"."contractor_locations"("district" ASC);

-- CreateIndex
CREATE INDEX "contractors_district_idx" ON "public"."contractors"("district" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "contractors_name_key" ON "public"."contractors"("name" ASC);

-- CreateIndex
CREATE INDEX "contractors_province_idx" ON "public"."contractors"("province" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "contracts_contract_code_key" ON "public"."contracts"("contract_code" ASC);

-- CreateIndex
CREATE INDEX "contracts_contract_status_idx" ON "public"."contracts"("contract_status" ASC);

-- CreateIndex
CREATE INDEX "contracts_fiscal_year_idx" ON "public"."contracts"("fiscal_year" ASC);

-- CreateIndex
CREATE INDEX "contracts_public_entity_name_idx" ON "public"."contracts"("public_entity_name" ASC);

-- CreateIndex
CREATE INDEX "fiscal_transfers_fiscal_year_idx" ON "public"."fiscal_transfers"("fiscal_year" ASC);

-- CreateIndex
CREATE INDEX "fiscal_transfers_target_level_idx" ON "public"."fiscal_transfers"("target_level" ASC);

-- CreateIndex
CREATE INDEX "gandaki_project_budget_district_idx" ON "public"."gandaki_project_budget"("district" ASC);

-- CreateIndex
CREATE INDEX "local_granular_data_entity_name_idx" ON "public"."local_granular_data"("entity_name" ASC);

-- CreateIndex
CREATE INDEX "local_granular_data_fiscal_year_idx" ON "public"."local_granular_data"("fiscal_year" ASC);

-- CreateIndex
CREATE INDEX "local_granular_data_province_idx" ON "public"."local_granular_data"("province" ASC);

-- CreateIndex
CREATE INDEX "local_granular_data_status_idx" ON "public"."local_granular_data"("status" ASC);

-- CreateIndex
CREATE INDEX "milestones_contract_id_idx" ON "public"."milestones"("contract_id" ASC);

-- CreateIndex
CREATE INDEX "ministry_allocations_fiscal_year_idx" ON "public"."ministry_allocations"("fiscal_year" ASC);

-- CreateIndex
CREATE INDEX "monthly_execution_fiscal_year_idx" ON "public"."monthly_execution"("fiscal_year" ASC);

-- CreateIndex
CREATE INDEX "national_budget_summary_category_idx" ON "public"."national_budget_summary"("category" ASC);

-- CreateIndex
CREATE INDEX "national_budget_summary_fiscal_year_idx" ON "public"."national_budget_summary"("fiscal_year" ASC);

-- CreateIndex
CREATE INDEX "subnational_finance_fiscal_year_idx" ON "public"."subnational_finance"("fiscal_year" ASC);

-- CreateIndex
CREATE INDEX "user_feedback_contract_id_idx" ON "public"."user_feedback"("contract_id" ASC);

-- CreateIndex
CREATE INDEX "user_feedback_contractor_id_idx" ON "public"."user_feedback"("contractor_id" ASC);

-- CreateIndex
CREATE INDEX "user_feedback_project_id_idx" ON "public"."user_feedback"("project_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "user_preferences_session_id_key" ON "public"."user_preferences"("session_id" ASC);

-- AddForeignKey
ALTER TABLE "public"."contract_contractors" ADD CONSTRAINT "contract_contractors_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."contract_contractors" ADD CONSTRAINT "contract_contractors_contractor_id_fkey" FOREIGN KEY ("contractor_id") REFERENCES "public"."contractors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."local_granular_data" ADD CONSTRAINT "local_granular_data_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."milestones" ADD CONSTRAINT "milestones_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_feedback" ADD CONSTRAINT "user_feedback_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_feedback" ADD CONSTRAINT "user_feedback_contractor_id_fkey" FOREIGN KEY ("contractor_id") REFERENCES "public"."contractors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_feedback" ADD CONSTRAINT "user_feedback_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."local_granular_data"("id") ON DELETE CASCADE ON UPDATE CASCADE;
