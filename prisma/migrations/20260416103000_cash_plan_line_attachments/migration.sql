ALTER TABLE "cash_plan_income"
ADD COLUMN "attachmentName" TEXT,
ADD COLUMN "attachmentMime" TEXT,
ADD COLUMN "attachmentUrl" TEXT,
ADD COLUMN "attachmentSize" INTEGER;

ALTER TABLE "cash_plan_expense"
ADD COLUMN "attachmentName" TEXT,
ADD COLUMN "attachmentMime" TEXT,
ADD COLUMN "attachmentUrl" TEXT,
ADD COLUMN "attachmentSize" INTEGER;

ALTER TABLE "cash_plan_sub_plan_income"
ADD COLUMN "attachmentName" TEXT,
ADD COLUMN "attachmentMime" TEXT,
ADD COLUMN "attachmentUrl" TEXT,
ADD COLUMN "attachmentSize" INTEGER;

ALTER TABLE "cash_plan_sub_plan_expense"
ADD COLUMN "attachmentName" TEXT,
ADD COLUMN "attachmentMime" TEXT,
ADD COLUMN "attachmentUrl" TEXT,
ADD COLUMN "attachmentSize" INTEGER;
