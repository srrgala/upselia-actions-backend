const fs = require("fs");
const path = require("path");
const express = require("express");

const app = express();
app.use(express.json());

// Carga inicial Links_Env.json (stub por ahora)
const LINKS_PATH = path.join(__dirname, "Links_Env.json");
let LINKS_DB = { links: {}, defaults: {}, trainers: {} };
try {
  if (fs.existsSync(LINKS_PATH)) {
    LINKS_DB = JSON.parse(fs.readFileSync(LINKS_PATH, "utf-8"));
  } else {
    console.warn("[WARN] Links_Env.json no encontrado. Usando stub.");
  }
} catch (e) {
  console.error("[ERROR] No se pudo leer Links_Env.json:", e.message);
}

// Whitelist (la validación real se hará en el Paso 2)
const ALLOWED_DOMAINS = new Set([
  "calendly.com",
  "wa.me",
  "meet.google.com",
  "zoom.us",
  "neighborly-jersey-45a.notion.site",
  "stripe.com",
  "buy.stripe.com",
  "paypal.com"
]);

// Endpoints stub
app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "upselia-actions-backend", version: "1.0.0" });
});
app.post("/open_link", (_req, res) => res.status(501).json({ error: "Not implemented yet" }));
app.post("/open_checkout", (_req, res) => res.status(501).json({ error: "Not implemented yet" }));
app.post("/create_ticket", (_req, res) => res.status(501).json({ error: "Not implemented yet" }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[OK] Upselia Actions backend escuchando en http://localhost:${PORT}`);
});
