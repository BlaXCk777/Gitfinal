import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { createServer } from "http";
import { Server as SocketServer } from "socket.io";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, "data", "db.json");

const DEFAULT_DATA = {
  customers: [],
  companies: [],
  menu: [],
  bookings: [],
  reservations: [],
  sales: [],
  posState: {},
  exchangeRates: {
    usd: 0.029,  // 1 THB = 0.029 USD (approx 34.5 THB per USD)
    krw: 39.5    // 1 THB = 39.5 KRW (approx)
  }
};

const ensureDataFile = () => {
  if (!fs.existsSync(DATA_FILE)) {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify(DEFAULT_DATA, null, 2),
      "utf8"
    );
  }
};

const readData = () => {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    const obj = (parsed && typeof parsed === "object") ? parsed : {};

    // Preserve unknown keys so new features don't get wiped on write.
    const posStateRaw = (obj.posState && typeof obj.posState === "object" && !Array.isArray(obj.posState)) ? obj.posState : {};
    return {
      ...DEFAULT_DATA,
      ...obj,
      customers: Array.isArray(obj.customers) ? obj.customers : [],
      companies: Array.isArray(obj.companies) ? obj.companies : [],
      menu: Array.isArray(obj.menu) ? obj.menu : [],
      bookings: Array.isArray(obj.bookings) ? obj.bookings : [],
      reservations: Array.isArray(obj.reservations) ? obj.reservations : [],
      sales: Array.isArray(obj.sales) ? obj.sales : [],
      exchangeRates: (obj.exchangeRates && typeof obj.exchangeRates === 'object') 
        ? { ...DEFAULT_DATA.exchangeRates, ...obj.exchangeRates }
        : DEFAULT_DATA.exchangeRates,
      // Deep-merge posState so defaults apply even when db.json already exists.
      posState: {
        ...(DEFAULT_DATA.posState || {}),
        ...posStateRaw
      }
    };
  } catch (err) {
    console.error("Failed to read data file, resetting", err);
    return { ...DEFAULT_DATA };
  }
};

const isIsoDate = (value) => {
  if (typeof value !== 'string') return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
};

const normalizeIsoDate = (value) => {
  const s = String(value || '').trim();
  return isIsoDate(s) ? s : null;
};

const writeData = (data) => {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
};

const nextId = (prefix) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

ensureDataFile();

const app = express();
const httpServer = createServer(app);
const io = new SocketServer(httpServer, {
  cors: { origin: "*" }
});

io.on("connection", (socket) => {
  socket.emit("data:hello", { ok: true, ts: new Date().toISOString() });

  // Handle table selection broadcasts
  socket.on("tableSelection", (data) => {
    socket.broadcast.emit("tableSelection", data);
  });

  // Handle table sizes broadcasts
  socket.on("tableSizesUpdate", (data) => {
    socket.broadcast.emit("tableSizesUpdate", data);
  });
});

const emitUpdate = (topic, payload = null) => {
  io.emit("data:update", { topic, payload, ts: new Date().toISOString() });
};

app.use(cors());
app.use(express.json({ limit: "2mb" }));

// Avoid stale POS UI after updates (browsers can cache HTML aggressively).
const setNoCacheForHtml = (res, filePath) => {
  try {
    if (typeof filePath === 'string' && filePath.toLowerCase().endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  } catch {}
};

app.use(express.static(path.join(__dirname, "public"), { setHeaders: setNoCacheForHtml }));
// Also serve files in the project root (e.g. pos (1).html) so you can open the POS UI
// from the same backend host/port without running a separate Python server.
app.use(express.static(__dirname, { setHeaders: setNoCacheForHtml }));

app.get("/api/status", (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

// POS layout/state (cross-device)
app.get("/api/pos-state", (_req, res) => {
  const data = readData();
  res.json({ state: data.posState || {} });
});

app.put("/api/pos-state", (req, res) => {
  const next = req.body?.state;
  if (!next || typeof next !== "object" || Array.isArray(next)) {
    return res.status(400).json({ error: "state must be an object" });
  }

  const clientId = String(req.get('X-POS-Client') || '').trim();

  const data = readData();
  data.posState = { ...(data.posState || {}), ...next };
  writeData(data);
  emitUpdate("posState", { action: "merge", keys: Object.keys(next), clientId: clientId || null });
  res.json({ state: data.posState });
});

// Exchange Rates
app.get("/api/exchange-rates", (_req, res) => {
  const data = readData();
  res.json({ rates: data.exchangeRates || { usd: 0.029, krw: 39.5 } });
});

app.put("/api/exchange-rates", (req, res) => {
  const { usd, krw } = req.body || {};
  const data = readData();
  if (usd !== undefined) data.exchangeRates.usd = parseFloat(usd) || 0.029;
  if (krw !== undefined) data.exchangeRates.krw = parseFloat(krw) || 39.5;
  writeData(data);
  emitUpdate("exchangeRates", data.exchangeRates);
  res.json({ rates: data.exchangeRates });
});

// Customers
app.get("/api/customers", (_req, res) => {
  const data = readData();
  res.json({ items: data.customers });
});

app.post("/api/customers", (req, res) => {
  const { name, phone, email, notes } = req.body || {};
  if (!name) return res.status(400).json({ error: "Name is required" });
  const data = readData();
  const item = { id: nextId("cust"), name, phone: phone || "", email: email || "", notes: notes || "" };
  data.customers.push(item);
  writeData(data);
  emitUpdate("customers", { action: "create", item });
  res.status(201).json(item);
});

app.put("/api/customers/:id", (req, res) => {
  const data = readData();
  const idx = data.customers.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Not found" });
  const current = data.customers[idx];
  const { name, phone, email, notes } = req.body || {};
  data.customers[idx] = {
    ...current,
    name: name ?? current.name,
    phone: phone ?? current.phone,
    email: email ?? current.email,
    notes: notes ?? current.notes
  };
  writeData(data);
  emitUpdate("customers", { action: "update", item: data.customers[idx] });
  res.json(data.customers[idx]);
});

app.delete("/api/customers/:id", (req, res) => {
  const data = readData();
  const idx = data.customers.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Not found" });
  const removed = data.customers.splice(idx, 1)[0];
  writeData(data);
  emitUpdate("customers", { action: "delete", item: removed });
  res.json(removed);
});

// Companies
app.get("/api/companies", (_req, res) => {
  const data = readData();
  res.json({ items: data.companies });
});

app.post("/api/companies", (req, res) => {
  const { name, taxId, address, phone, contact } = req.body || {};
  if (!name) return res.status(400).json({ error: "Name is required" });
  const data = readData();
  const item = {
    id: nextId("comp"),
    name,
    taxId: taxId || "",
    address: address || "",
    phone: phone || "",
    contact: contact || ""
  };
  data.companies.push(item);
  writeData(data);
  emitUpdate("companies", { action: "create", item });
  res.status(201).json(item);
});

app.put("/api/companies/:id", (req, res) => {
  const data = readData();
  const idx = data.companies.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Not found" });
  const current = data.companies[idx];
  const { name, taxId, address, phone, contact } = req.body || {};
  data.companies[idx] = {
    ...current,
    name: name ?? current.name,
    taxId: taxId ?? current.taxId,
    address: address ?? current.address,
    phone: phone ?? current.phone,
    contact: contact ?? current.contact
  };
  writeData(data);
  emitUpdate("companies", { action: "update", item: data.companies[idx] });
  res.json(data.companies[idx]);
});

app.delete("/api/companies/:id", (req, res) => {
  const data = readData();
  const idx = data.companies.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Not found" });
  const removed = data.companies.splice(idx, 1)[0];
  writeData(data);
  emitUpdate("companies", { action: "delete", item: removed });
  res.json(removed);
});

// Menu
app.get("/api/menu", (_req, res) => {
  const data = readData();
  res.json({ items: data.menu });
});

app.post("/api/menu", (req, res) => {
  const { name, price, category, description } = req.body || {};
  if (!name) return res.status(400).json({ error: "Name is required" });
  const cost = parseFloat(price ?? "0");
  if (Number.isNaN(cost)) return res.status(400).json({ error: "Price must be a number" });
  const data = readData();
  const item = {
    id: nextId("menu"),
    name,
    price: cost,
    category: category || "",
    description: description || ""
  };
  data.menu.push(item);
  writeData(data);
  emitUpdate("menu", { action: "create", item });
  res.status(201).json(item);
});

app.put("/api/menu/:id", (req, res) => {
  const data = readData();
  const idx = data.menu.findIndex((m) => m.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Not found" });
  const current = data.menu[idx];
  const { name, price, category, description } = req.body || {};
  const updated = { ...current };
  if (name !== undefined) updated.name = name;
  if (price !== undefined) {
    const cost = parseFloat(price);
    if (Number.isNaN(cost)) return res.status(400).json({ error: "Price must be a number" });
    updated.price = cost;
  }
  if (category !== undefined) updated.category = category;
  if (description !== undefined) updated.description = description;
  data.menu[idx] = updated;
  writeData(data);
  emitUpdate("menu", { action: "update", item: updated });
  res.json(updated);
});

app.delete("/api/menu/:id", (req, res) => {
  const data = readData();
  const idx = data.menu.findIndex((m) => m.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Not found" });
  const removed = data.menu.splice(idx, 1)[0];
  writeData(data);
  emitUpdate("menu", { action: "delete", item: removed });
  res.json(removed);
});

// Bookings
app.get("/api/bookings", (req, res) => {
  const data = readData();
  const { date } = req.query;
  let items = data.bookings;
  if (date) {
    items = items.filter((b) => b.date === date);
  }
  const totalCovers = items.reduce((sum, b) => sum + (Number(b.partySize) || 0), 0);
  res.json({ items, totals: { bookings: items.length, covers: totalCovers } });
});

app.post("/api/bookings", (req, res) => {
  const { customerName, table, date, time, partySize, notes } = req.body || {};
  if (!customerName || !date) return res.status(400).json({ error: "customerName and date are required" });
  const size = parseInt(partySize ?? "0", 10) || 0;
  const data = readData();
  const item = {
    id: nextId("book"),
    customerName,
    table: table || "",
    date,
    time: time || "",
    partySize: size,
    notes: notes || ""
  };
  data.bookings.push(item);
  writeData(data);
  emitUpdate("bookings", { action: "create", item });
  res.status(201).json(item);
});

app.put("/api/bookings/:id", (req, res) => {
  const data = readData();
  const idx = data.bookings.findIndex((b) => b.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Not found" });
  const current = data.bookings[idx];
  const { customerName, table, date, time, partySize, notes } = req.body || {};
  const updated = { ...current };
  if (customerName !== undefined) updated.customerName = customerName;
  if (table !== undefined) updated.table = table;
  if (date !== undefined) updated.date = date;
  if (time !== undefined) updated.time = time;
  if (partySize !== undefined) {
    const size = parseInt(partySize, 10);
    if (Number.isNaN(size)) return res.status(400).json({ error: "partySize must be a number" });
    updated.partySize = size;
  }
  if (notes !== undefined) updated.notes = notes;
  data.bookings[idx] = updated;
  writeData(data);
  emitUpdate("bookings", { action: "update", item: updated });
  res.json(updated);
});

app.delete("/api/bookings/:id", (req, res) => {
  const data = readData();
  const idx = data.bookings.findIndex((b) => b.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Not found" });
  const removed = data.bookings.splice(idx, 1)[0];
  writeData(data);
  emitUpdate("bookings", { action: "delete", item: removed });
  res.json(removed);
});

// Reservations
app.get("/api/reservations", (req, res) => {
  const data = readData();
  const { date } = req.query;
  let items = data.reservations;
  if (date) {
    items = items.filter((r) => r.date === date);
  }
  const totalPax = items.reduce((sum, r) => sum + (Number(r.pax) || 0), 0);
  res.json({ items, totals: { reservations: items.length, pax: totalPax } });
});

app.post("/api/reservations", (req, res) => {
  const { customerName, phone, companyName, table, date, time, pax, menu, notes } = req.body || {};
  if (!date || !customerName) return res.status(400).json({ error: "date and customerName are required" });
  const count = parseInt(pax ?? "0", 10) || 0;
  const data = readData();
  const item = {
    id: nextId("resv"),
    date,
    time: time || "",
    table: table || "",
    customerName,
    phone: phone || "",
    companyName: companyName || "",
    pax: count,
    menu: menu || "",
    notes: notes || "",
    createdAt: new Date().toISOString()
  };
  data.reservations.push(item);
  writeData(data);
  emitUpdate("reservations", { action: "create", item });
  res.status(201).json(item);
});

app.put("/api/reservations/:id", (req, res) => {
  const data = readData();
  const idx = data.reservations.findIndex((r) => r.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Not found" });
  const current = data.reservations[idx];
  const { customerName, phone, companyName, table, date, time, pax, menu, notes } = req.body || {};

  const updated = { ...current };
  if (date !== undefined) updated.date = date;
  if (time !== undefined) updated.time = time;
  if (table !== undefined) updated.table = table;
  if (customerName !== undefined) updated.customerName = customerName;
  if (phone !== undefined) updated.phone = phone;
  if (companyName !== undefined) updated.companyName = companyName;
  if (pax !== undefined) {
    const count = parseInt(pax, 10);
    if (Number.isNaN(count)) return res.status(400).json({ error: "pax must be a number" });
    updated.pax = count;
  }
  if (menu !== undefined) updated.menu = menu;
  if (notes !== undefined) updated.notes = notes;

  data.reservations[idx] = updated;
  writeData(data);
  emitUpdate("reservations", { action: "update", item: updated });
  res.json(updated);
});

app.delete("/api/reservations/:id", (req, res) => {
  const data = readData();
  const idx = data.reservations.findIndex((r) => r.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Not found" });
  const removed = data.reservations.splice(idx, 1)[0];
  writeData(data);
  emitUpdate("reservations", { action: "delete", item: removed });
  res.json(removed);
});

// Sales (bill history)
app.get('/api/sales', (req, res) => {
  const data = readData();
  const from = normalizeIsoDate(req.query?.from);
  const to = normalizeIsoDate(req.query?.to);

  let items = Array.isArray(data.sales) ? data.sales : [];

  if (from || to) {
    items = items.filter((s) => {
      const d = normalizeIsoDate(s?.businessDate) || normalizeIsoDate(String(s?.createdAt || '').slice(0, 10));
      if (!d) return false;
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  }

  items = items
    .slice()
    .sort((a, b) => String(b?.createdAt || '').localeCompare(String(a?.createdAt || '')));

  const totalBaht = items.reduce((sum, s) => sum + (Number(s?.totalBaht) || 0), 0);
  res.json({ items, totals: { count: items.length, totalBaht } });
});

app.get('/api/sales/:id', (req, res) => {
  const data = readData();
  const item = (data.sales || []).find((s) => s.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

app.post('/api/sales', (req, res) => {
  const payload = (req.body && typeof req.body === 'object') ? req.body : null;
  if (!payload) return res.status(400).json({ error: 'body must be an object' });

  const businessDate = normalizeIsoDate(payload.businessDate) || new Date().toISOString().slice(0, 10);
  const createdAt = typeof payload.createdAt === 'string' && payload.createdAt ? payload.createdAt : new Date().toISOString();
  const totalBaht = Number(payload.totalBaht);
  if (!Number.isFinite(totalBaht)) return res.status(400).json({ error: 'totalBaht must be a number' });

  const data = readData();
  const item = {
    ...payload,
    id: String(payload.id || nextId('sale')),
    businessDate,
    createdAt,
    totalBaht
  };
  data.sales = Array.isArray(data.sales) ? data.sales : [];
  data.sales.push(item);
  writeData(data);
  emitUpdate('sales', { action: 'create', item: { id: item.id, businessDate: item.businessDate, createdAt: item.createdAt, totalBaht: item.totalBaht } });
  res.status(201).json(item);
});

const PORT = parseInt(process.env.PORT || "4000", 10) || 4000;
const HOST = process.env.HOST || "0.0.0.0";

httpServer.listen(PORT, HOST, () => {
  const printableHost = (HOST === "0.0.0.0" || HOST === "::") ? "<LAN IP>" : HOST;
  console.log(`Server running.`);
  console.log(`- Local:   http://localhost:${PORT}`);
  console.log(`- Network: http://${printableHost}:${PORT}`);
});

const shutdown = (signal) => {
  try { console.log(`Received ${signal}, shutting down...`); } catch {}

  try { io.close(); } catch {}
  try {
    httpServer.close(() => {
      try { console.log('Shutdown complete.'); } catch {}
      process.exit(0);
    });
  } catch {
    process.exit(0);
  }

  // Force-exit if something is stuck.
  setTimeout(() => process.exit(0), 5000).unref?.();
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
