"use strict";
process.env.VERCEL_PROJECT_PRODUCTION_URL = "atlas-beispiel.vercel.app"; // Test laeuft als Altbestand-Kopie (Profil des Erfinders)
const assert = require("assert"), W = require("../api/_werkzeuge.js");
(async () => {
  let e = await W.ausfuehren("spotify", { aktion: "pause" }, { app: false }); assert.ok(!e.ok && /nur in der Atlas-App/.test(e.hinweis));
  e = await W.ausfuehren("spotify", { aktion: "abspielen", suche: "Queen", art: "kuenstler" }, { app: true });
  assert.ok(e.ok); assert.deepStrictEqual(e.fuerApp, { aktion: "abspielen", suche: "Queen", art: "kuenstler" });
  e = await W.ausfuehren("spotify", { aktion: "abspielen" }, { app: true }); assert.ok(!e.ok && !e.fuerApp, "ohne Suche nachfragen");
  for (const a of ["pause", "weiter", "naechstes", "vorheriges", "lauter", "leiser"]) { e = await W.ausfuehren("spotify", { aktion: a }, { app: true }); assert.deepStrictEqual(e.fuerApp, { aktion: a }); }
  e = await W.ausfuehren("spotify", { suche: "Fitness" }, { app: true }); assert.strictEqual(e.fuerApp.aktion, "abspielen", "Suche ohne Aktion = abspielen");
  console.log("spotify: alle Pruefungen gruen");
})().catch(x => { console.error(x); process.exit(1); });
