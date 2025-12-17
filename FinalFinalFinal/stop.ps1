$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$pidFile = Join-Path $root ".server.pid"

if (Test-Path $pidFile) {
  $procId = Get-Content $pidFile -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($procId -match '^\d+$') {
    Write-Host "Stopping backend PID $procId"
    try { Stop-Process -Id ([int]$procId) -Force -ErrorAction SilentlyContinue } catch {}
  }
  Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
} else {
  Write-Host "No .server.pid found. If the server is still running, stop it via Task Manager or run:"
  Write-Host "  netstat -ano | findstr :4000"
}
