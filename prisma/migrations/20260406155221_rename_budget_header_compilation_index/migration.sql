-- RenameIndex (idempotent)
-- Init migration only creates "budget_header_organizationId_fiscalYear_idx"; the long Prisma default
-- name below existed in some intermediate histories. Skip when absent so fresh deploys succeed.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'i'
      AND c.relname = 'budget_header_organizationId_fiscalYear_compilationGranularity_'
  ) THEN
    ALTER INDEX "budget_header_organizationId_fiscalYear_compilationGranularity_" RENAME TO "budget_header_organizationId_fiscalYear_compilationGranular_idx";
  END IF;
END $$;
