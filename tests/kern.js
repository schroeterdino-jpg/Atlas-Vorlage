"use strict";
process.env.VERCEL_PROJECT_PRODUCTION_URL = "atlas-beispiel.vercel.app"; // Test laeuft als Altbestand-Kopie (Profil des Erfinders)
// Prueft hoeren, denken, sprechen mit Schein-Datenbank und Schein-Diensten (kein Netz noetig).
const assert = require("assert");
const store = {}; const log = [];
let fishErsteAntwort = 402;
global.fetch = async (url, o) => {
  url = String(url);
  if (url.startsWith("https://db.test")) {
    const c = JSON.parse(o.body); let result = null;
    if (c[0] === "HSET") { store[c[2]] = c[3]; result = 1; } else if (c[0] === "HGET") result = store[c[2]] || null;
    else if (c[0] === "GET") result = store.n ? String(store.n) : null; else if (c[0] === "INCR") { store.n = (store.n || 0) + 1; result = store.n; } else if (c[0] === "EXPIRE") result = 1;
    return { json: async () => ({ result }) };
  }
  log.push({ url, o });
  if (url.includes("audio/transcriptions")) {
    const fd = o.body, lang = fd.get("language");
    if (global.__daenisch && !lang) return { ok: true, status: 200, json: async () => ({ text: "Hvad sker der", language: "danish", segments: [{ avg_logprob: -0.9 }] }) };
    if (global.__daenisch && lang === "de") return { ok: true, status: 200, json: async () => ({ text: "Wie geht es dir?", language: "german", segments: [{ avg_logprob: -0.2 }] }) };
    return { ok: true, status: 200, json: async () => ({ text: " Wie spät ist es? ", language: "german", segments: [{ avg_logprob: -0.1 }] }) };
  }
  if (url.includes("chat/completions")) return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: "[de] Es ist kurz nach acht." } }] }) };
  if (url.includes("fish.audio")) { const m = o.headers.model; if (m === "s2.1-pro-free" && fishErsteAntwort) return { ok: false, status: fishErsteAntwort }; return { ok: true, status: 200, arrayBuffer: async () => Buffer.from("MP3DATEN") }; }
  return { ok: false, status: 404 };
};
process.env.ATLAS_SECRET = "mein-langes-passwort"; process.env.KV_REST_API_URL = "https://db.test"; process.env.KV_REST_API_TOKEN = "t";
const K = require("../api/_keys.js"); const hoeren = require("../api/hoeren.js"), denken = require("../api/denken.js"), sprechen = require("../api/sprechen.js");
function run(h, body) { return new Promise(r => { const res = { setHeader() {}, status(c) { this.c = c; return this; }, json(j) { r([this.c, j]); }, send(b) { r([this.c, b]); } }; h({ method: "POST", headers: {}, body }, res); }); }
(async () => {
  const pw = "mein-langes-passwort";
  let [c, j] = await run(denken, { pw: "falsch", text: "hi" }); assert.strictEqual(c, 401, "ohne Passwort darf nichts laufen");
  [c, j] = await run(denken, { pw, text: "hi" }); assert.strictEqual(j.ok, false); assert.ok(/Groq/.test(j.fehler), "fehlender Schluessel wird klar gemeldet");
  await K.schluesselSpeichern("groq", "gsk_test"); await K.schluesselSpeichern("fish", "fk_test"); await K.schluesselSpeichern("fishvoice", "stimme123");
  [, j] = await run(hoeren, { pw, audio: Buffer.alloc(2000, 1).toString("base64"), mime: "audio/webm;codecs=opus" });
  assert.deepStrictEqual([j.ok, j.text, j.sprache], [true, "Wie spät ist es?", "german"]);
  const wlog = log.filter(l => l.url.includes("audio/transcriptions")).pop(); assert.ok(/Leon/.test(wlog.o.body.get("prompt")) && /Finny/.test(wlog.o.body.get("prompt")), "Familiennamen stehen im Erkennungs-Hinweis");
  global.__daenisch = true;
  [, j] = await run(hoeren, { pw, audio: Buffer.alloc(2000, 1).toString("base64"), mime: "audio/webm" });
  assert.deepStrictEqual([j.text, j.sprache], ["Wie geht es dir?", "german"], "unsichere Fremdsprache wird als Deutsch nachgelesen");
  global.__daenisch = false;
  [, j] = await run(hoeren, { pw, audio: Buffer.alloc(100).toString("base64") }); assert.strictEqual(j.text, "", "zu kurze Aufnahme wird nicht gesendet");
  [, j] = await run(denken, { pw, text: "Wie spät ist es?", verlauf: [{ rolle: "du", text: "Hallo" }, { rolle: "atlas", text: "Hi Sam" }], sprache: "german" });
  assert.deepStrictEqual([j.ok, j.antwort, j.sprache], [true, "Es ist kurz nach acht.", "de"], "Sprachcode wird abgeschnitten und gemeldet");
  const chat = JSON.parse(log.filter(l => l.url.includes("chat/completions")).pop().o.body);
  assert.deepStrictEqual(chat.messages.map(m => m.role), ["system", "user", "assistant", "user"]);
  assert.ok(/jeder Sprache/.test(chat.messages[0].content) && /german/.test(chat.messages[0].content));
  assert.strictEqual(chat.messages[3].content, "Wie spät ist es?", "Satz geht unveraendert an die KI");
  [c, j] = await run(sprechen, { pw, text: "Es ist kurz nach acht." }); assert.strictEqual(c, 200); assert.strictEqual(String(j), "MP3DATEN");
  const fish = log.filter(l => l.url.includes("fish.audio")); assert.strictEqual(fish[1].o.headers.model, "s2-pro", "Ausweichmodell bei 402");
  assert.strictEqual(JSON.parse(fish[0].o.body).reference_id, "stimme123"); assert.strictEqual(JSON.parse(fish[0].o.body).latency, "balanced", "schnellerer Modus");
  [c, j] = await run(sprechen, { pw, text: "" }); assert.strictEqual(c, 400);
  console.log("kern: alle Pruefungen gruen");
})().catch(e => { console.error(e); process.exit(1); });
