-- AlterTable
ALTER TABLE "budget_department" ADD COLUMN "parentId" TEXT;

-- CreateIndex
CREATE INDEX "budget_department_parentId_idx" ON "budget_department"("parentId");

-- AddForeignKey
ALTER TABLE "budget_department" ADD CONSTRAINT "budget_department_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "budget_department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
