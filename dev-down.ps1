<#
.SYNOPSIS
  Job Radar - Stop Dev Environment (Windows PowerShell)

.DESCRIPTION
  Windows equivalent of dev-down.sh. Stops API and Web dev servers
  while keeping the database and Redis running.

.EXAMPLE
  .\dev-down.ps1
#>

$ErrorActionPreference = "SilentlyContinue"

Write-Host "Stopping Job Radar dev servers..."

# Kill pnpm dev processes (API + Web)
$pnpmProcs = Get-Process -Name "pnpm" -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "*pnpm*" }
if ($pnpmProcs) {
    $pnpmProcs | Stop-Process -Force
}

# Kill node processes spawned by pnpm dev (vite, tsx watch, etc.)
$nodeProcs = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {
    $_.Path -like "*node*" -and (
        $_.CommandLine -like "*vite*" -or
        $_.CommandLine -like "*tsx*watch*" -or
        $_.CommandLine -like "*fastify*"
    )
}
if ($nodeProcs) {
    $nodeProcs | Stop-Process -Force
}

Write-Host "Dev servers stopped."
Write-Host ""
Write-Host "To also stop infrastructure (postgres, redis):"
Write-Host "  docker compose down"
Write-Host ""
Write-Host "To stop everything including volumes:"
Write-Host "  docker compose down -v"
