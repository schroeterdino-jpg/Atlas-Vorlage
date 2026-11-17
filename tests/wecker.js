"use strict";
process.env.VERCEL_PROJECT_PRODUCTION_URL = "atlas-beispiel.vercel.app"; // Test laeuft als Altbestand-Kopie (Profil des Erfinders)
// Wecker: stellen (naechste passende Zeit), Einmal/Wiederholung, aus/an, Loeschen nur nach Bestaetigung (Redis gemockt).
const assert = require("assert");
const store = {};
global.fetch = async (url, o) => {
  url = String(url);
  if (url.startsWith("https://db.test")) { const c = JSON.parse(o.body); let result = null; if (c[0] === "HSET") { store[c[2]] = c[3]; result = 1; } else if (c[0] === "HGET") result = store[c[2]] || null; return { json: async () => ({ result }) }; }
  return { ok: false, status: 404, json: async () => ({}) };
};
process.env.ATLAS_SECRET = "mein-langes-passwort"; process.env.UPSTASH_REDIS_REST_URL = "https://db.test"; process.env.UPSTASH_REDIS_REST_TOKEN = "t";
const W = require("../api/_werkzeuge.js");
(async () => {
  const app = { app: true };
  let e = await W.ausfuehren("wecker", { aktion: "liste" }, app); assert.ok(e.ok && e.alle.length === 0 && /kein Wecker/.test(e.hinweis), "leer: ehrlich");
  e = await W.ausfuehren("wecker", { aktion: "stellen" }, app); assert.ok(!e.ok && /Uhrzeit/.test(e.hinweis), "ohne Zeit nachfragen");
  e = await W.ausfuehren("wecker", { aktion: "stellen", zeit: "25:00" }, app); assert.ok(!e.ok, "ungueltige Zeit");
  e = await W.ausfuehren("wecker", { aktion: "stellen", zeit: "3:45", name: "Frühschicht" }, app);
  assert.ok(e.ok && e.alle.length === 1 && e.alle[0].zeit === "03:45" && /^\d{4}-\d{2}-\d{2}$/.test(e.alle[0].datum), "Wecker 3:45 mit Datum: " + JSON.stringify(e)); assert.deepStrictEqual(e.fuerApp, { aktion: "stellen", zeit: "03:45", wdh: "", name: "Frühschicht" }, "Auftrag an die Uhr-App");
  const jetzt = new Date().toLocaleString("sv-SE", { timeZone: "Europe/Berlin" }); assert.ok((e.alle[0].datum + "T03:45") > jetzt.slice(0, 10) + "T" + jetzt.slice(11, 16), "liegt in der Zukunft");
  e = await W.ausfuehren("wecker", { aktion: "stellen", zeit: "3:45", name: "Frühschicht" }, app); assert.ok(e.ok && e.doppelt && e.alle.length === 1 && e.fuerApp && e.fuerApp.aktion === "stellen", "kein Doppelter in der Liste, aber erneut ans Handy");
  e = await W.ausfuehren("wecker", { aktion: "stellen", zeit: "7", wiederholen: "werktags" }, {}); assert.ok(e.ok && e.alle.length === 2 && e.alle[1].wdh === "werktags" && e.alle[1].datum === "" && /nur über die Atlas-App/.test(e.hinweis), "werktags, Hinweis ohne App");
  e = await W.ausfuehren("wecker", { aktion: "stellen", zeit: "6:00", datum: "2020-01-01" }, app); assert.ok(!e.ok && /Vergangenheit/.test(e.hinweis), "Vergangenheit abgelehnt");
  e = await W.ausfuehren("wecker", { aktion: "stellen", zeit: "6:00", datum: "2099-01-01" }, app); assert.ok(!e.ok && /24 Stunden/.test(e.hinweis), "spaeteres Datum ehrlich abgelehnt");
  e = await W.ausfuehren("wecker", { aktion: "aus", zeit: "07:00" }, app); assert.ok(e.fuerApp.aktion === "loeschen" && e.fuerApp.zeit === "07:00" && e.fuerApp.wdh === "werktags", "aus: Uhr-App-Wecker entfernen"); assert.ok(e.ok && e.alle[1].an === false, "ausgeschaltet");
  e = await W.ausfuehren("wecker", { aktion: "an", zeit: "7" }, app); assert.ok(e.ok && e.alle[1].an === true && e.fuerApp.aktion === "stellen", "wieder an");
  e = await W.ausfuehren("wecker", { aktion: "aus" }, app); assert.ok(!e.ok && /Mehrere/.test(e.hinweis), "zwei Wecker: nachfragen");
  e = await W.ausfuehren("wecker", { aktion: "loeschen", zeit: "7" }, app); assert.ok(e.ok && e.rueckfrage && /NICHT gelöscht/.test(e.hinweis), "erst Rueckfrage");
  assert.strictEqual((await W.ausfuehren("wecker", { aktion: "liste" }, app)).alle.length, 2, "noch da");
  e = await W.ausfuehren("wecker", { aktion: "loeschen", zeit: "7", bestaetigt: true }, app); assert.ok(e.ok && e.geloescht && e.alle.length === 1, "geloescht nach Ja");
  store["wecker"] = undefined; store["wecker"] = JSON.stringify([{ id: "alt", zeit: "01:00", datum: "2020-01-01", wdh: "", name: "", an: true }]);
  e = await W.ausfuehren("wecker", { aktion: "liste" }, app); assert.strictEqual(e.alle.length, 0, "abgelaufener Einmal-Wecker wird entfernt");
  e = await W.ausfuehren("wecker", { aktion: "stellen", in_minuten: 2 }, app);
  const in2 = new Date(Date.now() + 120000).toLocaleString("sv-SE", { timeZone: "Europe/Berlin" });
  assert.ok(e.ok && e.fuerApp.zeit.slice(0, 4) === in2.slice(11, 15) || e.fuerApp.zeit === in2.slice(11, 16) || Math.abs(+e.fuerApp.zeit.slice(3) - +in2.slice(14, 16)) <= 1, "in 2 Minuten: Zeit vom Server berechnet: " + JSON.stringify(e.fuerApp));
  assert.ok(/SOFORT/.test(W.LISTE.find(x => x.name === "wecker").beschreibung), "Wecker stellen ohne Rueckfrage");
  // alle Wecker: aus (ohne Rueckfrage), an, loeschen (mit Rueckfrage)
  await W.ausfuehren("wecker", { aktion: "stellen", zeit: "8:15" }, app);
  e = await W.ausfuehren("wecker", { aktion: "aus", alle: true }, app);
  assert.ok(e.ok && e.anzahl === e.alle.length && e.anzahl >= 2 && e.fuerApp.aktion === "mehrere" && e.fuerApp.liste.every(x => x.aktion === "loeschen") && e.alle.every(w => w.an === false) && /ausgeschaltet/.test(e.hinweis) && !/entfern/.test(e.hinweis), "alle aus, ohne Rueckfrage, als 'ausgeschaltet'");
  e = await W.ausfuehren("wecker", { aktion: "an", alle: true }, app); assert.ok(e.ok && e.fuerApp.aktion === "mehrere" && e.fuerApp.liste.every(x => x.aktion === "stellen") && e.alle.every(w => w.an), "alle wieder an");
  e = await W.ausfuehren("wecker", { aktion: "aus" }, app); assert.ok(!e.ok && e.mehrdeutig.length >= 2 && /alle=true/.test(e.hinweis), "ohne alle: nachfragen, mit Hinweis auf alle");
  e = await W.ausfuehren("wecker", { aktion: "loeschen", alle: true }, app); assert.ok(e.ok && e.rueckfrage && e.wecker.length >= 2 && /NICHT gelöscht/.test(e.hinweis), "alle loeschen: erst Rueckfrage");
  e = await W.ausfuehren("wecker", { aktion: "loeschen", alle: true, bestaetigt: true }, app); assert.ok(e.ok && e.alle.length === 0 && e.fuerApp.aktion === "mehrere", "alle geloescht");
  console.log("wecker: alle Pruefungen gruen");
})().catch(e => { console.error(e); process.exit(1); });
