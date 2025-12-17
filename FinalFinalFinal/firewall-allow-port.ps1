param(
  [int]$Port = 4000,
  [string]$RuleName = 'Restaurant POS Backend'
)

$ErrorActionPreference = 'Stop'

function Test-Administrator {
  $current = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
  if (-not $current.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Run this script in an elevated (Administrator) PowerShell.'
  }
}

Test-Administrator

# Remove existing rule if present (keeps it idempotent)
Get-NetFirewallRule -DisplayName $RuleName -ErrorAction SilentlyContinue | Remove-NetFirewallRule -ErrorAction SilentlyContinue

New-NetFirewallRule `
  -DisplayName $RuleName `
  -Direction Inbound `
  -Action Allow `
  -Protocol TCP `
  -LocalPort $Port `
  -Profile Any | Out-Null

Write-Host "Firewall rule added: '$RuleName' (TCP $Port inbound)"