-- AlterTable
ALTER TABLE "cash_plan_header" ADD COLUMN "rootDepartmentCode" TEXT;

-- CreateIndex
CREATE INDEX "cash_plan_header_rootDepartmentCode_idx" ON "cash_plan_header"("rootDepartmentCode");
