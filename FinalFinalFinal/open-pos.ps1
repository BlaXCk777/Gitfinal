param(
  [string]$Server = 'localhost',
  [int]$Port = 4000
)

$ErrorActionPreference = 'Stop'

$url = "http://$Server`:$Port/pos.html"

# Wait a bit for the service to come up after boot
for ($i = 0; $i -lt 25; $i++) {
  try {
    Invoke-WebRequest -Uri "http://$Server`:$Port/api/status" -UseBasicParsing -TimeoutSec 2 | Out-Null
    break
  } catch {
    Start-Sleep -Milliseconds 400
  }
}

Start-Process $url
Write-Host "Opened: $url"