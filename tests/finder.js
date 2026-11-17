"use strict";
process.env.VERCEL_PROJECT_PRODUCTION_URL = "atlas-beispiel.vercel.app"; // Test laeuft als Altbestand-Kopie (Profil des Erfinders)
// Termin-Finder: freie Fenster aus Schicht und Kalender, Abstand, Tageszeit, ehrliche Meldung wenn nichts frei ist.
const assert = require("assert");
process.env.ATLAS_SECRET = "mein-langes-passwort";
const Kal = require("../api/_kalender.js"), P = require("../api/_plan.js");
const von = "2031-03-03", ev = (t, b, e) => ({ summary: t, start: { dateTime: b + ":00+01:00" }, end: { dateTime: e + ":00+01:00" } });
let events = [], schicht = true;
Kal.liste = async () => events;
P.tagInfo = async iso => schicht && iso === von ? { art: "Frühschicht", zeiten: { abfahrt: "04:30", ende: "14:37" } } : null;
const { finder } = require("../api/_finder.js");
(async () => {
  let r = await finder({ von, bis: von, dauer_minuten: 60 });
  assert.ok(r.ok && r.tage[0].frei[0].von === "15:10" && r.tage[0].frei[0].bis === "20:00" && r.tage[0].schicht === "Frühschicht", "nach Schicht +30 Min: " + JSON.stringify(r));
  events = [ev("Zahnarzt", von + "T16:00", von + "T17:00")];
  r = await finder({ von, bis: von, dauer_minuten: 60 });
  assert.deepStrictEqual(r.tage[0].frei.map(f => f.von + "-" + f.bis), ["17:10-20:00"], "Abstand 10 Min, zu kurze Luecke (15:10-15:50) faellt weg: " + JSON.stringify(r.tage[0].frei));
  r = await finder({ von, bis: von, dauer_minuten: 30 });
  assert.deepStrictEqual(r.tage[0].frei.map(f => f.von + "-" + f.bis), ["15:10-15:50", "17:10-20:00"], "kurze Dauer: beide Luecken");
  r = await finder({ von, bis: von, dauer_minuten: 60, tageszeit: "vormittag" });
  assert.ok(r.ok && r.anzahl_fenster === 0 && /ehrlich/i.test(r.hinweis), "vormittags Schicht: nichts frei, ehrlich sagen");
  events = [ev("Ganzer Abend", von + "T14:00", von + "T23:00")]; r = await finder({ von, bis: von, dauer_minuten: 120 });
  assert.strictEqual(r.anzahl_fenster, 0, "Abend belegt");
  events = []; schicht = false; r = await finder({ von: "2031-03-04", bis: "2031-03-05", dauer_minuten: 90, tageszeit: "nachmittag" });
  assert.ok(r.tage.length === 2 && r.tage[0].frei[0].von === "12:00" && r.tage[0].frei[0].bis === "17:00" && r.schicht_unbekannt === true, "ohne Schicht ganzes Fenster: " + JSON.stringify(r));
  r = await finder({ von, bis: von, dauer_minuten: 300, tageszeit: "abend" }); assert.ok(!r.ok && /kürzer/.test(r.hinweis), "Fenster zu kurz");
  r = await finder({ von, bis: "2031-06-01" }); assert.strictEqual(r.bis, "2031-03-16", "hoechstens 14 Tage");
  Kal.liste = async () => null; r = await finder({ von }); assert.ok(!r.ok, "Google nicht verbunden: ehrlich melden");
  console.log("finder: alle Pruefungen gruen");
})().catch(e => { console.error(e); process.exit(1); });
