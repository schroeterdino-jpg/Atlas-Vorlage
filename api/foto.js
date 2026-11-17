"use strict";
// Foto hochladen: Bild ansehen lassen und das Ergebnis kurz merken. Antwort: Art und Beschreibung (der Text bleibt auf dem Server).
const K = require("./_keys.js");
const { tor } = require("./_tor.js");
const F = require("./_foto.js");

module.exports = async function handler(req, res) {
  const b = await tor(req, res); if (!b) return;
  try {
    const bild = String(b.bild || "");
    if (!/^data:image\/(jpeg|png|webp);base64,/.test(bild)) return res.status(400).json({ ok: false, fehler: "Das ist kein Foto (JPEG, PNG oder WebP)." });
    if (bild.length > 3500000) return res.status(413).json({ ok: false, fehler: "Das Foto ist zu groß." });
    const key = await K.schluesselHolen("groq");
    if (!key) return res.status(200).json({ ok: false, fehler: "Groq-Schlüssel fehlt (Einrichtung)" });
    const f = await F.analysieren(bild, key, String(b.text || "").slice(0, 7000)); await F.merken(f);
    res.status(200).json({ ok: true, art: f.art, beschreibung: f.beschreibung });
  } catch (e) { res.status(200).json({ ok: false, fehler: e && e.foto ? "Ich konnte das Foto gerade nicht lesen (" + e.message + "). Bitte noch einmal versuchen." : "Fehler: " + String(e.message || e) }); }
};
