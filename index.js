const fs = require("fs");
const path = require("path");
const express = require("express");

const app = express();
app.use(express.json());

/* ========= Config ========= */
const LINKS_PATH = path.join(__dirname, "Links_Env.json");
const TICKETS_PATH = path.join(__dirname, "tickets.jsonl");
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

/* ========= Utilidades JSON ========= */
function readJsonSafe(p) {
  try {
    const raw = fs.readFileSync(p, "utf-8");
    return JSON.parse(raw);
  } catch (e) {
    console.error("[ERROR] Leyendo JSON:", e.message);
    return null;
  }
}

/* ========= Validación Links_Env ========= */
function validateLinksEnv(db) {
  const errors = [];
  if (!db || typeof db !== "object") {
    errors.push("Links_Env.json no es un objeto");
    return errors;
  }
  if (!db.links || typeof db.links !== "object") errors.push("Falta 'links'");
  if (!db.defaults || typeof db.defaults !== "object") errors.push("Falta 'defaults'");
  if (!db.trainers || typeof db.trainers !== "object") errors.push("Falta 'trainers'");
  if (db.links && typeof db.links === "object") {
    for (const [k, v] of Object.entries(db.links)) {
      if (typeof v !== "string") errors.push(`links.${k} no es string`);
      else if (!isHttps(v)) errors.push(`links.${k} no es HTTPS`);
      else if (!isAllowedDomain(v)) errors.push(`links.${k} tiene dominio no permitido`);
    }
  }
  return errors;
}

/* ========= Carga Links_Env ========= */
let LINKS_DB = { links: {}, defaults: {}, trainers: {} };
if (fs.existsSync(LINKS_PATH)) {
  const parsed = readJsonSafe(LINKS_PATH);
  const errs = validateLinksEnv(parsed);
  if (errs.length) {
    console.warn("[WARN] Links_Env.json con problemas:\n - " + errs.join("\n - "));
    LINKS_DB = parsed || LINKS_DB;
  } else {
    LINKS_DB = parsed;
  }
} else {
  console.warn("[WARN] Links_Env.json no encontrado. Usando estructura vacía.");
}

/* ========= Helpers ========= */
function getDomain(url) {
  try { return new URL(url).hostname; } catch { return ""; }
}
function isHttps(url) {
  try { return new URL(url).protocol === "https:"; } catch { return false; }
}
function isAllowedDomain(url) {
  const host = getDomain(url);
  if (!host) return false;
  for (const d of ALLOWED_DOMAINS) {
    if (host === d || host.endsWith(`.${d}`)) return true;
  }
  return false;
}
function getUrlByKey(key) {
  if (!key) return null;
  return LINKS_DB?.links?.[key] || null;
}
function resolveLinkForTrainer({ type, trainerId, key }) {
  if (key) {
    const direct = getUrlByKey(key);
    return direct ? { from: "key", key, url: direct } : null;
  }
  if (trainerId && type && LINKS_DB?.trainers?.[trainerId]) {
    const mappedKey = LINKS_DB.trainers[trainerId][type];
    if (mappedKey) {
      const url = getUrlByKey(mappedKey);
      if (url) return { from: "trainer", key: mappedKey, url };
    }
  }
  if (type && LINKS_DB?.defaults?.[type]) {
    const defKey = LINKS_DB.defaults[type];
    const url = getUrlByKey(defKey);
    if (url) return { from: "default", key: defKey, url };
  }
  return null;
}
function ok(res, data) { return res.status(200).json({ ok: true, ...data }); }
function fail(res, code, msg) { return res.status(code).json({ ok: false, error: msg }); }

/* ========= Endpoints ========= */
app.get("/health", (_req, res) => {
  ok(res, { service: "upselia-actions-backend", version: "1.2.0" });
});

app.post("/open_link", (req, res) => {
  const { url_key } = req.body || {};
  if (!url_key) return fail(res, 400, "Falta url_key");
  const url = getUrlByKey(url_key);
  if (!url) return fail(res, 404, "url_key no encontrada");
  if (!isHttps(url)) return fail(res, 400, "URL no es HTTPS");
  if (!isAllowedDomain(url)) return fail(res, 400, "Dominio no permitido");
  return ok(res, { url_key, url });
});

app.post("/open_checkout", (req, res) => {
  const { trainer_id, url_key } = req.body || {};
  const resolved = resolveLinkForTrainer({ type: "checkout", trainerId: trainer_id, key: url_key });
  if (!resolved) return fail(res, 404, "No se pudo resolver checkout");
  const { url, key, from } = resolved;
  if (!isHttps(url)) return fail(res, 400, "URL no es HTTPS");
  if (!isAllowedDomain(url)) return fail(res, 400, "Dominio no permitido");
  return ok(res, { resolved_key: key, resolved_from: from, url });
});

app.post("/create_ticket", (req, res) => {
  const { trainer_id, topic, message, contact } = req.body || {};
  if (!topic || !message) return fail(res, 400, "Faltan 'topic' o 'message'");
  const ticket = {
    id: `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    trainer_id: trainer_id || null,
    topic: String(topic).slice(0, 200),
    message: String(message).slice(0, 2000),
    contact: contact ? String(contact).slice(0, 200) : null,
    created_at: new Date().toISOString()
  };
  try {
    fs.appendFileSync(TICKETS_PATH, JSON.stringify(ticket) + "\n", "utf-8");
  } catch (e) {
    console.error("[ERROR] Guardando ticket:", e.message);
    return fail(res, 500, "No se pudo guardar el ticket");
  }
  return ok(res, { ticket_id: ticket.id });
});

/* ========= Arranque ========= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[OK] Upselia Actions backend escuchando en http://localhost:${PORT}`);
});
