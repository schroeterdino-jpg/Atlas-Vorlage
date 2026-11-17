"use strict";
// Heimweg nach der Arbeit: Fahrzeit und Verkehr. Die Atlas-App ruft das kurz vor Schichtende auf und zeigt es als Benachrichtigung.
const { tor } = require("./_tor.js");
const F = require("./_fahrt.js");
const Ab = require("./_autobahn.js");
module.exports = async function handler(req, res) {
  const b = await tor(req, res); if (!b) return;
  try {
    const f = await Promise.race([F.strecke("arbeit", "heim"), new Promise(r => setTimeout(() => r(null), 12000))]);
    if (!f || !f.ok) return res.status(200).json({ ok: true, titel: "Heimweg", text: "Verkehr gerade nicht abrufbar. Google Maps zeigt ihn dir.", minuten: null });
    const plus = Math.max(0, f.verzoegerung_min || 0), stau = f.staus && f.staus.length ? f.staus[0] : null;
    const lage = plus < 5 ? "frei" : plus < 15 ? "leicht erhöht" : plus < 30 ? "dicht" : "sehr dicht";
    let text = f.minuten + " Min nach Hause · Verkehr " + lage + (plus >= 5 ? " (+" + plus + " Min)" : "");
    if (stau) text += "\nStau: " + String(stau.satz || stau.strasse || "auf der Strecke").slice(0, 120);
    else if (!f.live) text += "\n(ohne Live-Verkehr berechnet)";
    const ab = await Promise.race([Ab.aufStrecke(f.karte && f.karte.punkte), new Promise(r => setTimeout(() => r(null), 8000))]).catch(() => null);
    const abz = Ab.zeile(ab); if (abz) text += "\n" + abz; else text += "\nAutobahn-Meldungen nicht abrufbar";
    res.status(200).json({ ok: true, titel: "Heimweg", text, minuten: f.minuten, verzoegerung: plus, lage, staus: (f.staus || []).slice(0, 3) });
  } catch (e) { res.status(200).json({ ok: false, fehler: String(e.message || e).slice(0, 200) }); }
};
