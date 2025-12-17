# Restaurant POS System - AI Agent Instructions

## Architecture Overview

This is a full-stack **restaurant POS system** for "Heung Boo Ne Garden" with:
- **Backend**: Express + Socket.IO server ([server.js](../server.js)) serving REST APIs and real-time updates
- **Frontend**: Single-file HTML applications with vanilla JavaScript (no build step)
- **Data**: File-based JSON storage ([data/db.json](../data/db.json)) - all data persists to this single file
- **Deployment**: Windows-focused with NSSM service wrapper for production kiosks

### Key Components
- `pos.html` (9500+ lines): Main POS interface with drag-drop table layout, order management, multi-currency support (THB/USD/KRW)
- `public/*.html`: Admin UIs for customers, companies, menu, bookings, reservations
- `server.js`: Single-file backend handling all API routes and Socket.IO real-time sync
- PowerShell scripts: Windows service management, kiosk setup, firewall configuration

## Critical Data Flow

1. **Real-time Sync**: Changes to data emit Socket.IO `data:update` events → all connected clients refresh automatically
2. **State Persistence**: `/api/pos-state` endpoint stores cross-device UI state (table layouts, positions) in `db.json`
3. **ID Generation**: All entities use timestamp-based IDs via `nextId(prefix)` (e.g., `cust_mj87qwkz4c2m`)
4. **No Cache for HTML**: Server explicitly sets `Cache-Control: no-store` on HTML to prevent stale UIs after updates

## Development Workflows

### Start Development Server
```powershell
npm install
npm start  # Runs on 0.0.0.0:4000 by default
```
Or use `./start.ps1` which auto-opens POS UI and kills existing port listeners.

### Production Deployment (Windows Kiosk)
```powershell
# As Administrator
./firewall-allow-port.ps1 -Port 4000
./nssm-install.ps1 -ServiceName RestaurantPOS -Port 4000 -Host 0.0.0.0
./create-kiosk-pos.ps1 -Server localhost -Port 4000  # Auto-open POS on login
```
See [SERVER_SETUP.md](../SERVER_SETUP.md) for complete setup guide. Service logs → `logs/service-{stdout,stderr}.log`.

### Data Management
- **Reset data**: Delete `data/db.json`, server recreates it with `DEFAULT_DATA` on next start
- **Backup**: Copy `data/db.json` (no migrations, schema is duck-typed with fallback defaults)
- **Debug**: Check `.server.pid` for running PID, view browser console for Socket.IO connection status

## Project-Specific Conventions

### API Pattern
- **REST**: CRUD operations follow Express REST conventions (GET/POST/PUT/DELETE)
- **Socket.IO**: Listen for `data:update` events with `{ topic, payload, ts }` after mutations
- **Validation**: Minimal - required fields return 400, missing IDs return 404, no schema validation

### Frontend Architecture
- **No Framework**: Pure vanilla JS with inline `<script>` tags (9500+ line files are normal here)
- **No Build Step**: Edit HTML/CSS/JS directly, refresh browser (cache busting is automatic for HTML)
- **Touch-First**: `@media (pointer: coarse)` rules for 44px minimum tap targets on touch devices
- **Drag-and-Drop**: POS table layout uses native HTML5 drag-and-drop (touch polyfill built-in)

### Code Style
- **ES Modules**: Use `import`/`export` syntax in Node.js (package.json has `"type": "module"`)
- **Avoid Breaking Changes**: When editing `server.js`, preserve unknown keys in data objects (see `readData()` merge logic)
- **PowerShell**: Scripts use `-ExecutionPolicy Bypass` pattern for restricted environments

## Common Pitfalls

1. **File Naming**: POS UI is accessed via `/pos%20(1).html` (URL-encoded space) - actual filename is `pos.html`
2. **Port Conflicts**: `start.ps1` kills existing listeners on port 4000 automatically
3. **Cross-Device State**: Changes to table layout persist via `/api/pos-state` - don't store in localStorage
4. **Socket.IO Path**: Frontend loads from `/socket.io/socket.io.js` (auto-served by Socket.IO middleware)
5. **Currency Display**: All prices stored in THB; conversion to USD/KRW uses `/api/exchange-rates`

## Adding New Features

**New API Endpoint**: Follow pattern in [server.js](../server.js) (lines 150-400):
```javascript
app.get("/api/items", (_req, res) => {
  const data = readData();
  res.json({ items: data.items });
});

app.post("/api/items", (req, res) => {
  const data = readData();
  const item = { id: nextId("item"), ...req.body };
  data.items.push(item);
  writeData(data);
  emitUpdate("items", { action: "create", item });
  res.status(201).json(item);
});
```

**New Admin Page**: Copy [public/index.html](../public/index.html), add to sidebar nav, use `/style.css` for consistent styling.

**POS Customization**: Search for `/* ==== SECTION_NAME ==== */` comments in [pos.html](../pos.html) - organized by feature area.
