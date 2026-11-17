"use strict";
process.env.VERCEL_PROJECT_PRODUCTION_URL = "atlas-beispiel.vercel.app"; // Test laeuft als Altbestand-Kopie (Profil des Erfinders)
// Listen-Kacheln: Abhaken per Antippen, Artikel hinzufuegen, Mitnehmen getrennt (Redis gemockt).
const assert = require("assert");
const store = {};
global.fetch = async (url, o) => { url = String(url); if (url.startsWith("https://db.test")) { const c = JSON.parse(o.body); let result = null; if (c[0] === "HSET") { store[c[2]] = c[3]; result = 1; } else if (c[0] === "HGET") result = store[c[2]] || null; return { json: async () => ({ result }) }; } return { ok: false, status: 404, json: async () => ({}) }; };
process.env.ATLAS_SECRET = "mein-langes-passwort"; process.env.UPSTASH_REDIS_REST_URL = "https://db.test"; process.env.UPSTASH_REDIS_REST_TOKEN = "t";
const T = require("../api/_tor.js"); T.tor = async (req) => req.body;
const start = require("../api/start.js");
const res = () => { const r = { code: 200, body: null }; r.status = c => { r.code = c; return r; }; r.json = b => { r.body = b; return r; }; r.setHeader = () => {}; return r; };
const post = async body => { const r = res(); await start({ method: "POST", body }, r); return r; };
(async () => {
  let r = await post({ aktion: "hinzu", liste: "einkauf", text: "Milch" }); assert.ok(r.body.ok && r.body.daten.offen === 1);
  r = await post({ aktion: "hinzu", liste: "einkauf", text: "Brot" }); assert.strictEqual(r.body.daten.offen, 2);
  await post({ aktion: "hinzu", liste: "mitnehmen", text: "Ausweis" });
  const id = r.body.daten.eintraege[0].id;
  r = await post({ aktion: "umschalten", liste: "einkauf", id, erledigt: true });
  assert.deepStrictEqual(r.body.daten.eintraege.map(x => [x.text, x.erledigt]), [["Brot", false], ["Milch", true]], "offene zuerst, abgehakte danach");
  assert.strictEqual(r.body.daten.offen, 1);
  r = await post({ aktion: "umschalten", liste: "einkauf", id, erledigt: false }); assert.strictEqual(r.body.daten.offen, 2, "Haken laesst sich zuruecknehmen");
  r = await post({ aktion: "hinzu", liste: "einkauf", text: "   " }); assert.strictEqual(r.code, 400, "leerer Text wird abgelehnt");
  r = await post({ aktion: "umschalten", liste: "einkauf", id: 5 }); assert.strictEqual(r.code, 400, "falsche id wird abgelehnt");
  r = await post({ aktion: "loeschen", liste: "einkauf" }); assert.strictEqual(r.code, 400, "keine anderen Aktionen ueber die Kachel");
  r = await post({ aktion: "umschalten", liste: "einkauf", id: "gibtsnicht", erledigt: true }); assert.ok(r.body.ok && r.body.daten.offen === 2, "unbekannte id aendert nichts");
  r = await post({ aktion: "umschalten", liste: "einkauf", id, erledigt: true }); assert.strictEqual(r.body.daten.erledigt, 1);
  r = await post({ aktion: "aufraeumen", liste: "einkauf" }); assert.deepStrictEqual(r.body.daten.eintraege.map(x => x.text), ["Brot"], "nur Abgehakte werden entfernt, Offene bleiben");
  await post({ aktion: "hinzu", liste: "einkauf", text: "Milch" });
  assert.strictEqual(JSON.parse(store["einkauf"]).length, 2, "Mitnehmen landet nicht im Einkauf");
  r = await post({ standort: null }); assert.ok(r.body.einkauf.eintraege.length === 2 && r.body.mitnehmen.eintraege[0].text === "Ausweis", "Startdaten enthalten beide Listen");
  console.log("listenkachel: alle Pruefungen gruen");
})().catch(e => { console.error(e); process.exit(1); });
