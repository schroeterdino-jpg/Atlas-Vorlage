"use strict";
process.env.VERCEL_PROJECT_PRODUCTION_URL = "atlas-beispiel.vercel.app"; // Test laeuft als Altbestand-Kopie (Profil des Erfinders)
// Websuche: Groqs browser_search als eigene Stufe (Groq gemockt).
const assert = require("assert");
process.env.ATLAS_SECRET = "mein-langes-passwort"; process.env.UPSTASH_REDIS_REST_URL = "https://db.test"; process.env.UPSTASH_REDIS_REST_TOKEN = "t";
let anfragen = [], modus = "ok";
global.fetch = async (url, o) => {
  url = String(url);
  if (url.startsWith("https://db.test")) { return { json: async () => ({ result: null }) }; }
  if (url.startsWith("https://api.groq.com")) {
    const b = JSON.parse(o.body); anfragen.push(b);
    if (modus === "fehler") return { ok: false, status: 429, json: async () => ({}) };
    if (modus === "zeit") { const e = new Error("t"); e.name = "TimeoutError"; throw e; }
    const content = modus === "ohne" ? "Seite A 【2†L6-L10】 Text.\n\nDas iPhone kostet ab 1.299 € 【1†L1-L2】." : "Rohtext der Seiten 【2†L6-L10】\nANTWORT:\nLaut apple.com kostet das iPhone 18 Pro ab 1.299 € 【1†L1-L2】.";
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content } }] }) };
  }
  return { ok: false, status: 404, json: async () => ({}) };
};
const K = require("../api/_keys.js"); K.schluesselHolen = async n => n === "groq" ? "gsk_test" : null;
const W = require("../api/_werkzeuge.js");
(async () => {
  let e = await W.ausfuehren("websuche", { frage: "Wie teuer ist das iPhone 18 Pro?" });
  assert.ok(e.ok && e.ergebnis === "Laut apple.com kostet das iPhone 18 Pro ab 1.299 €.", JSON.stringify(e));
  const b = anfragen[0]; assert.deepStrictEqual(b.tools, [{ type: "browser_search" }]); assert.strictEqual(b.tool_choice, "required"); assert.strictEqual(b.model, "openai/gpt-oss-120b");
  assert.ok(/fremder Inhalt/.test(e.hinweis), "Suchtext gilt als fremd");
  modus = "ohne"; e = await W.ausfuehren("websuche", { frage: "x" }); assert.ok(e.ok && /1\.299/.test(e.ergebnis) && !/【/.test(e.ergebnis), "ohne Markierung: letzter Absatz, Zitate entfernt");
  modus = "fehler"; e = await W.ausfuehren("websuche", { frage: "x" }); assert.ok(!e.ok && e.technisch && /429/.test(e.hinweis));
  modus = "zeit"; e = await W.ausfuehren("websuche", { frage: "x" }); assert.ok(!e.ok && /zu lange/.test(e.hinweis));
  e = await W.ausfuehren("websuche", { frage: "  " }); assert.ok(!e.ok && !e.technisch, "leere Frage: nachfragen");
  modus = "ok"; anfragen = []; require("../api/_fahrt.js").ortZuPunkt = async p => ({ ort: "Musterstadt", stadt: "Musterstadt" });
  e = await W.ausfuehren("websuche", { frage: "Notfallapotheke in meinem Umkreis" }, { standort: { lat: 53.5, lon: 10.48 } });
  const u = anfragen[0].messages[1].content; assert.ok(e.ok && /Sam ist gerade in: Musterstadt\./.test(u) && !/53\.5/.test(u), "Ortsname statt Koordinaten: " + u);
  anfragen = []; await W.ausfuehren("websuche", { frage: "Wetter in Rom" }, {}); assert.ok(!/Sam ist gerade/.test(anfragen[0].messages[1].content), "ohne Standort kein Ortszusatz");
  console.log("websuche: alle Pruefungen gruen");
})().catch(e => { console.error(e); process.exit(1); });
assert.ok(/Formular/.test(require("../api/_werkzeuge.js").LISTE ? JSON.stringify(require("../api/_werkzeuge.js").LISTE.filter(w => w.name === "websuche")) : "Formular"), "websuche: Formular-Hinweis");
