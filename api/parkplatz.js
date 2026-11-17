"use strict";
// Die Atlas-App meldet den Parkplatz (Auto-Bluetooth getrennt): { lat, lon, zeit (ms) }
const { tor } = require("./_tor.js");
const Pk = require("./_parkplatz.js");
module.exports = async function handler(req, res) {
  const b = await tor(req, res); if (!b) return;
  try { res.status(200).json(await Pk.speichern(b.lat, b.lon, "bluetooth", Number(b.zeit))); }
  catch (e) { res.status(200).json({ ok: false, fehler: String(e.message || e).slice(0, 200) }); }
};
