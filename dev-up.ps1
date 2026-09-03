<#
.SYNOPSIS
  Job Radar - Dev Startup Script (Windows PowerShell)

.DESCRIPTION
  Windows equivalent of dev-up.sh. Automates: deps check, Docker infra,
  DB migrations, seed, and dev servers.

.PARAMETER Reset
  Reset database (wipe + re-migrate + re-seed) before starting.

.PARAMETER NoLogs
  Start servers without following logs.

.EXAMPLE
  .\dev-up.ps1
  .\dev-up.ps1 -Reset
  .\dev-up.ps1 -NoLogs
#>

param(
    [switch]$Reset,
    [switch]$NoLogs
)

$ErrorActionPreference = "Stop"
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptRoot

# Temp log paths
$ApiLog = Join-Path $env:TEMP "jobradar-api.log"
$WebLog = Join-Path $env:TEMP "jobradar-web.log"

# --- Helpers ---
function Write-Log    { param([string]$Msg) Write-Host "[dev-up] $Msg" -ForegroundColor Cyan }
function Write-Success { param([string]$Msg) Write-Host "[+] $Msg" -ForegroundColor Green }
function Write-Warn   { param([string]$Msg) Write-Host "[!] $Msg" -ForegroundColor Yellow }
function Write-Err    { param([string]$Msg) Write-Host "[-] $Msg" -ForegroundColor Red }

function Load-EnvFile {
    param([string]$Path)
    if (-not (Test-Path $Path)) { return }
    Get-Content $Path | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith('#') -and $line -match '^([^=]+)=(.*)$') {
            $name = $Matches[1].Trim()
            $value = $Matches[2].Trim()
            if ($value -and $value[0] -eq '"' -and $value[-1] -eq '"') {
                $value = $value.Substring(1, $value.Length - 2)
            }
            Set-Item -Path "env:$name" -Value $value
        }
    }
}

function Wait-ForUrl {
    param(
        [string]$Url,
        [int]$Retries = 30,
        [string]$FailMessage = "Service failed to start"
    )
    $attempt = 0
    while ($attempt -lt $Retries) {
        try {
            $resp = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSeconds 2 -ErrorAction Stop
            if ($resp.StatusCode -lt 500) { return $true }
        } catch { }
        $attempt++
        Start-Sleep -Seconds 1
    }
    Write-Err $FailMessage
    exit 1
}

# --- Process / log tracking ---
$apiProc = $null
$webProc = $null
$apiReader = $null
$webReader = $null

$Cleanup = {
    Write-Host ""
    Write-Warn "Shutting down..."
    if ($apiReader) { Stop-Job $apiReader 2>$null; Remove-Job $apiReader -Force 2>$null }
    if ($webReader) { Stop-Job $webReader 2>$null; Remove-Job $webReader -Force 2>$null }
    if ($apiProc -and -not $apiProc.HasExited) { Stop-Process -Id $apiProc.Id -Force 2>$null }
    if ($webProc -and -not $webProc.HasExited) { Stop-Process -Id $webProc.Id -Force 2>$null }
    Write-Success "Stopped"
}

# Register Ctrl+C handler
trap $Cleanup

# --- Banner ---
Write-Host ""
Write-Host "========================================"
Write-Host "  Job Radar - Dev Environment (Windows)"
Write-Host "========================================"
Write-Host ""

# --- Check dependencies ---
Write-Log "Checking dependencies..."

$hasPnpm = $null -ne (Get-Command pnpm -ErrorAction SilentlyContinue)
$hasDocker = $null -ne (Get-Command docker -ErrorAction SilentlyContinue)

if (-not $hasPnpm) {
    Write-Err "pnpm not found. Install with: npm i -g pnpm"
    exit 1
}
if (-not $hasDocker) {
    Write-Err "docker not found. Install Docker Desktop from https://docs.docker.com/get-docker/"
    exit 1
}
$composeOk = $true
try { docker compose version > $null 2>&1 } catch { $composeOk = $false }
if (-not $composeOk) {
    Write-Err "docker compose not found (requires Docker Desktop)"
    exit 1
}

Write-Success "Dependencies OK"

# --- Install pnpm deps if needed ---
if (-not (Test-Path "node_modules")) {
    Write-Log "Installing dependencies..."
    pnpm install --frozen-lockfile 2>$null
    if ($LASTEXITCODE -ne 0) { pnpm install }
    Write-Success "Dependencies installed"
} else {
    Write-Success "Dependencies already installed"
}

# --- Start infrastructure ---
Write-Log "Starting infrastructure (postgres, redis)..."
docker compose up -d postgres redis

# --- Wait for postgres ---
Write-Log "Waiting for postgres..."
$pgUser = (Get-Item "env:POSTGRES_USER" -ErrorAction SilentlyContinue).Value
$pgDb = (Get-Item "env:POSTGRES_DB" -ErrorAction SilentlyContinue).Value
$attempt = 0
while ($attempt -lt 30) {
    docker compose exec -T postgres pg_isready -U $pgUser -d $pgDb > $null 2>&1
    if ($LASTEXITCODE -eq 0) { break }
    $attempt++
    Start-Sleep -Seconds 1
}
if ($attempt -ge 30) {
    Write-Err "Postgres failed to start"
    docker compose logs postgres
    exit 1
}
Write-Success "Postgres ready"

# --- Wait for redis ---
Write-Log "Waiting for redis..."
$attempt = 0
while ($attempt -lt 30) {
    $output = docker compose exec -T redis redis-cli ping 2>$null
    if ($LASTEXITCODE -eq 0 -and $output -match "PONG") { break }
    $attempt++
    Start-Sleep -Seconds 1
}
if ($attempt -ge 30) {
    Write-Err "Redis failed to start"
    docker compose logs redis
    exit 1
}
Write-Success "Redis ready"

# --- Reset DB if requested ---
if ($Reset) {
    Write-Warn "Resetting database..."
    Push-Location "apps/api"
    try {
        pnpm db:reset --force --skip-generate 2>$null
        if ($LASTEXITCODE -ne 0) { npx prisma migrate reset --force --skip-generate }
    } finally {
        Pop-Location
    }
    Write-Success "Database reset"
}

# --- Create .env if missing ---
if (-not (Test-Path ".env")) {
    Write-Log ".env not found, creating from .env.example..."
    Copy-Item ".env.example" ".env"
    Write-Success ".env created"
}

# --- Generate SETTINGS_ENCRYPTION_KEY if missing ---
Load-EnvFile ".env"
$encryptKey = (Get-Item "env:SETTINGS_ENCRYPTION_KEY" -ErrorAction SilentlyContinue).Value
if (-not $encryptKey) {
    Write-Log "Generating SETTINGS_ENCRYPTION_KEY..."
    $key = (node -e "console.log(require('crypto').randomBytes(32).toString('base64'))").Trim()
    $envContent = Get-Content ".env" -Raw
    if ($envContent -match '(?m)^SETTINGS_ENCRYPTION_KEY\s*=.*') {
        $envContent = $envContent -replace '(?m)^SETTINGS_ENCRYPTION_KEY\s*=.*', "SETTINGS_ENCRYPTION_KEY=$key"
    } else {
        $envContent = $envContent.TrimEnd() + "`nSETTINGS_ENCRYPTION_KEY=$key`n"
    }
    Set-Content -Path ".env" -Value $envContent
    $env:SETTINGS_ENCRYPTION_KEY = $key
    Write-Success "SETTINGS_ENCRYPTION_KEY generated"
}

# --- Migrations ---
Write-Log "Applying migrations..."
Push-Location "apps/api"
try {
    pnpm db:deploy 2>$null
    if ($LASTEXITCODE -ne 0) { npx prisma migrate deploy }
} finally {
    Pop-Location
}
Write-Success "Migrations applied"

# --- Seed ---
Write-Log "Seeding database..."
Push-Location "apps/api"
try {
    pnpm db:seed 2>$null
    if ($LASTEXITCODE -ne 0) { npx tsx prisma/seed.ts 2>$null }
    if ($LASTEXITCODE -ne 0) { Write-Warn "Seed skipped (may already exist)" }
} finally {
    Pop-Location
}
Write-Success "Database seeded"

# --- Generate Prisma client ---
Write-Log "Generating Prisma client..."
Push-Location "apps/api"
try {
    pnpm db:generate 2>$null
    if ($LASTEXITCODE -ne 0) { npx prisma generate }
} finally {
    Pop-Location
}
Write-Success "Prisma client generated"

# --- Start dev servers ---
Write-Host ""
Write-Host "========================================"
Write-Host "  Starting Dev Servers"
Write-Host "========================================"
Write-Host ""

# Truncate log files so Get-Content -Wait -Tail 0 starts clean
Set-Content -Path $ApiLog -Value "" -NoNewline
Set-Content -Path $WebLog -Value "" -NoNewline

# Start API
Write-Log "Starting API (http://localhost:3001)..."
$apiProc = Start-Process -FilePath "pnpm" -ArgumentList "dev" `
    -WorkingDirectory (Join-Path $scriptRoot "apps/api") `
    -RedirectStandardOutput $ApiLog -RedirectStandardError $ApiLog `
    -PassThru -NoNewWindow
Write-Success "API started (PID: $($apiProc.Id))"

# Start Web
Write-Log "Starting Web (http://localhost:5173)..."
$webProc = Start-Process -FilePath "pnpm" -ArgumentList "dev" `
    -WorkingDirectory (Join-Path $scriptRoot "apps/web") `
    -RedirectStandardOutput $WebLog -RedirectStandardError $WebLog `
    -PassThru -NoNewWindow
Write-Success "Web started (PID: $($webProc.Id))"

# Wait for API
Write-Log "Waiting for API to be ready..."
Wait-ForUrl "http://localhost:3001/health" -Retries 30 -FailMessage "API failed to start"
Write-Success "API ready"

# Wait for Web
Write-Log "Waiting for Web to be ready..."
Wait-ForUrl "http://localhost:5173" -Retries 30 -FailMessage "Web failed to start"
Write-Success "Web ready"

# Success banner
Write-Host ""
Write-Host "========================================"
Write-Host "  Job Radar is running!"
Write-Host "========================================"
Write-Host ""
Write-Host "  API:  " -NoNewline; Write-Host "http://localhost:3001" -ForegroundColor Green
Write-Host "  Web:  " -NoNewline; Write-Host "http://localhost:5173" -ForegroundColor Green
Write-Host "  Docs: " -NoNewline; Write-Host "http://localhost:3001/health" -ForegroundColor Green
Write-Host ""
Write-Host "  Press Ctrl+C to stop all servers"
Write-Host ""

# --- Show logs ---
if (-not $NoLogs) {
    Write-Host "========================================"
    Write-Host "  Logs (Ctrl+C to stop)"
    Write-Host "========================================"
    Write-Host ""

    # Start background jobs to tail both log files
    $apiReader = Start-Job -ScriptBlock {
        param($logPath)
        Get-Content $logPath -Wait -Tail 0
    } -ArgumentList $ApiLog

    $webReader = Start-Job -ScriptBlock {
        param($logPath)
        Get-Content $logPath -Wait -Tail 0
    } -ArgumentList $WebLog

    # Receive and display output as it arrives
    while ($true) {
        $apiOutput = Receive-Job $apiReader
        if ($apiOutput) {
            $apiOutput | ForEach-Object { Write-Host "[api] $_" -ForegroundColor Cyan }
        }
        $webOutput = Receive-Job $webReader
        if ($webOutput) {
            $webOutput | ForEach-Object { Write-Host "[web] $_" -ForegroundColor Green }
        }
        Start-Sleep -Milliseconds 200
    }
} else {
    try {
        while ($true) { Start-Sleep -Seconds 1 }
    } finally {
        & $Cleanup
    }
}
