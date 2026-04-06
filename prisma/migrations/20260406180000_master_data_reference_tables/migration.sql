-- CreateEnum
CREATE TYPE "CashPlanCategoryKind" AS ENUM ('INCOME', 'EXPENSE');

-- CreateTable
CREATE TABLE "budget_department" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budget_department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_dimension_value" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,
    "code" VARCHAR(128) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budget_dimension_value_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_plan_category" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "kind" "CashPlanCategoryKind" NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cash_plan_category_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "budget_department_organizationId_code_key" ON "budget_department"("organizationId", "code");

-- CreateIndex
CREATE INDEX "budget_department_organizationId_idx" ON "budget_department"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "budget_dimension_value_organizationId_slot_code_key" ON "budget_dimension_value"("organizationId", "slot", "code");

-- CreateIndex
CREATE INDEX "budget_dimension_value_organizationId_slot_idx" ON "budget_dimension_value"("organizationId", "slot");

-- CreateIndex
CREATE UNIQUE INDEX "cash_plan_category_organizationId_kind_code_key" ON "cash_plan_category"("organizationId", "kind", "code");

-- CreateIndex
CREATE INDEX "cash_plan_category_organizationId_kind_idx" ON "cash_plan_category"("organizationId", "kind");

-- AddForeignKey
ALTER TABLE "budget_department" ADD CONSTRAINT "budget_department_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_dimension_value" ADD CONSTRAINT "budget_dimension_value_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_plan_category" ADD CONSTRAINT "cash_plan_category_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
