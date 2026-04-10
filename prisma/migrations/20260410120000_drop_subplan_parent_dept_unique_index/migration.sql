-- The original sub-plan migration used CREATE UNIQUE INDEX (not a table UNIQUE constraint).
-- DROP CONSTRAINT alone does not remove that index; P2002 persisted until the index is dropped.

DROP INDEX IF EXISTS "cash_plan_sub_plan_parentHeaderId_scopeDepartmentCode_key";

ALTER TABLE "cash_plan_sub_plan"
DROP CONSTRAINT IF EXISTS "cash_plan_sub_plan_parentHeaderId_scopeDepartmentCode_key";
