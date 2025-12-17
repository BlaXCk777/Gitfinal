param(
  [string]$Server = 'localhost',
  [int]$Port = 4000,
  [string]$TaskName = 'RestaurantPOS - Open POS'
)

$ErrorActionPreference = 'Stop'

Write-Host 'Kiosk checklist (Windows 10):'
Write-Host '1) NSSM service runs the backend at boot (no login required).'
Write-Host '   - See SERVER_SETUP.md steps 4-5'
Write-Host ''
Write-Host '2) (Optional) Auto-login to show POS immediately after power-on.'
Write-Host '   - Press Win+R, run: netplwiz'
Write-Host '   - Uncheck: "Users must enter a user name and password to use this computer"'
Write-Host '   - Select the cashier account, set auto-login'
Write-Host '   Security note: auto-login stores credentials on the PC.'
Write-Host ''
Write-Host '3) Create Scheduled Task to open POS at logon:'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$createTask = Join-Path $root 'create-open-pos-task.ps1'
& $createTask -TaskName $TaskName -Server $Server -Port $Port
Write-Host ''
Write-Host 'Done. Reboot to verify it comes up automatically.'