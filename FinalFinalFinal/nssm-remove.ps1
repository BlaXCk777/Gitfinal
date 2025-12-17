param(
  [string]$ServiceName = 'RestaurantPOS',
  [string]$NssmPath = 'nssm'
)

$ErrorActionPreference = 'Stop'

function Assert-Admin {
  $current = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
  if (-not $current.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Run this script in an elevated (Administrator) PowerShell.'
  }
}

Assert-Admin

try {
  $nssmCmd = (Get-Command $NssmPath -ErrorAction Stop).Source
} catch {
  throw "Cannot find NSSM ('$NssmPath'). Put nssm.exe in PATH or pass -NssmPath C:\\path\\to\\nssm.exe"
}

Write-Host "Stopping service '$ServiceName' (if running)..."
try { & $nssmCmd stop $ServiceName } catch {}

Write-Host "Removing service '$ServiceName'..."
& $nssmCmd remove $ServiceName confirm

Write-Host 'Done.'