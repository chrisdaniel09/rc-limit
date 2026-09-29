param(
    [String]$DbHost = "localhost",
    [int]$Port = 5432,
    [string]$Database = "rclimit",
    [string]$User = "postgres",
    [string]$Password = "dc@2026"
)

$env:PGPASSWORD = $Password

Write-Host "=== RCLimit Database Migration Runner ===" -ForegroundColor Cyan
Write-Host "Target: $User@${Host}:$Port/$Database"
Write-Host ""

# Create database if it doesn't exist
Write-Host "Creating database '$Database' if it doesn't exist..." -ForegroundColor Yellow
psql -h $DbHost -p $Port -U $User -d postgres -c "SELECT 1 FROM pg_database WHERE datname = '$Database'" -t | ForEach-Object { $_.Trim() } | Where-Object { $_ -eq "1" } | Out-Null
if ($LASTEXITCODE -ne 0 -or -not $?) {
    psql -h $DbHost -p $Port -U $User -d postgres -c "CREATE DATABASE $Database;"
    Write-Host "Database '$Database' created." -ForegroundColor Green
} else {
    Write-Host "Database '$Database' already exists." -ForegroundColor Green
}

# Run migration files in order
$migrationsDir = Join-Path $PSScriptRoot "migrations"
$migrations = Get-ChildItem -Path $migrationsDir -Filter "*.sql" | Sort-Object Name

Write-Host ""
Write-Host "Running migrations..." -ForegroundColor Yellow

foreach ($migration in $migrations) {
    Write-Host "  Applying: $($migration.Name)..." -NoNewline
    psql -h $DbHost -p $Port -U $User -d $Database -f $migration.FullName -q 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host " OK" -ForegroundColor Green
    } else {
        Write-Host " FAILED" -ForegroundColor Red
        Write-Host "    Error running $($migration.Name). Check output above." -ForegroundColor Red
    }
}

# Run seed data
Write-Host ""
Write-Host "Applying seed data..." -ForegroundColor Yellow
$seedFile = Join-Path $PSScriptRoot "seed\seed_data.sql"
if (Test-Path $seedFile) {
    psql -h $DbHost -p $Port -U $User -d $Database -f $seedFile -q 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  Seed data applied successfully." -ForegroundColor Green
    } else {
        Write-Host "  Seed data may have partially applied (duplicates are OK on re-run)." -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "=== Migration complete ===" -ForegroundColor Cyan

$env:PGPASSWORD = $null
