param(
  [switch]$NoOpen
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$port = if ($env:PORT) { [int]$env:PORT } else { 4000 }
$hostBind = if ($env:HOST) { $env:HOST } else { '0.0.0.0' }
$pidFile = Join-Path $root ".server.pid"

Write-Host "Starting POS backend on $hostBind`:$port..."

# Kill anything already listening on the target port
try {
  $pids = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique

  foreach ($procId in $pids) {
    if ($procId -and $procId -ne $PID) {
      Write-Host "Stopping existing process on port $port (PID $procId)"
      try { Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue } catch {}
    }
  }
} catch {
  # Get-NetTCPConnection may be unavailable on some systems; fallback to netstat.
  $lines = & cmd /c "netstat -ano | findstr :$port" 2>$null
  foreach ($line in ($lines -split "`r?`n")) {
    if ($line -match "\sLISTENING\s+(\d+)$") {
      $procId = [int]$Matches[1]
      Write-Host "Stopping existing process on port $port (PID $procId)"
      try { Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue } catch {}
    }
  }
}

# Start the backend
$env:PORT = "$port"
$env:HOST = "$hostBind"
$proc = Start-Process -FilePath "node" -ArgumentList "server.js" -WorkingDirectory $root -PassThru
$proc.Id | Out-File -FilePath $pidFile -Encoding ascii

Start-Sleep -Seconds 1

# Open the POS UI (optional)
if (-not $NoOpen) {
  $posUrl = "http://localhost:$port/pos%20(1).html"
  Write-Host "Opening $posUrl"
  Start-Process $posUrl
}

Write-Host "Backend PID: $($proc.Id)"
Write-Host "To stop later: .\stop.ps1"
