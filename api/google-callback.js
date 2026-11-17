"use strict";
// Google leitet nach der Anmeldung hierher zurueck (GET). Der state-Wert aus der Datenbank beweist, dass die Anmeldung von der Einrichtungsseite kam.
const K = require("./_keys.js");
const Gg = require("./_google.js");
const seite = (titel, text, ok) => "<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'><title>Atlas</title><body style='background:#030610;color:#e6f7ff;font-family:system-ui;padding:28px;max-width:560px;margin:auto'><h2 style='color:" + (ok ? "#4ade80" : "#f87171") + "'>" + titel + "</h2><p style='font-size:18px;line-height:1.5'>" + text + "</p><p><a style='color:#38bdf8;font-size:18px' href='/setup.html'>Zurück zur Einrichtung</a></p>";
const esc = s => String(s).replace(/[<>&"']/g, c => "&#" + c.charCodeAt(0) + ";");
module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "text/html; charset=utf-8"); res.setHeader("Cache-Control", "no-store");
  const q = req.query || {};
  try {
    if (q.error) return res.status(200).send(seite("Nicht verbunden", "Google meldet: " + esc(q.error) + ". Du kannst es in der Einrichtung noch einmal versuchen.", false));
    if (!/^[a-f0-9]{32}$/.test(String(q.state || "")) || !q.code) return res.status(400).send(seite("Ungültiger Aufruf", "Bitte die Verbindung über die Einrichtungsseite starten.", false));
    const redirect = await K.redis(["GET", "atlas:gstate:" + q.state]);
    if (!redirect) return res.status(400).send(seite("Link abgelaufen", "Die Anmeldung dauerte zu lange oder wurde schon benutzt. Bitte in der Einrichtung neu starten.", false));
    await K.redis(["DEL", "atlas:gstate:" + q.state]);
    await Gg.code_tauschen(String(q.code), redirect);
    return res.status(200).send(seite("Google Kalender verbunden", "Atlas kann jetzt deine Termine lesen und eintragen. Du kannst dieses Fenster schließen.", true));
  } catch (e) { return res.status(200).send(seite("Verbindung fehlgeschlagen", esc(e.message || e), false)); }
};
