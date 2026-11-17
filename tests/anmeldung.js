"use strict";
process.env.VERCEL_PROJECT_PRODUCTION_URL = "atlas-beispiel.vercel.app"; // Test laeuft als Altbestand-Kopie (Profil des Erfinders)
// Prueft die Dauer-Anmeldung per Cookie (kein Netz noetig).
const assert = require("assert");
const kv = {}, hs = {};
global.fetch = async (url, o) => {
  if (String(url).startsWith("https://db.test")) {
    const c = JSON.parse(o.body); let result = null;
    if (c[0] === "HSET") { hs[c[2]] = c[3]; result = 1; } else if (c[0] === "HGET") result = hs[c[2]] || null; else if (c[0] === "HKEYS") result = Object.keys(hs);
    else if (c[0] === "GET") result = kv[c[1]] || null; else if (c[0] === "INCR") { kv[c[1]] = (Number(kv[c[1]]) || 0) + 1; result = kv[c[1]]; } else if (c[0] === "EXPIRE") result = 1;
    return { json: async () => ({ result }) };
  }
  if (String(url).includes("chat/completions")) return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: "[de] Hallo." } }] }) };
  return { ok: false, status: 404 };
};
process.env.ATLAS_SECRET = "mein-langes-passwort"; process.env.KV_REST_API_URL = "https://db.test"; process.env.KV_REST_API_TOKEN = "t";
const K = require("../api/_keys.js"), anm = require("../api/anmelden.js"), denken = require("../api/denken.js"), setup = require("../api/setup.js");
function run(h, body, cookie, ip, token) { return new Promise(r => { const hd = {}; const res = { setHeader(k, v) { hd[k] = v; }, status(c) { this.c = c; return this; }, json(j) { r([this.c, j, hd]); } }; h({ method: "POST", headers: { cookie: cookie || "", "x-forwarded-for": ip || "1.1.1.1", "x-atlas-s": token || "" }, body }, res); }); }
(async () => {
  await K.schluesselSpeichern("groq", "gsk_test");
  let [c, j, h] = await run(denken, { text: "hi" }); assert.strictEqual(c, 401, "ohne Passwort und Cookie geht nichts");
  assert.ok(!kv["atlas:try:1.1.1.1"], "leerer Erstversuch zaehlt nicht als Fehlversuch");
  [c, j, h] = await run(anm, { pw: "falsch" }); assert.strictEqual(c, 401); assert.ok(!h["Set-Cookie"]); assert.strictEqual(kv["atlas:try:1.1.1.1"], 1, "falsches Passwort zaehlt");
  [c, j, h] = await run(anm, { pw: "mein-langes-passwort" }); assert.ok(c === 200 && j.ok);
  const ck = h["Set-Cookie"]; assert.ok(/HttpOnly/.test(ck) && /Secure/.test(ck) && /SameSite=Strict/.test(ck) && /Max-Age=15552000/.test(ck), "Cookie ist gesichert: " + ck);
  const cookie = ck.split(";")[0]; assert.strictEqual(j.token, cookie.split("=")[1], "Login liefert denselben Token");
  [c, j] = await run(denken, { text: "hi" }, cookie); assert.ok(c === 200 && j.ok && j.antwort === "Hallo.", "mit Cookie ohne Passwort");
  [c, j] = await run(setup, { aktion: "status" }, cookie); assert.ok(c === 200 && j.ok, "Einrichtung mit Cookie");
  // zweiter Weg: Token im Header (wenn der Browser Cookies wegwirft)
  const tok = cookie.split("=")[1]; assert.ok(/^\d+\.[a-f0-9]{64}$/.test(tok), "Token im Cookie-Format");
  [c, j] = await run(denken, { text: "hi" }, "", "1.1.1.1", tok); assert.ok(c === 200 && j.ok, "Token im Header reicht");
  [c, j] = await run(setup, { aktion: "status" }, "", "1.1.1.1", tok); assert.ok(c === 200 && j.ok, "Einrichtung mit Token");
  [c] = await run(denken, { text: "hi" }, "", "1.1.1.1", tok.replace(/.$/, x => x === "a" ? "b" : "a")); assert.strictEqual(c, 401, "veraenderter Token wird abgelehnt");
  [c] = await run(denken, { text: "hi" }, "", "1.1.1.1", (Date.now() + 9e12) + "." + tok.split(".")[1]); assert.strictEqual(c, 401, "gefaelschte Ablaufzeit im Token");
  const kaputt = cookie.replace(/.$/, x => x === "a" ? "b" : "a"); [c] = await run(denken, { text: "hi" }, kaputt); assert.strictEqual(c, 401, "veraenderter Cookie wird abgelehnt");
  const exp = Date.now() - 1000; const alt = "atlas_s=" + exp + "." + cookie.split(".")[1]; [c] = await run(denken, { text: "hi" }, alt); assert.strictEqual(c, 401, "abgelaufen / Ablaufzeit gefaelscht");
  const spaeter = "atlas_s=" + (Date.now() + 9e12) + "." + cookie.split(".")[1]; [c] = await run(denken, { text: "hi" }, spaeter); assert.strictEqual(c, 401, "verlaengerte Ablaufzeit passt nicht zur Signatur");
  process.env.ATLAS_SECRET = "ein-ganz-anderes-passwort"; [c] = await run(denken, { text: "hi" }, cookie); assert.strictEqual(c, 401, "neues Passwort macht alle Cookies ungueltig"); process.env.ATLAS_SECRET = "mein-langes-passwort";
  [c, j, h] = await run(anm, { abmelden: true }); assert.ok(/Max-Age=0/.test(h["Set-Cookie"]));
  for (let i = 0; i < 10; i++) await run(anm, { pw: "falsch" }, "", "9.9.9.9"); [c] = await run(anm, { pw: "mein-langes-passwort" }, "", "9.9.9.9"); assert.strictEqual(c, 429, "Sperre gilt auch beim Anmelden");
  console.log("anmeldung: alle Pruefungen gruen");
})().catch(e => { console.error(e); process.exit(1); });
