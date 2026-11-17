"use strict";
process.env.VERCEL_PROJECT_PRODUCTION_URL = "atlas-beispiel.vercel.app"; // Test laeuft als Altbestand-Kopie (Profil des Erfinders)
// Prueft Sonne und Mond (rechnet selbst, kein Netz).
const assert = require("assert");
global.fetch = async () => ({ ok: false, status: 404, json: async () => ({}) });
process.env.ATLAS_SECRET = "mein-langes-passwort";
const W = require("../api/_werkzeuge.js");
const min = t => +t.slice(0, 2) * 60 + +t.slice(3);
(async () => {
  let e = await W.ausfuehren("sonne_mond", { datum: "2026-11-15" }, { standort: { lat: 53.5, lon: 10.48 } });
  assert.ok(e.ok && e.ort === "deinem Standort", "laeuft mit Standort");
  assert.ok(min(e.sonne.aufgang) >= 7 * 60 + 30 && min(e.sonne.aufgang) <= 7 * 60 + 55, "Sonnenaufgang Mitte November ca. 7:45: " + e.sonne.aufgang);
  assert.ok(min(e.sonne.untergang) >= 16 * 60 + 10 && min(e.sonne.untergang) <= 16 * 60 + 35, "Sonnenuntergang ca. 16:23: " + e.sonne.untergang);
  assert.ok(/^8 Std/.test(e.sonne.tageslaenge), "Tageslaenge ca. 8:40: " + e.sonne.tageslaenge);
  assert.ok(e.mond.zunehmend && e.mond.beleuchtung_prozent > 20 && e.mond.beleuchtung_prozent < 45 && /Sichel/.test(e.mond.phase), "Mond: zunehmende Sichel am 15.11.2026: " + JSON.stringify(e.mond));
  assert.ok(/November/.test(e.mond.naechster_vollmond) && /24/.test(e.mond.naechster_vollmond), "naechster Vollmond am 24.11.: " + e.mond.naechster_vollmond);
  assert.ok(e.mond.aufgang && e.mond.untergang, "Mondauf- und -untergang vorhanden");
  e = await W.ausfuehren("sonne_mond", { datum: "2026-06-21" }, { standort: { lat: 53.5, lon: 10.48 } });
  assert.ok(min(e.sonne.untergang) > 21 * 60, "Sommer: Sonne geht nach 21 Uhr unter (deutsche Sommerzeit): " + e.sonne.untergang);
  e = await W.ausfuehren("sonne_mond", { datum: "2026-12-21" }, { standort: { lat: 69.65, lon: 18.96 } });
  assert.ok(e.ok && e.sonne.aufgang === null && e.sonne.polar === "dunkel", "Polarnacht: keine Sonne");
  e = await W.ausfuehren("sonne_mond", { datum: "kaputt" }, { standort: { lat: 53.5, lon: 10.48 } });
  assert.ok(e.ok && /^\d{4}-\d{2}-\d{2}$/.test(e.datum), "ungueltiges Datum -> heute");
  console.log("sonne ok");
})().catch(x => { console.error(x); process.exit(1); });
