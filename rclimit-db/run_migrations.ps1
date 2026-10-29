<#
.SYNOPSIS
    Builds or updates the RCLimit database: applies pending migrations, then the seed files.

.DESCRIPTION
    Migrations in .\migrations run once each, in file-name order, each in its own transaction.
    Applied files are recorded in public.schema_migrations with a checksum; a changed applied file is reported.
    Seed files in .\seed are idempotent and run on every invocation, each in its own transaction.
    The run stops at the first error.

.PARAMETER Reset
    Drops every RCLimit schema and all data first (scripts\drop_all.sql), then rebuilds. Asks for confirmation.

.PARAMETER Force
    Skips the -Reset confirmation.

.PARAMETER NoSampleData
    Skips seed files whose name contains "sample". Use for any real environment.

.PARAMETER SkipSeed
    Applies migrations only.

.EXAMPLE
    $env:RCLIMIT_DB_PASSWORD = '<password>'; .\run_migrations.ps1
.EXAMPLE
    .\run_migrations.ps1 -Database rclimit_test -Reset -Force
#>
param(
    [string]$DbHost = "localhost",
    [int]$Port = 5432,
    [string]$Database = "rclimit",
    [string]$User = "postgres",
    [string]$Password = $env:RCLIMIT_DB_PASSWORD,
    [switch]$Reset,
    [switch]$Force,
    [switch]$NoSampleData,
    [switch]$SkipSeed
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command psql -ErrorAction SilentlyContinue)) {
    Write-Host "psql was not found. Add the PostgreSQL bin folder to PATH." -ForegroundColor Red
    exit 1
}

# The password comes from -Password, RCLIMIT_DB_PASSWORD or PGPASSWORD. It is never stored in this file.
if ($Password) { $env:PGPASSWORD = $Password }
if (-not $env:PGPASSWORD) {
    Write-Host "No database password. Pass -Password, or set RCLIMIT_DB_PASSWORD or PGPASSWORD." -ForegroundColor Red
    exit 1
}

$baseArgs = @("-h", $DbHost, "-p", $Port, "-U", $User, "-X", "-q", "-v", "ON_ERROR_STOP=1")

# Notices ("does not exist, skipping") are noise here; warnings and errors still show.
$env:PGOPTIONS = "-c client_min_messages=warning"

function Invoke-Psql {
    param([string]$Db, [string[]]$Arguments)
    # psql writes errors to stderr. Windows PowerShell would turn that into a terminating error,
    # so stderr is collected as text and the exit code decides success.
    $ErrorActionPreference = "Continue"
    $output = & psql @baseArgs -d $Db @Arguments 2>&1 | ForEach-Object { "$_" }
    return [pscustomobject]@{ ExitCode = $LASTEXITCODE; Output = ($output | Out-String).Trim() }
}

function Invoke-Scalar {
    param([string]$Db, [string]$Sql)
    $result = Invoke-Psql -Db $Db -Arguments @("-A", "-t", "-c", $Sql)
    if ($result.ExitCode -ne 0) { throw $result.Output }
    return $result.Output
}

function Stop-OnFailure {
    param($Result, [string]$Step)
    if ($Result.ExitCode -ne 0) {
        Write-Host " FAILED" -ForegroundColor Red
        Write-Host $Result.Output -ForegroundColor Red
        Write-Host "Stopped at $Step. Nothing in that file was applied." -ForegroundColor Red
        exit 1
    }
}

Write-Host "=== RCLimit database ===" -ForegroundColor Cyan
Write-Host "Target: $User@${DbHost}:$Port/$Database"

# 1. Create the database if it does not exist.
$exists = Invoke-Scalar -Db "postgres" -Sql "SELECT 1 FROM pg_database WHERE datname = '$Database'"
if ($exists -ne "1") {
    Write-Host "Creating database '$Database'..." -ForegroundColor Yellow
    $created = Invoke-Psql -Db "postgres" -Arguments @("-c", "CREATE DATABASE `"$Database`"")
    Stop-OnFailure $created "CREATE DATABASE"
}

# 2. Optional reset.
if ($Reset) {
    if (-not $Force) {
        Write-Host "This deletes ALL schemas and data in '$Database'." -ForegroundColor Red
        $answer = Read-Host "Type the database name to confirm"
        if ($answer -ne $Database) { Write-Host "Cancelled."; exit 1 }
    }
    Write-Host "Dropping all objects..." -NoNewline
    $dropped = Invoke-Psql -Db $Database -Arguments @("-f", (Join-Path $PSScriptRoot "scripts\drop_all.sql"))
    Stop-OnFailure $dropped "scripts\drop_all.sql"
    Write-Host " OK" -ForegroundColor Green
}

# 3. Migration history.
$historySql = @"
CREATE TABLE IF NOT EXISTS public.schema_migrations (
    filename   VARCHAR(200) PRIMARY KEY,
    checksum   CHAR(64)     NOT NULL,
    applied_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);
"@
Stop-OnFailure (Invoke-Psql -Db $Database -Arguments @("-c", $historySql)) "schema_migrations"

$applied = @{}
$rows = Invoke-Scalar -Db $Database -Sql "SELECT filename || '|' || checksum FROM public.schema_migrations"
foreach ($row in ($rows -split "`r?`n" | Where-Object { $_ })) {
    $parts = $row.Split('|')
    $applied[$parts[0]] = $parts[1]
}

# 4. Pending migrations, each with its history row in one transaction.
Write-Host ""
Write-Host "Migrations" -ForegroundColor Yellow
$migrations = Get-ChildItem -Path (Join-Path $PSScriptRoot "migrations") -Filter "*.sql" | Sort-Object Name
foreach ($migration in $migrations) {
    $checksum = (Get-FileHash -Path $migration.FullName -Algorithm SHA256).Hash.ToLowerInvariant()

    if ($applied.ContainsKey($migration.Name)) {
        if ($applied[$migration.Name] -ne $checksum) {
            Write-Host "  $($migration.Name) was changed after it was applied. Changes are not re-applied; add a new migration." -ForegroundColor DarkYellow
        }
        continue
    }

    Write-Host "  Applying $($migration.Name)..." -NoNewline
    $record = "INSERT INTO public.schema_migrations (filename, checksum) VALUES ('$($migration.Name)', '$checksum')"
    $result = Invoke-Psql -Db $Database -Arguments @("-1", "-f", $migration.FullName, "-c", $record)
    Stop-OnFailure $result $migration.Name
    Write-Host " OK" -ForegroundColor Green
}

# 5. Seeds.
if (-not $SkipSeed) {
    Write-Host ""
    Write-Host "Seed data" -ForegroundColor Yellow
    $seeds = Get-ChildItem -Path (Join-Path $PSScriptRoot "seed") -Filter "*.sql" | Sort-Object Name
    foreach ($seed in $seeds) {
        if ($NoSampleData -and $seed.Name -like "*sample*") {
            Write-Host "  Skipping $($seed.Name)"
            continue
        }
        Write-Host "  Applying $($seed.Name)..." -NoNewline
        $result = Invoke-Psql -Db $Database -Arguments @("-1", "-f", $seed.FullName)
        Stop-OnFailure $result $seed.Name
        Write-Host " OK" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "=== Done ===" -ForegroundColor Cyan
$env:PGPASSWORD = $null
