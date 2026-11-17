"use strict";
process.env.VERCEL_PROJECT_PRODUCTION_URL = "atlas-beispiel.vercel.app"; // Test laeuft als Altbestand-Kopie (Profil des Erfinders)
// Parkplatz: speichern, lesen, Navigation zum Auto, mit Schein-Diensten.
const assert = require("assert");
process.env.ATLAS_SECRET = "mein-langes-passwort"; process.env.KV_REST_API_URL = "https://db.test"; process.env.KV_REST_API_TOKEN = "t";
const hs = {};
global.fetch = async (url, o) => {
  url = String(url); o = o || {};
  if (url.startsWith("https://db.test")) { const c = JSON.parse(o.body); let result = null; if (c[0] === "HSET") { hs[c[1] + "/" + c[2]] = c[3]; result = 1; } else if (c[0] === "HGET") result = hs[c[1] + "/" + c[2]] || null; else if (c[0] === "HDEL") { delete hs[c[1] + "/" + c[2]]; result = 1; } return { ok: true, json: async () => ({ result }) }; }
  if (url.includes("nominatim")) return { ok: true, json: async () => ({ address: { road: "Lauenburger Straße", town: "Musterstadt" } }) };
  return { ok: false, json: async () => ({}) };
};
const W = require("../api/_werkzeuge.js"), Pk = require("../api/_parkplatz.js");
(async () => {
  let e = await W.ausfuehren("parkplatz", { aktion: "wo" }, {}); assert.ok(e.ok && e.unbekannt, "noch kein Parkplatz");
  e = await W.ausfuehren("parkplatz", { aktion: "merken" }, {}); assert.ok(!e.ok, "ohne Standort ehrlich");
  e = await W.ausfuehren("parkplatz", { aktion: "merken" }, { standort: { lat: 53.5, lon: 10.47 } }); assert.ok(e.ok && /Lauenburger/.test(e.gemerkt), "von Hand merken");
  e = await Pk.speichern(53.51, 10.48, "bluetooth", Date.now() - 600000); assert.ok(e.ok && e.parkplatz.quelle === "bluetooth", "automatisch speichern");
  e = await W.ausfuehren("parkplatz", { aktion: "wo" }, { standort: { lat: 53.5, lon: 10.47 } }); assert.ok(e.ok && /Lauenburger/.test(e.wo) && /10 Minuten/.test(e.vor) && e.entfernung_km > 0, "Auskunft");
  e = await Pk.speichern(999, 0, "hand"); assert.ok(!e.ok, "ungueltig");
  e = await W.ausfuehren("navigation", { ziel: "mein Auto" }, {}); assert.ok(e.ok && e.modus === "zu_fuss" && /53\.51,10\.48/.test(decodeURIComponent(e.fuerApp.url)), "Navigation zum Auto zu Fuss");
  e = await W.ausfuehren("parkplatz", { aktion: "vergessen" }, {}); assert.ok(e.ok); e = await W.ausfuehren("parkplatz", { aktion: "wo" }, {}); assert.ok(e.unbekannt, "vergessen");
  console.log("parkplatz: alle Pruefungen gruen");
})().catch(x => { console.log("FEHLER", x.message); process.exit(1); });
