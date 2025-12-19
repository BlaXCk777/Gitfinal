param(
  [string]$Server = 'localhost',
  [int]$Port = 4000,
  [switch]$Kiosk
)

$ErrorActionPreference = 'Stop'

function Resolve-BrowserPath {
  # Prefer Edge for kiosk mode.
  $candidates = @(
    (Get-Command msedge.exe -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -ErrorAction SilentlyContinue),
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles(x86)\Microsoft\Edge\Application\msedge.exe",
    (Get-Command chrome.exe -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -ErrorAction SilentlyContinue),
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "$env:ProgramFiles(x86)\Google\Chrome\Application\chrome.exe"
  ) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -Unique

  return $candidates | Select-Object -First 1
}

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

if ($Kiosk) {
  $browser = Resolve-BrowserPath
  if ($browser) {
    $browserName = Split-Path -Leaf $browser
    if ($browserName -ieq 'msedge.exe') {
      Start-Process -FilePath $browser -ArgumentList @(
        '--kiosk', $url,
        '--edge-kiosk-type=fullscreen',
        '--no-first-run',
        '--disable-features=Translate'
      )
      Write-Host "Opened (kiosk): $url (Edge)"
      return
    }
    if ($browserName -ieq 'chrome.exe') {
      Start-Process -FilePath $browser -ArgumentList @(
        '--kiosk', $url,
        '--no-first-run',
        '--disable-features=Translate'
      )
      Write-Host "Opened (kiosk): $url (Chrome)"
      return
    }
  }

  # Fallback: open default browser (may not enter true fullscreen automatically).
  Start-Process $url
  Write-Host "Opened (default browser): $url"
  return
}

Start-Process $url
Write-Host "Opened: $url"