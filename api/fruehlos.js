"use strict";
const { tor } = require("./_tor.js");
const Ue = require("./_ueberblick.js");
const Fr = require("./_fruehlos.js");
module.exports = async function handler(req, res) {
  const b = await tor(req, res); if (!b) return;
  try {
    const r = await Promise.race([Ue.ueberblick({}, {}), new Promise(x => setTimeout(() => x(null), 20000))]);
    res.status(200).json(Object.assign({ ok: true }, Fr.text(r)));
  } catch (e) { res.status(200).json({ ok: false, senden: false, fehler: String(e.message || e).slice(0, 200) }); }
};
