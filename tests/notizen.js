"use strict";
process.env.VERCEL_PROJECT_PRODUCTION_URL = "atlas-beispiel.vercel.app"; // Test laeuft als Altbestand-Kopie (Profil des Erfinders)
// Notizen: anlegen, finden, dazuschreiben, loeschen nur nach Bestaetigung (Redis gemockt).
const assert = require("assert");
const store = {};
global.fetch = async (url, o) => { url = String(url); if (url.startsWith("https://db.test")) { const c = JSON.parse(o.body); let result = null; if (c[0] === "HSET") { store[c[2]] = c[3]; result = 1; } else if (c[0] === "HGET") result = store[c[2]] || null; return { json: async () => ({ result }) }; } return { ok: false, status: 404, json: async () => ({}) }; };
process.env.ATLAS_SECRET = "mein-langes-passwort"; process.env.UPSTASH_REDIS_REST_URL = "https://db.test"; process.env.UPSTASH_REDIS_REST_TOKEN = "t";
const W = require("../api/_werkzeuge.js");
const run = a => W.ausfuehren("notiz", a);
(async () => {
  let e = await run({ aktion: "zeigen" }); assert.ok(e.ok && e.notizen.length === 0 && /noch keine/.test(e.hinweis), "leer");
  e = await run({ aktion: "anlegen", text: "" }); assert.ok(!e.ok, "ohne Text fragt nach");
  e = await run({ aktion: "anlegen", titel: "Geschenk", text: "Für Leon ein Lego-Set zum Geburtstag" }); assert.ok(e.ok && e.angelegt.titel === "Geschenk" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(e.angelegt.angelegt));
  e = await run({ aktion: "anlegen", text: "WLAN-Passwort Gästenetz: blau42" }); assert.ok(e.ok && e.gesamt === 2);
  e = await run({ aktion: "zeigen" }); assert.strictEqual(e.notizen.length, 2);
  e = await run({ aktion: "zeigen", suche: "wlan gäste" }); assert.ok(e.ok && e.notizen.length === 1 && /blau42/.test(e.notizen[0].text), "Suche mit mehreren Woertern");
  e = await run({ aktion: "zeigen", suche: "lego" }); assert.strictEqual(e.notizen[0].titel, "Geschenk", "Suche im Text");
  e = await run({ aktion: "zeigen", suche: "unbekannt" }); assert.ok(e.ok && e.notizen.length === 0 && /keine Notiz gefunden/.test(e.hinweis));
  e = await run({ aktion: "anhaengen", suche: "geschenk", text: "und eine Karte" }); assert.ok(e.ok && /Lego-Set zum Geburtstag\nund eine Karte/.test(e.geaendert.text), "dazugeschrieben");
  e = await run({ aktion: "anhaengen", suche: "nirgends", text: "x" }); assert.ok(!e.ok);
  e = await run({ aktion: "anlegen", text: "Lego Katalog" }); e = await run({ aktion: "anhaengen", suche: "lego", text: "x" }); assert.ok(!e.ok && e.mehrdeutig, "zwei passen: nachfragen");
  // Bindestrich, Fuellwoerter: "Lego Set Notiz" findet "Lego-Set"
  e = await run({ aktion: "anlegen", text: "Lego-Set für Leon kaufen" });
  for (const q of ["Lego-Set", "lego set", "Legoset", "Lego Set Notiz", "die Lego-Set Notiz", "Notiz Lego Set löschen"]) { const z = await run({ aktion: "zeigen", suche: q }); assert.ok(z.notizen.some(x => /Lego-Set für Leon kaufen/.test(x.text)), "gefunden mit: " + q + " -> " + JSON.stringify(z).slice(0, 200)); }
  e = await run({ aktion: "loeschen", suche: "Lego-Set Notiz" }); assert.ok(e.mehrdeutig || e.bestaetigung_noetig, "Lego-Set Notiz wird gefunden");
  e = await run({ aktion: "loeschen", suche: "Lego-Set für Leon kaufen" }); assert.ok(e.bestaetigung_noetig && /kaufen/.test(e.notiz.text), "genauer Text trifft genau eine");
  e = await run({ aktion: "loeschen", suche: "Lego-Set für Leon kaufen", bestaetigt: true }); assert.ok(e.ok && /kaufen/.test(e.geloescht.text), "geloescht");
  e = await run({ aktion: "zeigen", suche: "die Notiz" }); assert.ok(e.ok && e.notizen.length === 0, "nur Fuellwoerter finden nichts");
  e = await run({ aktion: "loeschen", suche: "wlan" }); assert.ok(!e.ok && e.bestaetigung_noetig, "fragt erst");
  e = await run({ aktion: "zeigen", anzahl: 8 }); assert.strictEqual(e.notizen.length, 3, "noch nichts geloescht");
  e = await run({ aktion: "loeschen", suche: "wlan", bestaetigt: true }); assert.ok(e.ok && /blau42/.test(e.geloescht.text));
  e = await run({ aktion: "zeigen", anzahl: 8 }); assert.strictEqual(e.notizen.length, 2);
  e = await run({ aktion: "loeschen", suche: "", bestaetigt: true }); assert.ok(!e.ok, "ohne Suche wird nichts geloescht");
  e = await run({ aktion: "loeschen", suche: "lego", bestaetigt: true }); assert.ok(!e.ok && e.mehrdeutig, "mehrdeutig loescht nicht");
  const lang = "x".repeat(5000); e = await run({ aktion: "anlegen", text: lang }); assert.ok(e.ok && e.angelegt.text.length <= 303, "lange Notiz gekuerzt angezeigt");
  console.log("notizen: alle Pruefungen gruen");
})().catch(e => { console.error(e); process.exit(1); });
