param(
  [string]$TaskName = 'RestaurantPOS - Open POS',
  [string]$Server = 'localhost',
  [int]$Port = 4000,
  [int]$DelaySeconds = 2,
  [string]$User = $env:USERNAME,
  [switch]$Kiosk
)

$ErrorActionPreference = 'Stop'

Import-Module ScheduledTasks -ErrorAction Stop

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$scriptPath = Join-Path $root 'open-pos.ps1'
if (-not (Test-Path $scriptPath)) {
  throw "Missing open-pos.ps1 at $scriptPath"
}

# This task is meant to OPEN A BROWSER, so it must run in an interactive user session.
# We register it for a specific user at logon.

$delay = "PT$DelaySeconds`S"
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $User
$trigger.Delay = $delay

$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument (
  '-NoProfile -ExecutionPolicy Bypass -File ' + '"' + $scriptPath + '"' +
  ' -Server ' + '"' + $Server + '"' +
  ' -Port ' + $Port +
  ($(if ($Kiosk) { ' -Kiosk' } else { '' }))
)

$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 5)

# Remove existing task if it exists (idempotent)
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue | Out-Null

$principal = New-ScheduledTaskPrincipal -UserId $User -LogonType InteractiveToken -RunLevel Limited
$task = New-ScheduledTask -Action $action -Trigger $trigger -Settings $settings -Principal $principal

Register-ScheduledTask -TaskName $TaskName -InputObject $task | Out-Null

Write-Host "Scheduled Task created: $TaskName"
Write-Host "- Trigger: At logon ($User)"
Write-Host "- Action: open POS at http://$Server`:$Port/pos.html"
Write-Host "To run now: Start-ScheduledTask -TaskName `"$TaskName`""