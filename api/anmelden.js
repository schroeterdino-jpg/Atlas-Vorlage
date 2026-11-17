"use strict";
// Einmal Passwort eingeben, danach haelt ein sicherer Cookie die Anmeldung (halbes Jahr). {abmelden:true} loescht ihn.
const K = require("./_keys.js");
const ipKey = req => "atlas:try:" + String((req.headers && req.headers["x-forwarded-for"]) || "x").split(",")[0].trim();
module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ fehler: "Nur POST" });
  let b = req.body; if (typeof b === "string") { try { b = JSON.parse(b); } catch (e) { b = {}; } } b = b || {};
  try {
    if (b.abmelden) { res.setHeader("Set-Cookie", K.sitzungLoeschCookie()); return res.status(200).json({ ok: true }); }
    if (!process.env.ATLAS_SECRET) return res.status(200).json({ ok: false, fehler: "ATLAS_SECRET fehlt in Vercel" });
    if (!K.redisInfo()) return res.status(200).json({ ok: false, fehler: "Datenbank nicht verbunden" });
    const k = ipKey(req);
    if (Number(await K.redis(["GET", k]) || 0) >= 10) return res.status(429).json({ ok: false, fehler: "Zu viele falsche Passwörter, bitte 10 Minuten warten" });
    if (!K.passwortOk(b.pw)) { const n = await K.redis(["INCR", k]); if (n === 1) await K.redis(["EXPIRE", k, 600]); return res.status(401).json({ ok: false, fehler: "Passwort falsch" }); }
    const token = K.sitzungToken(); res.setHeader("Set-Cookie", K.sitzungCookie(token));
    return res.status(200).json({ ok: true, token });
  } catch (e) { return res.status(200).json({ ok: false, fehler: String(e.message || e) }); }
};
