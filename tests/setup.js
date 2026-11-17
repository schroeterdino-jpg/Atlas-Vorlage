"use strict";
process.env.VERCEL_PROJECT_PRODUCTION_URL = "atlas-beispiel.vercel.app"; // Test laeuft als Altbestand-Kopie (Profil des Erfinders)
// Prueft api/setup.js mit einer Schein-Datenbank (kein Netz noetig).
const assert = require("assert");
const store = {};
global.fetch = async (url, o) => {
  if (String(url).startsWith("https://db.test")) {
    const c = JSON.parse(o.body); let result = null;
    if (c[0] === "HSET") { store[c[2]] = c[3]; result = 1; }
    else if (c[0] === "HGET") result = store[c[2]] || null;
    else if (c[0] === "HKEYS") result = Object.keys(store);
    else if (c[0] === "HDEL") { delete store[c[2]]; result = 1; }
    else if (c[0] === "GET") result = store.n ? String(store.n) : null;
    else if (c[0] === "INCR") { store.n = (store.n || 0) + 1; result = store.n; }
    else if (c[0] === "EXPIRE") result = 1;
    return { json: async () => ({ result }) };
  }
  if (String(url).startsWith("https://vektor.test")) {
    const tok = (o && o.headers && o.headers.Authorization || "").replace("Bearer ", ""), pfad = String(url).slice(19);
    if (pfad === "/info") return { ok: true, status: 200 };
    if (tok === "falschertoken1") return { ok: false, status: 401, text: async () => "Unauthorized" };
    if (pfad === "/delete" && tok === "nurlesen1234") return { ok: false, status: 403, text: async () => "Forbidden" };
    return { ok: true, status: 200, json: async () => ({ result: { vectors: [] } }), clone() { return this; } };
  }
  return { ok: true, status: 200 };
};
const h = require("../api/setup.js");
function run(body) { return new Promise(r => { const res = { setHeader() {}, status(c) { this.c = c; return this; }, json(j) { r([this.c, j]); } }; h({ method: "POST", headers: {}, body }, res); }); }
(async () => {
  let [, j] = await run({ aktion: "status", passwort: "x" }); assert.strictEqual(j.schritt, "secret");
  process.env.ATLAS_SECRET = "mein-langes-passwort";
  [, j] = await run({ aktion: "status", passwort: "mein-langes-passwort" }); assert.strictEqual(j.schritt, "datenbank");
  process.env.KV_REST_API_URL = "https://db.test"; process.env.KV_REST_API_TOKEN = "t";
  let c; [c, j] = await run({ aktion: "status", passwort: "falsch" }); assert.strictEqual(c, 401);
  [c, j] = await run({ aktion: "status", passwort: "  mein-langes-passwort " }); assert.strictEqual(c, 200);
  [, j] = await run({ aktion: "speichern", id: "groq", wert: "gsk_testschluessel1234", passwort: "mein-langes-passwort" });
  assert.ok(j.ok && j.test.ok === true && j.letzte === "1234");
  assert.ok(!JSON.stringify(store).includes("gsk_testschluessel"), "Schluessel liegt unverschluesselt in der Datenbank");
  [, j] = await run({ aktion: "status", passwort: "mein-langes-passwort" });
  assert.ok(j.liste.find(k => k.id === "groq").gesetzt && !JSON.stringify(j).includes("gsk_test"));
  [, j] = await run({ aktion: "speichern", id: "gibtsnicht", wert: "xxxxxxxxxxxx", passwort: "mein-langes-passwort" }); assert.strictEqual(j.ok, false);
  [, j] = await run({ aktion: "speichern", id: "vektorurl", wert: "https://vektor.test", passwort: "mein-langes-passwort" }); assert.ok(j.test.ok);
  [, j] = await run({ aktion: "speichern", id: "vektortoken", wert: "nurlesen1234", passwort: "mein-langes-passwort" });
  assert.strictEqual(j.test.ok, false); assert.ok(/Nur-Lesen/.test(j.test.text), "Nur-Lesen-Token wird erkannt");
  [, j] = await run({ aktion: "speichern", id: "vektortoken", wert: "falschertoken1", passwort: "mein-langes-passwort" }); assert.strictEqual(j.test.ok, false);
  [, j] = await run({ aktion: "speichern", id: "vektortoken", wert: 'UPSTASH_VECTOR_REST_URL="https://vektor.test"\nUPSTASH_VECTOR_REST_TOKEN="vollertoken9876"', passwort: "mein-langes-passwort" });
  assert.ok(j.test.ok && j.letzte === "9876", "ganze .env-Zeilen werden zurechtgeschnitten: " + JSON.stringify(j));
  [c, j] = await run({ aktion: "adressen", passwort: "mein-langes-passwort" }); assert.ok(c === 200 && j.ok && /Musterstadt/.test(j.heim) && j.arbeit, "Adressen in der Einrichtung lesbar");
  [c, j] = await run({ aktion: "adresseSetzen", ort: "arbeit", adresse: "Hallo 1" }); assert.strictEqual(c, 401, "Adressen aendern braucht Anmeldung");
  [c, j] = await run({ aktion: "woerter", passwort: "mein-langes-passwort" }); assert.ok(j.ok && /Tal Beispiel Ring = Karl-Beispiel-Ring/.test(j.korrekturen), "Korrekturen mit Startwerten");
  [c, j] = await run({ aktion: "woerterSpeichern", hinweise: "Karl-Beispiel-Ring\nSaskia", korrekturen: "Tal Arnold = Karl-Arnold\nkaputte zeile", passwort: "mein-langes-passwort" }); assert.ok(j.ok && j.anzahl_hinweise === 2 && j.anzahl_korrekturen === 1, "Woerter gespeichert: " + JSON.stringify(j));
  const Wo = require("../api/_woerter.js");
  assert.strictEqual(await Wo.korrigieren("Wohnung am Tal Arnold 2 in Wilhelmsburg"), "Wohnung am Karl-Arnold 2 in Wilhelmsburg", "Korrektur greift");
  assert.strictEqual(await Wo.korrigieren("Das Metal Arnoldsche"), "Das Metal Arnoldsche", "nur ganze Woerter");
  assert.ok(/Karl-Beispiel-Ring/.test(await Wo.prompt()) && /Saskia/.test(await Wo.prompt()) && /Musterstadt/.test(await Wo.prompt()), "Whisper-Vorgabe enthaelt Hinweise und Adressen");
  for (let i = 0; i < 12; i++) await run({ aktion: "status", passwort: "mein-langes-passwort" });
  [c] = await run({ aktion: "status", passwort: "mein-langes-passwort" }); assert.strictEqual(c, 200, "richtige Passwoerter zaehlen nicht als Fehlversuch");
  for (let i = 0; i < 10; i++) await run({ aktion: "status", passwort: "falsch" });
  [c] = await run({ aktion: "status", passwort: "mein-langes-passwort" }); assert.strictEqual(c, 429, "Sperre nach 10 Fehlversuchen");
  console.log("setup: alle Pruefungen gruen");
})().catch(e => { console.error(e); process.exit(1); });
