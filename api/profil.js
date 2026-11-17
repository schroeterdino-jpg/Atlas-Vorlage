"use strict";
// Profil der Person (Name, Wohnort, Heim, Arbeit) lesen und speichern. Wird vom Einrichtungsassistenten in der App benutzt.
const { tor } = require("./_tor.js");
const Pf = require("./_profil.js");
module.exports = async function handler(req, res) {
  const b = await tor(req, res); if (!b) return;
  try {
    if (b.aktion === "speichern") {
      const neu = Pf.saeubern(b.profil || {});
      // Wohnort ohne Koordinaten: ueber die Ortssuche des Wetterdienstes nachschlagen
      if (neu.ort && neu.lat === undefined) {
        try { const r = await fetch("https://geocoding-api.open-meteo.com/v1/search?count=1&language=de&name=" + encodeURIComponent(neu.ort), { signal: AbortSignal.timeout(8000) }); const j = await r.json(), o = j.results && j.results[0]; if (o) { neu.lat = o.latitude; neu.lon = o.longitude; if (!neu.region && o.admin2) neu.region = o.admin2; } } catch (e) {}
      }
      if (b.fertig === true) neu.eingerichtet = true; else delete neu.eingerichtet;
      const p = await Pf.speichern(neu);
      return res.status(200).json({ ok: true, profil: p });
    }
    const p = await Pf.laden();
    res.status(200).json({ ok: true, profil: p });
  } catch (e) { res.status(200).json({ ok: false, fehler: String(e.message || e).slice(0, 200) }); }
};
