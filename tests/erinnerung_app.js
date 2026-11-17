"use strict";
process.env.VERCEL_PROJECT_PRODUCTION_URL = "atlas-beispiel.vercel.app"; // Test laeuft als Altbestand-Kopie (Profil des Erfinders)
// Erinnerungen: Liste fuer die Android-App (Benachrichtigung bei geschlossener App), Redis gemockt.
const assert = require("assert");
const store = {};
global.fetch = async (url, o) => {
  url = String(url);
  if (url.startsWith("https://db.test")) { const c = JSON.parse(o.body); let result = null; if (c[0] === "HSET") { store[c[2]] = c[3]; result = 1; } else if (c[0] === "HGET") result = store[c[2]] || null; return { json: async () => ({ result }) }; }
  return { ok: false, status: 404, json: async () => ({}) };
};
process.env.ATLAS_SECRET = "mein-langes-passwort"; process.env.UPSTASH_REDIS_REST_URL = "https://db.test"; process.env.UPSTASH_REDIS_REST_TOKEN = "t";
const W = require("../api/_werkzeuge.js"), L = require("../api/_listen.js");
(async () => {
  let e = await W.ausfuehren("erinnerung", { aktion: "anlegen", text: "Tabletten nehmen", zeit: "2099-01-01T07:30" });
  assert.ok(e.ok && e.fuerApp.aktion === "erinnerungen" && e.fuerApp.liste.length === 1 && e.fuerApp.liste[0].zeit === "2099-01-01T07:30" && e.fuerApp.liste[0].text === "Tabletten nehmen" && /Benachrichtigung/.test(e.hinweis), "anlegen: Liste an die App");
  e = await W.ausfuehren("erinnerung", { aktion: "anlegen", text: "Müll raus", zeit: "2099-01-01T06:00" });
  assert.deepStrictEqual(e.fuerApp.liste.map(x => x.text), ["Müll raus", "Tabletten nehmen"], "nach Zeit sortiert");
  assert.strictEqual((await L.appListe()).liste.length, 2, "Startliste fuer die App");
  e = await W.ausfuehren("erinnerung", { aktion: "erledigt", text: "Müll" }); assert.ok(e.ok && e.fuerApp.liste.length === 1, "erledigt: nicht mehr in der Liste");
  e = await W.ausfuehren("erinnerung", { aktion: "loeschen", text: "Tabletten" }); assert.ok(!e.ok && e.bestaetigung_noetig, "Loeschen fragt weiter nach");
  e = await W.ausfuehren("erinnerung", { aktion: "loeschen", text: "Tabletten", bestaetigt: true }); assert.ok(e.ok && e.fuerApp.liste.length === 0, "geloescht: Liste leer");
  // Sams Fall: zwei gleiche Erinnerungen (10:00 und 10:06), eine davon loeschen
  await W.ausfuehren("erinnerung", { aktion: "anlegen", text: "Wäsche rausholen", zeit: "2099-02-01T10:00" });
  await W.ausfuehren("erinnerung", { aktion: "anlegen", text: "Wäsche rausholen", zeit: "2099-02-01T10:06" });
  e = await W.ausfuehren("erinnerung", { aktion: "loeschen", text: "Wäsche rausholen" });
  assert.ok(!e.ok && e.mehrdeutig.length === 2 && e.mehrdeutig[0].id && e.mehrdeutig[0].zeit && /id/.test(e.hinweis), "zwei gleiche: Rueckfrage mit id und Zeit");
  e = await W.ausfuehren("erinnerung", { aktion: "loeschen", text: "Wäsche rausholen um 10:06 Uhr" });
  assert.ok(!e.ok && e.bestaetigung_noetig && e.kandidaten.length === 1 && e.kandidaten[0].zeit.endsWith("10:06"), "Uhrzeit im Text waehlt die richtige");
  e = await W.ausfuehren("erinnerung", { aktion: "loeschen", text: "Wäsche", zeit: "10:06", bestaetigt: true });
  assert.ok(e.ok && e.anzahl === 1 && e.fuerApp.liste.length === 1 && e.fuerApp.liste[0].zeit.endsWith("10:00"), "nur 10:06 geloescht, 10:00 bleibt");
  await W.ausfuehren("erinnerung", { aktion: "anlegen", text: "Wäsche aufhängen", zeit: "2099-02-01T11:00" });
  e = await W.ausfuehren("erinnerung", { aktion: "loeschen", text: "Wäsche" }); assert.ok(!e.ok && e.mehrdeutig.length === 2, "ohne alle: nachfragen");
  e = await W.ausfuehren("erinnerung", { aktion: "loeschen", text: "Wäsche", alle: true }); assert.ok(!e.ok && e.bestaetigung_noetig && e.kandidaten.length === 2, "alle: erst bestaetigen lassen");
  e = await W.ausfuehren("erinnerung", { aktion: "loeschen", text: "Wäsche", alle: true, bestaetigt: true }); assert.ok(e.ok && e.anzahl === 2 && e.fuerApp.liste.length === 0, "alle mit Wäsche geloescht");
  console.log("erinnerung_app: alle Pruefungen gruen");
})().catch(e => { console.error(e); process.exit(1); });
