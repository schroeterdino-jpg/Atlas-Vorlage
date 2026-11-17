"use strict";
// Briefing per Push: die Atlas-App ruft das zur eingestellten Zeit (nach dem Aufstehen) auf und zeigt es als Benachrichtigung.
const { tor } = require("./_tor.js");
const Ue = require("./_ueberblick.js");
module.exports = async function handler(req, res) {
  const b = await tor(req, res); if (!b) return;
  try {
    const r = await Promise.race([Ue.ueberblick({ briefing: true }, {}), new Promise(x => setTimeout(() => x(null), 20000))]);
    if (!r || !r.vorlesen) return res.status(200).json({ ok: true, titel: "Briefing", text: "Briefing gerade nicht abrufbar. Frag Atlas selbst." });
    const t = r.vorlesen, ersterPunkt = t.indexOf(".");
    res.status(200).json({ ok: true, titel: ersterPunkt > 0 ? t.slice(0, ersterPunkt) : "Briefing", text: t.slice(ersterPunkt + 1).trim() || t });
  } catch (e) { res.status(200).json({ ok: false, fehler: String(e.message || e).slice(0, 200) }); }
};
