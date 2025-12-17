param(
  [string]$ServiceName = 'RestaurantPOS',
  [int]$Port = 4000,
  [string]$HostAddress = '0.0.0.0',
  [string]$NssmPath = 'nssm'
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

function Assert-AdminPrivilege {
  $current = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
  if (-not $current.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Run this script in an elevated (Administrator) PowerShell.'
  }
}

Assert-AdminPrivilege

# Resolve nssm.exe
try {
  $NssmPath = (Get-Command $NssmPath -ErrorAction Stop).Source
} catch {
  throw "Cannot find NSSM ('$NssmPath'). Put nssm.exe in PATH or pass -NssmPath C:\\path\\to\\nssm.exe"
}

# Resolve node.exe (important: Windows Services often do NOT inherit your user PATH)
try {
  $nodeExe = (Get-Command node -ErrorAction Stop).Source
} catch {
  throw 'Cannot find node.exe. Install Node.js LTS and ensure node is available system-wide.'
}

$serverJs = Join-Path $root 'server.js'
if (-not (Test-Path $serverJs)) {
  throw "Missing server.js at $serverJs"
}

Write-Host "Installing/updating service '$ServiceName'..."

# Create service (safe if it already exists; NSSM will update settings)
& $NssmPath install $ServiceName $nodeExe $serverJs

# Working dir
& $NssmPath set $ServiceName AppDirectory $root

# Environment variables for the service
$envExtra = @(
  "PORT=$Port",
  "HOST=$HostAddress",
  'NODE_ENV=production'
) -join "`r`n"
& $NssmPath set $ServiceName AppEnvironmentExtra $envExtra

# Logs (so you can debug if the service fails)
$logDir = Join-Path $root 'logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
& $NssmPath set $ServiceName AppStdout (Join-Path $logDir 'service-stdout.log')
& $NssmPath set $ServiceName AppStderr (Join-Path $logDir 'service-stderr.log')
& $NssmPath set $ServiceName AppRotateFiles 1
& $NssmPath set $ServiceName AppRotateOnline 1
& $NssmPath set $ServiceName AppRotateSeconds 86400
& $NssmPath set $ServiceName AppRotateBytes 10485760

# Restart policy
& $NssmPath set $ServiceName Start SERVICE_AUTO_START
& $NssmPath set $ServiceName AppExit Default Restart

Write-Host "Starting service '$ServiceName'..."
& $NssmPath start $ServiceName

Write-Host 'Done.'
Write-Host "Service: $ServiceName"
Write-Host "URL (local):   http://localhost:$Port/pos.html"
Write-Host "URL (network): http://<server-ip>:$Port/pos.html"