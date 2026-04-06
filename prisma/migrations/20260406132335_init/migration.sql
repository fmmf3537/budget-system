-- CreateEnum
CREATE TYPE "BudgetStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ApprovalBizType" AS ENUM ('BUDGET', 'BUDGET_ADJUSTMENT', 'CASH_PLAN', 'OTHER');

-- CreateEnum
CREATE TYPE "ApprovalAction" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'TRANSFERRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AdjustmentStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'APPLIED');

-- CreateEnum
CREATE TYPE "AdjustmentKind" AS ENUM ('INCREASE', 'DECREASE', 'SUBJECT_TRANSFER', 'ROLLING');

-- CreateEnum
CREATE TYPE "CashPlanStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "WarningSeverity" AS ENUM ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "OrgStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "organization" (
    "id" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "status" "OrgStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_budget_template_settings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "departmentFieldLabel" VARCHAR(64),
    "dimension1Label" VARCHAR(64),
    "dimension2Label" VARCHAR(64),
    "enabledCompilationMethods" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_budget_template_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT,
    "role" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_subject" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "parentId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budget_subject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_header" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "fiscalYear" INTEGER NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "status" "BudgetStatus" NOT NULL DEFAULT 'DRAFT',
    "totalAmount" DECIMAL(18,2),
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "compilationMethod" VARCHAR(64),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT,
    "updatedById" TEXT,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvalProcessId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budget_header_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_line" (
    "id" TEXT NOT NULL,
    "headerId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "amountYtd" DECIMAL(18,2),
    "remark" TEXT,
    "departmentCode" TEXT,
    "dimension1" TEXT,
    "dimension2" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budget_line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_process" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bizType" "ApprovalBizType" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_process_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_node" (
    "id" TEXT NOT NULL,
    "processId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "approverUserId" TEXT,
    "approverRole" TEXT,
    "isParallelGroup" BOOLEAN NOT NULL DEFAULT false,
    "minTotalAmount" DECIMAL(18,2),
    "maxTotalAmount" DECIMAL(18,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_node_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_record" (
    "id" TEXT NOT NULL,
    "processId" TEXT NOT NULL,
    "nodeId" TEXT,
    "actorUserId" TEXT,
    "action" "ApprovalAction" NOT NULL DEFAULT 'PENDING',
    "comment" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "actedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_adjustment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "budgetHeaderId" TEXT,
    "budgetLineId" TEXT,
    "title" TEXT,
    "reason" TEXT NOT NULL,
    "kind" "AdjustmentKind" NOT NULL DEFAULT 'INCREASE',
    "status" "AdjustmentStatus" NOT NULL DEFAULT 'DRAFT',
    "totalDelta" DECIMAL(18,2),
    "requesterId" TEXT,
    "approvalProcessId" TEXT,
    "attachmentName" VARCHAR(256),
    "attachmentMime" VARCHAR(128),
    "attachmentDataBase64" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budget_adjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adjustment_detail" (
    "id" TEXT NOT NULL,
    "adjustmentId" TEXT NOT NULL,
    "budgetLineId" TEXT,
    "subjectId" TEXT,
    "sourceSubjectId" TEXT,
    "targetSubjectId" TEXT,
    "sourceProject" VARCHAR(200),
    "targetProject" VARCHAR(200),
    "amountDelta" DECIMAL(18,2) NOT NULL,
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "adjustment_detail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adjustment_history" (
    "id" TEXT NOT NULL,
    "adjustmentId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "payload" JSONB,
    "operatorId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "adjustment_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_plan_header" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "status" "CashPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "openingBalance" DECIMAL(18,2),
    "safetyWaterLevel" DECIMAL(18,2),
    "createdById" TEXT,
    "approvalProcessId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cash_plan_header_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_plan_income" (
    "id" TEXT NOT NULL,
    "headerId" TEXT NOT NULL,
    "category" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "expectedDate" TIMESTAMP(3),
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cash_plan_income_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_plan_expense" (
    "id" TEXT NOT NULL,
    "headerId" TEXT NOT NULL,
    "category" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "expectedDate" TIMESTAMP(3),
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cash_plan_expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_flow_forecast" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "openingBalance" DECIMAL(18,2) NOT NULL,
    "inflowTotal" DECIMAL(18,2) NOT NULL,
    "outflowTotal" DECIMAL(18,2) NOT NULL,
    "closingBalance" DECIMAL(18,2),
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cash_flow_forecast_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warning_record" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" "WarningSeverity" NOT NULL DEFAULT 'MEDIUM',
    "message" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warning_record_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organization_code_key" ON "organization"("code");

-- CreateIndex
CREATE INDEX "organization_parentId_idx" ON "organization"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "org_budget_template_settings_organizationId_key" ON "org_budget_template_settings"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_organizationId_idx" ON "users"("organizationId");

-- CreateIndex
CREATE INDEX "budget_subject_parentId_idx" ON "budget_subject"("parentId");

-- CreateIndex
CREATE INDEX "budget_subject_organizationId_idx" ON "budget_subject"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "budget_subject_organizationId_code_key" ON "budget_subject"("organizationId", "code");

-- CreateIndex
CREATE INDEX "budget_header_organizationId_fiscalYear_idx" ON "budget_header"("organizationId", "fiscalYear");

-- CreateIndex
CREATE INDEX "budget_header_status_idx" ON "budget_header"("status");

-- CreateIndex
CREATE INDEX "budget_line_headerId_idx" ON "budget_line"("headerId");

-- CreateIndex
CREATE INDEX "budget_line_subjectId_idx" ON "budget_line"("subjectId");

-- CreateIndex
CREATE INDEX "approval_process_organizationId_bizType_idx" ON "approval_process"("organizationId", "bizType");

-- CreateIndex
CREATE INDEX "approval_node_processId_idx" ON "approval_node"("processId");

-- CreateIndex
CREATE INDEX "approval_record_processId_idx" ON "approval_record"("processId");

-- CreateIndex
CREATE INDEX "approval_record_entityType_entityId_idx" ON "approval_record"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "approval_record_actorUserId_idx" ON "approval_record"("actorUserId");

-- CreateIndex
CREATE INDEX "budget_adjustment_organizationId_idx" ON "budget_adjustment"("organizationId");

-- CreateIndex
CREATE INDEX "budget_adjustment_budgetHeaderId_idx" ON "budget_adjustment"("budgetHeaderId");

-- CreateIndex
CREATE INDEX "budget_adjustment_status_idx" ON "budget_adjustment"("status");

-- CreateIndex
CREATE INDEX "adjustment_detail_adjustmentId_idx" ON "adjustment_detail"("adjustmentId");

-- CreateIndex
CREATE INDEX "adjustment_history_adjustmentId_idx" ON "adjustment_history"("adjustmentId");

-- CreateIndex
CREATE INDEX "adjustment_history_occurredAt_idx" ON "adjustment_history"("occurredAt");

-- CreateIndex
CREATE INDEX "cash_plan_header_organizationId_idx" ON "cash_plan_header"("organizationId");

-- CreateIndex
CREATE INDEX "cash_plan_header_periodStart_periodEnd_idx" ON "cash_plan_header"("periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "cash_plan_income_headerId_idx" ON "cash_plan_income"("headerId");

-- CreateIndex
CREATE INDEX "cash_plan_expense_headerId_idx" ON "cash_plan_expense"("headerId");

-- CreateIndex
CREATE INDEX "cash_flow_forecast_organizationId_idx" ON "cash_flow_forecast"("organizationId");

-- CreateIndex
CREATE INDEX "cash_flow_forecast_periodStart_periodEnd_idx" ON "cash_flow_forecast"("periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "warning_record_organizationId_isResolved_idx" ON "warning_record"("organizationId", "isResolved");

-- CreateIndex
CREATE INDEX "warning_record_entityType_entityId_idx" ON "warning_record"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "organization" ADD CONSTRAINT "organization_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_budget_template_settings" ADD CONSTRAINT "org_budget_template_settings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_subject" ADD CONSTRAINT "budget_subject_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_subject" ADD CONSTRAINT "budget_subject_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "budget_subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_header" ADD CONSTRAINT "budget_header_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_header" ADD CONSTRAINT "budget_header_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_header" ADD CONSTRAINT "budget_header_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_header" ADD CONSTRAINT "budget_header_approvalProcessId_fkey" FOREIGN KEY ("approvalProcessId") REFERENCES "approval_process"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_line" ADD CONSTRAINT "budget_line_headerId_fkey" FOREIGN KEY ("headerId") REFERENCES "budget_header"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_line" ADD CONSTRAINT "budget_line_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "budget_subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_process" ADD CONSTRAINT "approval_process_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_node" ADD CONSTRAINT "approval_node_processId_fkey" FOREIGN KEY ("processId") REFERENCES "approval_process"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_node" ADD CONSTRAINT "approval_node_approverUserId_fkey" FOREIGN KEY ("approverUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_record" ADD CONSTRAINT "approval_record_processId_fkey" FOREIGN KEY ("processId") REFERENCES "approval_process"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_record" ADD CONSTRAINT "approval_record_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "approval_node"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_record" ADD CONSTRAINT "approval_record_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_adjustment" ADD CONSTRAINT "budget_adjustment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_adjustment" ADD CONSTRAINT "budget_adjustment_budgetHeaderId_fkey" FOREIGN KEY ("budgetHeaderId") REFERENCES "budget_header"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_adjustment" ADD CONSTRAINT "budget_adjustment_budgetLineId_fkey" FOREIGN KEY ("budgetLineId") REFERENCES "budget_line"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_adjustment" ADD CONSTRAINT "budget_adjustment_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_adjustment" ADD CONSTRAINT "budget_adjustment_approvalProcessId_fkey" FOREIGN KEY ("approvalProcessId") REFERENCES "approval_process"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adjustment_detail" ADD CONSTRAINT "adjustment_detail_adjustmentId_fkey" FOREIGN KEY ("adjustmentId") REFERENCES "budget_adjustment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adjustment_detail" ADD CONSTRAINT "adjustment_detail_budgetLineId_fkey" FOREIGN KEY ("budgetLineId") REFERENCES "budget_line"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adjustment_detail" ADD CONSTRAINT "adjustment_detail_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "budget_subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adjustment_detail" ADD CONSTRAINT "adjustment_detail_sourceSubjectId_fkey" FOREIGN KEY ("sourceSubjectId") REFERENCES "budget_subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adjustment_detail" ADD CONSTRAINT "adjustment_detail_targetSubjectId_fkey" FOREIGN KEY ("targetSubjectId") REFERENCES "budget_subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adjustment_history" ADD CONSTRAINT "adjustment_history_adjustmentId_fkey" FOREIGN KEY ("adjustmentId") REFERENCES "budget_adjustment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adjustment_history" ADD CONSTRAINT "adjustment_history_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_plan_header" ADD CONSTRAINT "cash_plan_header_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_plan_header" ADD CONSTRAINT "cash_plan_header_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_plan_header" ADD CONSTRAINT "cash_plan_header_approvalProcessId_fkey" FOREIGN KEY ("approvalProcessId") REFERENCES "approval_process"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_plan_income" ADD CONSTRAINT "cash_plan_income_headerId_fkey" FOREIGN KEY ("headerId") REFERENCES "cash_plan_header"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_plan_expense" ADD CONSTRAINT "cash_plan_expense_headerId_fkey" FOREIGN KEY ("headerId") REFERENCES "cash_plan_header"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_flow_forecast" ADD CONSTRAINT "cash_flow_forecast_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warning_record" ADD CONSTRAINT "warning_record_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warning_record" ADD CONSTRAINT "warning_record_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
