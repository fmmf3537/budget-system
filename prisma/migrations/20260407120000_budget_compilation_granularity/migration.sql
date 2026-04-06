-- CreateEnum
CREATE TYPE "BudgetCompilationGranularity" AS ENUM ('ANNUAL', 'QUARTERLY', 'MONTHLY');

-- AlterTable
ALTER TABLE "budget_header" ADD COLUMN "compilationGranularity" "BudgetCompilationGranularity" NOT NULL DEFAULT 'ANNUAL';
ALTER TABLE "budget_header" ADD COLUMN "periodUnit" INTEGER;

-- Backfill full-year bounds for annual drafts where period is missing (natural calendar year, UTC)
UPDATE "budget_header"
SET
  "periodStart" = make_timestamptz("fiscalYear", 1, 1, 0, 0, 0, 'UTC'),
  "periodEnd" = make_timestamptz("fiscalYear", 12, 31, 23, 59, 59, 'UTC')
WHERE "compilationGranularity" = 'ANNUAL'
  AND ("periodStart" IS NULL OR "periodEnd" IS NULL);

-- CreateIndex
CREATE INDEX "budget_header_organizationId_fiscalYear_compilationGranularity_period_idx" ON "budget_header"("organizationId", "fiscalYear", "compilationGranularity", "periodUnit");
