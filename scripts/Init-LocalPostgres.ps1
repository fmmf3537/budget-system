#requires -Version 5.1
<#
  Creates local role budget_app (password: budget_local_dev), databases
  budget_system and budget_system_shadow, and public-schema grants.
  Matches [.env.example](../.env.example) defaults.

  Usage (PowerShell):
    $env:PGPASSWORD = "<your_postgres_superuser_password>"
    .\scripts\Init-LocalPostgres.ps1

  Optional: $env:PGSUPERUSER (default postgres), $env:PGHOST, $env:PGPORT, $env:PGROOT\bin\psql.exe
#>
$ErrorActionPreference = "Stop"

if (-not $env:PGPASSWORD) {
  Write-Error "Set PGPASSWORD to your PostgreSQL superuser password, then run again."
}

$psql = $null
if ($env:PGROOT -and (Test-Path "$env:PGROOT\bin\psql.exe")) {
  $psql = "$env:PGROOT\bin\psql.exe"
}
if (-not $psql) {
  foreach ($p in @(
      "C:\Program Files\PostgreSQL\18\bin\psql.exe",
      "C:\Program Files\PostgreSQL\17\bin\psql.exe",
      "C:\Program Files\PostgreSQL\16\bin\psql.exe"
    )) {
    if (Test-Path $p) { $psql = $p; break }
  }
}
if (-not $psql) {
  $cmd = Get-Command psql -ErrorAction SilentlyContinue
  if ($cmd) { $psql = $cmd.Source }
}
if (-not $psql) {
  Write-Error "psql.exe not found. Install PostgreSQL or set PGROOT to the install folder."
}

$pgUser = if ($env:PGSUPERUSER) { $env:PGSUPERUSER } else { "postgres" }
$pgHost = if ($env:PGHOST) { $env:PGHOST } else { "localhost" }
$pgPort = if ($env:PGPORT) { $env:PGPORT } else { "5432" }

function Invoke-Psql([string]$Database, [string]$Sql) {
  & $psql -X -h $pgHost -p $pgPort -U $pgUser -d $Database -v ON_ERROR_STOP=1 -c $Sql
  if ($LASTEXITCODE -ne 0) {
    throw "psql failed (exit $LASTEXITCODE) against database `"$Database`"."
  }
}

$roleSql = @'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'budget_app') THEN
    CREATE ROLE budget_app LOGIN PASSWORD 'budget_local_dev';
  END IF;
END
$$;
'@

Invoke-Psql postgres $roleSql

foreach ($db in @("budget_system", "budget_system_shadow")) {
  $exists = (
    & $psql -X -h $pgHost -p $pgPort -U $pgUser -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$db'"
  )
  if ($LASTEXITCODE -ne 0) {
    throw "psql failed (exit $LASTEXITCODE) while checking database `"$db`"."
  }
  if ($null -eq $exists) { $exists = "" }
  $exists = $exists.Trim()
  if ($exists -ne "1") {
    Invoke-Psql postgres "CREATE DATABASE $db OWNER budget_app;"
  }
}

$grantSql = @'
GRANT ALL ON SCHEMA public TO budget_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO budget_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO budget_app;
'@

foreach ($db in @("budget_system", "budget_system_shadow")) {
  Invoke-Psql $db $grantSql
}

Write-Host "OK: role budget_app, databases budget_system + budget_system_shadow (password: budget_local_dev)."
