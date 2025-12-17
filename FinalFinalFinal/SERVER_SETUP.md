# Restaurant server setup (Windows + NSSM)

## 1) Install prerequisites
- Install **Node.js LTS** on the server.
- Put **nssm.exe** somewhere permanent (example: `C:\Tools\nssm\nssm.exe`) and optionally add it to PATH.

## 2) Copy the project folder
Copy this whole folder to the server (example: `C:\RestaurantPOS\FinalFinalFinal`).

## 3) Install dependencies
From PowerShell in the project folder:

- `npm install`

## 4) Allow LAN devices to connect (Firewall)
Run PowerShell as Administrator:

- `./firewall-allow-port.ps1 -Port 4000`

## 5) Install the Windows Service (NSSM)
Run PowerShell as Administrator:

- If nssm is in PATH:
  - `./nssm-install.ps1 -ServiceName RestaurantPOS -Port 4000 -Host 0.0.0.0`

- If nssm is NOT in PATH:
  - `./nssm-install.ps1 -NssmPath C:\Tools\nssm\nssm.exe -ServiceName RestaurantPOS -Port 4000 -Host 0.0.0.0`

This creates an auto-start service and starts it immediately.

Note: On the always-on server PC, you typically do NOT need to open the POS UI locally. The service runs headless.

If you ever start manually (not recommended for production), you can run:
- `./start.ps1 -NoOpen`

## 6) Open the POS UI automatically on login (cashier device)
Option A (simple): put a shortcut in Startup
- Create a shortcut that runs:
  - `powershell.exe -ExecutionPolicy Bypass -File "C:\RestaurantPOS\FinalFinalFinal\open-pos.ps1" -Server localhost -Port 4000`
- Put the shortcut in:
  - `shell:startup`

Option B (recommended): Scheduled Task at logon
- Create the Scheduled Task automatically (Windows 10):
  - `./create-open-pos-task.ps1 -Server localhost -Port 4000`

Kiosk-style (fastest “power on → POS on screen”):
- Backend always-on: NSSM service (steps 4-5)
- Optional auto-login: run `netplwiz` and configure auto sign-in for the cashier account
- Open POS at logon: `./create-open-pos-task.ps1 -Server localhost -Port 4000`

One-command helper:
- `./create-kiosk-pos.ps1 -Server localhost -Port 4000`

## URLs
- Same machine: `http://localhost:4000/pos%20(1).html`
- Other devices: `http://<server-ip>:4000/pos%20(1).html`

## Logs
If the service doesn’t start, check:
- `logs/service-stdout.log`
- `logs/service-stderr.log`
