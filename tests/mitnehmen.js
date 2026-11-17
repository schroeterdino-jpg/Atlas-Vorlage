"use strict";
process.env.VERCEL_PROJECT_PRODUCTION_URL = "atlas-beispiel.vercel.app"; // Test laeuft als Altbestand-Kopie (Profil des Erfinders)
// Mitnehmen-Liste: eigene Liste, getrennt vom Einkauf (Redis gemockt).
const assert = require("assert");
const store = {};
global.fetch = async (url, o) => { url = String(url); if (url.startsWith("https://db.test")) { const c = JSON.parse(o.body); let result = null; if (c[0] === "HSET") { store[c[2]] = c[3]; result = 1; } else if (c[0] === "HGET") result = store[c[2]] || null; return { json: async () => ({ result }) }; } return { ok: false, status: 404, json: async () => ({}) }; };
process.env.ATLAS_SECRET = "mein-langes-passwort"; process.env.UPSTASH_REDIS_REST_URL = "https://db.test"; process.env.UPSTASH_REDIS_REST_TOKEN = "t";
const W = require("../api/_werkzeuge.js");
(async () => {
  let e = await W.ausfuehren("mitnehmen", { aktion: "hinzufuegen", eintraege: ["Ausweis", "Brotdose"] }); assert.ok(e.ok && e.hinzugefuegt.length === 2);
  e = await W.ausfuehren("einkauf", { aktion: "hinzufuegen", eintraege: ["Milch"] }); assert.ok(e.ok);
  e = await W.ausfuehren("mitnehmen", { aktion: "zeigen" }); assert.deepStrictEqual(e.offen.map(x => x.text), ["Ausweis", "Brotdose"], "Mitnehmen und Einkauf sind getrennt");
  e = await W.ausfuehren("einkauf", { aktion: "zeigen" }); assert.deepStrictEqual(e.offen.map(x => x.text), ["Milch"]);
  e = await W.ausfuehren("mitnehmen", { aktion: "abhaken", eintraege: ["ausweis"] }); assert.ok(e.ok && e.erledigt.length === 1);
  e = await W.ausfuehren("mitnehmen", { aktion: "leeren" }); assert.ok(!e.ok && e.bestaetigung_noetig, "Leeren nur nach Bestaetigung");
  e = await W.ausfuehren("mitnehmen", { aktion: "leeren", bestaetigt: true }); assert.ok(e.ok);
  console.log("mitnehmen: alle Pruefungen gruen");
})().catch(e => { console.error(e); process.exit(1); });
