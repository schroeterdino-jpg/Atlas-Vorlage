"use strict";
// Prueft den Profil-Speicher: fremde Kopie startet leer, Altbestand bekommt das Profil des Erfinders, Namen werden eingesetzt.
const assert = require("assert");
process.env.KV_REST_API_URL = "https://db.test"; process.env.KV_REST_API_TOKEN = "t"; process.env.ATLAS_SECRET = "geheim-geheim-geheim";
const store = {};
global.fetch = async (url, o) => {
  const c = JSON.parse(o.body); let result = null;
  if (c[0] === "GET") result = store[c[1]] || null; else if (c[0] === "SET") { store[c[1]] = c[2]; result = "OK"; }
  return { json: async () => ({ result }) };
};
(async () => {
  delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
  let P = require("../api/_profil.js");
  let p = await P.laden();
  assert.strictEqual(p.name, ""); assert.strictEqual(p.heim, ""); assert.strictEqual(p.eingerichtet, false, "fremde Kopie startet leer");
  p = await P.speichern({ name: 'Anna "x"', ort: "Kiel", heim: "Hafenstr. 1, 24103 Kiel", lat: "54.32", lon: 10.13, woerter: ["Tom", ""] });
  assert.strictEqual(p.name, "Anna x"); assert.strictEqual(p.lat, 54.32); assert.deepStrictEqual(p.woerter, ["Tom"]);
  assert.strictEqual(P.ersetze("Sam hat Sams Handy", p), "Anna x hat Anna x' Handy", "Name wird eingesetzt");
  assert.strictEqual(P.ersetze("Sam", { name: "" }), "der Nutzer");
  assert.strictEqual(P.ersetze("Sam", { name: "Sam" }), "Sam");
  // Altbestand
  for (const k of Object.keys(store)) delete store[k]; P.vergessen();
  process.env.VERCEL_PROJECT_PRODUCTION_URL = "atlas-beispiel.vercel.app";
  p = await P.laden(); assert.strictEqual(p.name, "Sam"); assert.ok(/Musterstadt/.test(p.heim)); assert.ok(store["atlas:profil"], "Altbestand wird einmal gespeichert");
  // API
  const api = require("../api/profil.js");
  const run = body => new Promise(r => { const res = { setHeader() {}, status() { return this; }, json: j => r(j) }; api({ method: "POST", headers: {}, body }, res); });
  const j = await run({ pw: "geheim-geheim-geheim", aktion: "lesen" }); assert.strictEqual(j.ok, true); assert.strictEqual(j.profil.name, "Sam");
  let k = await run({ pw: "geheim-geheim-geheim", aktion: "speichern", profil: { name: "Anna", ort: "Kiel" } });
  assert.strictEqual(k.ok, true); assert.strictEqual(k.profil.name, "Anna");
  P.vergessen(); store["atlas:profil"] = JSON.stringify(Object.assign(JSON.parse(store["atlas:profil"]), { eingerichtet: false }));
  k = await run({ pw: "geheim-geheim-geheim", aktion: "speichern", profil: { name: "Anna" } }); assert.strictEqual(k.profil.eingerichtet, false, "ohne fertig bleibt es offen");
  k = await run({ pw: "geheim-geheim-geheim", aktion: "speichern", fertig: true, profil: { name: "Anna" } }); assert.strictEqual(k.profil.eingerichtet, true, "mit fertig ist es eingerichtet");
  console.log("profil: alle Pruefungen gruen");
})().catch(e => { console.error(e); process.exit(1); });
