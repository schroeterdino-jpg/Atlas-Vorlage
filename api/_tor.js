"use strict";
// Gemeinsame Pruefung fuer alle Atlas-Funktionen: Passwort, Sperre nach Fehlversuchen, Body lesen.
const K = require("./_keys.js");

function ipKey(req) { return "atlas:try:" + String((req.headers && req.headers["x-forwarded-for"]) || "x").split(",")[0].trim(); }

function koerper(req) {
  const b = req.body;
  if (b && typeof b === "object" && !Buffer.isBuffer(b)) return b;
  try { return JSON.parse(String(b || "{}")); } catch (e) { return {}; }
}

// Gibt den Body zurueck, wenn alles stimmt; sonst wurde die Antwort schon gesendet und es kommt null.
async function tor(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") { res.status(405).json({ fehler: "Nur POST" }); return null; }
  const b = koerper(req);
  try {
    if (!process.env.ATLAS_SECRET) { res.status(200).json({ ok: false, fehler: "ATLAS_SECRET fehlt in Vercel" }); return null; }
    if (!K.redisInfo()) { res.status(200).json({ ok: false, fehler: "Datenbank nicht verbunden" }); return null; }
    const k = ipKey(req);
    if (Number(await K.redis(["GET", k]) || 0) >= 10) { res.status(429).json({ ok: false, fehler: "Zu viele falsche Passwörter, bitte 10 Minuten warten" }); return null; }
    if (K.sitzungOk(req.headers && req.headers.cookie, req.headers && req.headers["x-atlas-s"])) return b;
    if (!K.passwortOk(b.pw)) {
      if (b.pw) { const n = await K.redis(["INCR", k]); if (n === 1) await K.redis(["EXPIRE", k, 600]); }
      res.status(401).json({ ok: false, fehler: "Passwort falsch" }); return null;
    }
    return b;
  } catch (e) { res.status(200).json({ ok: false, fehler: String(e.message || e) }); return null; }
}
module.exports = { tor };
