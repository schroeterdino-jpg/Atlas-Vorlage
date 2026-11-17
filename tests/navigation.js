"use strict";
process.env.VERCEL_PROJECT_PRODUCTION_URL = "atlas-beispiel.vercel.app"; // Test laeuft als Altbestand-Kopie (Profil des Erfinders)
// Navigation: Ziel-Aufloesung und Google-Maps-Link
const assert = require("assert");
const N = require("../api/_navigation.js");
(async () => {
  const h = await N.navigation({ ziel: "nach Hause" }, {});
  assert(h.ok && /Muster/.test(h.adresse) && h.fuerApp.aktion === "navigation" && /travelmode=driving/.test(h.fuerApp.url), "heim");
  const w = await N.navigation({ ziel: "zur Arbeit" }, {});
  assert(w.ok && /Beispiel/.test(w.adresse), "arbeit");
  const b = await N.navigation({ ziel: "Hamburg Hauptbahnhof", modus: "oepnv" }, {});
  assert(b.ok && b.fuerApp.modus === "oepnv" && /Hamburg%20Hauptbahnhof/.test(b.fuerApp.url) && /transit/.test(b.fuerApp.url), "freitext");
  const l = await N.navigation({ ziel: "  " }, {}); assert(!l.ok, "leer");
  console.log("navigation: alle Pruefungen gruen");
})().catch(e => { console.error(e); process.exit(1); });
