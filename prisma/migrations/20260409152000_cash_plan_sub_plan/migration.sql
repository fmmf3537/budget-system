-- CreateEnum
CREATE TYPE "CashPlanSubPlanStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "cash_plan_sub_plan" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "parentHeaderId" TEXT NOT NULL,
    "scopeDepartmentCode" VARCHAR(64) NOT NULL,
    "name" TEXT,
    "status" "CashPlanSubPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT,
    "approvalProcessId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cash_plan_sub_plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_plan_sub_plan_income" (
    "id" TEXT NOT NULL,
    "subPlanId" TEXT NOT NULL,
    "category" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "expectedDate" TIMESTAMP(3),
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cash_plan_sub_plan_income_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_plan_sub_plan_expense" (
    "id" TEXT NOT NULL,
    "subPlanId" TEXT NOT NULL,
    "category" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "expectedDate" TIMESTAMP(3),
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cash_plan_sub_plan_expense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cash_plan_sub_plan_organizationId_parentHeaderId_idx" ON "cash_plan_sub_plan"("organizationId", "parentHeaderId");

-- CreateIndex
CREATE INDEX "cash_plan_sub_plan_organizationId_scopeDepartmentCode_idx" ON "cash_plan_sub_plan"("organizationId", "scopeDepartmentCode");

-- CreateIndex
CREATE UNIQUE INDEX "cash_plan_sub_plan_parentHeaderId_scopeDepartmentCode_key" ON "cash_plan_sub_plan"("parentHeaderId", "scopeDepartmentCode");

-- CreateIndex
CREATE INDEX "cash_plan_sub_plan_income_subPlanId_idx" ON "cash_plan_sub_plan_income"("subPlanId");

-- CreateIndex
CREATE INDEX "cash_plan_sub_plan_expense_subPlanId_idx" ON "cash_plan_sub_plan_expense"("subPlanId");

-- AddForeignKey
ALTER TABLE "cash_plan_sub_plan" ADD CONSTRAINT "cash_plan_sub_plan_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_plan_sub_plan" ADD CONSTRAINT "cash_plan_sub_plan_parentHeaderId_fkey" FOREIGN KEY ("parentHeaderId") REFERENCES "cash_plan_header"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_plan_sub_plan" ADD CONSTRAINT "cash_plan_sub_plan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_plan_sub_plan" ADD CONSTRAINT "cash_plan_sub_plan_approvalProcessId_fkey" FOREIGN KEY ("approvalProcessId") REFERENCES "approval_process"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_plan_sub_plan_income" ADD CONSTRAINT "cash_plan_sub_plan_income_subPlanId_fkey" FOREIGN KEY ("subPlanId") REFERENCES "cash_plan_sub_plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_plan_sub_plan_expense" ADD CONSTRAINT "cash_plan_sub_plan_expense_subPlanId_fkey" FOREIGN KEY ("subPlanId") REFERENCES "cash_plan_sub_plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
