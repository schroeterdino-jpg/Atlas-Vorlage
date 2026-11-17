"use strict";
process.env.VERCEL_PROJECT_PRODUCTION_URL = "atlas-beispiel.vercel.app"; // Test laeuft als Altbestand-Kopie (Profil des Erfinders)
// Nachrichten auf vier Ebenen (Groq und Geocoding gemockt).
const assert = require("assert");
process.env.ATLAS_SECRET = "mein-langes-passwort"; process.env.UPSTASH_REDIS_REST_URL = "https://db.test"; process.env.UPSTASH_REDIS_REST_TOKEN = "t";
let anfragen = [], modus = "ok", cache = {};
global.fetch = async (url, o) => {
  url = String(url);
  if (url.startsWith("https://db.test")) { const c = JSON.parse(o.body); if (c[0] === "GET") return { json: async () => ({ result: cache[c[1]] || null }) }; if (c[0] === "SET") { cache[c[1]] = c[2]; return { json: async () => ({ result: "OK" }) }; } return { json: async () => ({ result: null }) }; }
  if (url.startsWith("https://maps.googleapis.com")) return { ok: true, status: 200, json: async () => ({ status: "OK", results: [{ geometry: { location: { lat: 53.5, lng: 10.48 } }, formatted_address: "X" }] }) };
  if (url.startsWith("https://www.tagesschau.de/")) return { ok: true, status: 200, text: async () => '<html><head><meta property="og:image" content="https://images.tagesschau.de/bild.jpg?x=1&amp;y=2"></head></html>' };
  if (url.startsWith("https://kaputt.example/")) throw new Error("netz");
  if (url.startsWith("https://api.groq.com")) {
    const b = JSON.parse(o.body); anfragen.push(b);
    if (modus === "fehler") return { ok: false, status: 429, json: async () => ({}) };
    const welt = /aller Welt/.test(b.messages[1].content);
    const content = modus === "leer" ? "Nichts gefunden.\nJSON: []" : "Rohtext 【1†L1】\nJSON: " + JSON.stringify(welt ? [{ titel: "Gipfel beendet", kurz: "Die Staaten einigen sich auf einen Plan.", ort: "Genf, Schweiz", url: "https://www.tagesschau.de/ausland/gipfel.html" }, { titel: "Zweite Meldung", ort: "", url: "https://kaputt.example/a" }, { titel: "Dritte", ort: "", url: "http://127.0.0.1/geheim" }] : [{ titel: "B404 gesperrt", ort: "Musterstadt, Deutschland" }]);
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content } }] }) };
  }
  return { ok: false, status: 404, json: async () => ({}) };
};
const K = require("../api/_keys.js"); K.schluesselHolen = async n => n === "groq" ? "gsk_test" : n === "maps" ? "mk" : null;
const W = require("../api/_werkzeuge.js");
(async () => {
  let e = await W.ausfuehren("nachrichten", {});
  assert.ok(e.ok && anfragen.length === 4, "vier Ebenen, vier Suchen");
  assert.deepStrictEqual(Object.keys(e.ebenen), ["welt", "deutschland", "region", "ort"]);
  assert.strictEqual(e.ebenen.welt.length, 2, "höchstens zwei Meldungen pro Ebene");
  assert.ok(e.ebenen.welt[0].titel === "Gipfel beendet" && isFinite(e.ebenen.welt[0].lat) && e.ebenen.welt[1].lat === undefined, "Ort wird zu Koordinaten, ohne Ort keine");
  assert.strictEqual(e.ebenen.welt[0].kurz, "Die Staaten einigen sich auf einen Plan.", "Kurzfassung kommt mit");
  assert.ok(!/【/.test(JSON.stringify(e)), "keine Zitatmarken");
  assert.strictEqual(e.ebenen.welt[0].bild, "https://images.tagesschau.de/bild.jpg?x=1&y=2", "Vorschaubild aus og:image");
  assert.strictEqual(e.ebenen.welt[0].quelle, "tagesschau.de", "Quelle ohne www");
  assert.ok(e.ebenen.welt[1].bild === undefined && e.ebenen.welt[1].quelle === "kaputt.example", "Bild nicht ladbar: Meldung bleibt");
  assert.ok(!JSON.stringify(e).includes("127.0.0.1") && !JSON.stringify(e).includes("url"), "keine Links an den Client, keine Adressen im Netz");
  assert.ok(anfragen.every(b => b.tools[0].type === "browser_search" && b.model === "openai/gpt-oss-20b"));
  assert.ok(/fremder Inhalt/.test(e.hinweis), "gilt als fremder Inhalt");
  anfragen = []; e = await W.ausfuehren("nachrichten", { ebene: "ort", thema: "Verkehr" });
  assert.ok(e.ok && anfragen.length === 1 && Object.keys(e.ebenen).join() === "ort" && /Thema: Verkehr/.test(anfragen[0].messages[1].content), "eine Ebene mit Thema");
  anfragen = []; e = await W.ausfuehren("nachrichten", { ebene: "ort", thema: "Verkehr" }); assert.ok(e.ok && anfragen.length === 0, "zweite Frage kommt aus dem Zwischenspeicher, keine neue Suche");
  cache = {}; modus = "leer"; e = await W.ausfuehren("nachrichten", {}); assert.ok(e.ok && e.ebenen.welt.length === 0, "nichts gefunden: leere Ebenen, ehrlich");
  modus = "fehler"; e = await W.ausfuehren("nachrichten", {}); assert.ok(!e.ok && e.technisch && /nicht erreichbar/.test(e.hinweis), "Groq-Fehler");
  console.log("nachrichten: alle Pruefungen gruen");
})().catch(e => { console.error(e); process.exit(1); });
