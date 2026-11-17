"use strict";
process.env.VERCEL_PROJECT_PRODUCTION_URL = "atlas-beispiel.vercel.app"; // Test laeuft als Altbestand-Kopie (Profil des Erfinders)
// "Was steht an": fuehrt Schicht, Termine, Wetter, Aufgaben, Erinnerungen, Geburtstage, Feiertage zusammen; Teilausfaelle werden ehrlich gemeldet.
const assert = require("assert");
process.env.ATLAS_SECRET = "mein-langes-passwort";
const Kal = require("../api/_kalender.js"), P = require("../api/_plan.js"), Wx = require("../api/_wetter.js"), L = require("../api/_listen.js"), Ge = require("../api/_geburtstage.js"), Fe = require("../api/_feiertage.js");
const h = Kal.heute(), m = Kal.plusTage(h, 1);
let aus = {};
P.tagInfo = async (iso) => aus.schicht === null ? null : { art: "Spätschicht", zeiten: { abfahrt: "12:45", ankunft: "13:25", beginn: "13:45", ende: "22:12" } };
Kal.termine = async (a) => { if (aus.kalender) throw new Error("kaputt"); return { ok: true, termine: [{ titel: "Zahnarzt", beginn: a.von + "T23:30", ende: Kal.plusTage(a.von, 1) + "T00:10", ganztag: false }, { titel: "Vorbei", beginn: a.von + "T00:00", ende: a.von + "T00:05", ganztag: false }, { titel: "Feier", beginn: a.von, ende: a.von, ganztag: true }] }; };
Wx.wetter = async () => ({ ok: true, aktuell: { temperatur: 6, wetter: "bewölkt" }, tage: [{ max: 8, min: 3 }, { max: 9, min: 4, wetter: "Regen" }], empfehlung: { schirm: true, regen_ab: h + "T15:00" }, warnungen: [] });
L.liste = async () => ({ ok: true, offen: [{ text: "Reifen wechseln" }, { text: "Steuer", faellig: Kal.plusTage(h, 20) }, { text: "Anruf Bank", faellig: h }] });
L.erinnerung = async () => ({ ok: true, offen: [{ text: "Mama anrufen", zeit: h + "T18:00" }, { text: "Später", zeit: Kal.plusTage(h, 3) + "T09:00" }] });
Ge.geburtstag = async () => ({ ok: true, geburtstage: [{ name: "Finny", datum: "x", in_tagen: 2 }, { name: "Leon", datum: "y", in_tagen: 30 }] });
Fe.feiertage = async (a) => ({ ok: true, eintraege: [{ art: "Feiertag", name: "Karfreitag", datum: Kal.plusTage(h, 2), text: "x", in_tagen: 2 }] });
const U = require("../api/_ueberblick.js");
(async () => {
  let e = await U.ueberblick({});
  assert.ok(e.ok && e.tag === "heute" && e.schicht.abfahrt === "12:45" && e.wetter.schirm === true && e.wetter.regen_ab === "15:00", JSON.stringify(e).slice(0, 300));
  assert.deepStrictEqual(e.termine.map(t => t.titel), ["Zahnarzt", "Feier"], "vorbei zaehlt heute nicht");
  assert.deepStrictEqual(e.aufgaben, ["Reifen wechseln", "Anruf Bank (fällig " + h.slice(5).split("-").reverse().join(".") + ")"], "heute faellige und ohne Datum, nicht spaeter faellige");
  assert.strictEqual(e.aufgaben_gesamt_offen, 3);
  assert.deepStrictEqual(e.erinnerungen.map(x => x.text), ["Mama anrufen"], "spaetere Erinnerungen nicht");
  assert.deepStrictEqual(e.geburtstage.map(g => g.name), ["Finny"], "nur in den naechsten 3 Tagen");
  assert.ok(/Karfreitag/.test(e.bald_feiertag) && !e.fehlt && /nichts erfinden/.test(e.hinweis), "Feiertag bald, nichts fehlt");
  // Uhrzeit beachten (Fruehschicht-Fall: 09:19 und schon auf der Arbeit)
  const stand = async j => (await U.ueberblick({ jetzt: j })).schicht;
  let sc = await stand("03:50"); assert.ok(sc.stand === "noch_nicht_losgefahren" && sc.abfahrt === "12:45", "vor Abfahrt: " + JSON.stringify(sc));
  sc = await stand("13:00"); assert.ok(sc.stand === "unterwegs_oder_vor_arbeitsbeginn" && !sc.abfahrt && sc.beginn === "13:45", "nach Abfahrt: keine Abfahrt mehr: " + JSON.stringify(sc));
  sc = await stand("16:20"); assert.ok(sc.stand === "auf_der_arbeit" && !sc.abfahrt && !sc.ankunft && !sc.beginn && sc.ende === "22:12" && sc.noch_bis_ende_min === 352, "auf der Arbeit: nur Ende und Restzeit: " + JSON.stringify(sc));
  sc = await stand("22:30"); assert.ok(sc.stand === "schicht_vorbei" && !sc.ende && !sc.abfahrt, "Feierabend: " + JSON.stringify(sc));
  e = await U.ueberblick({ jetzt: "16:20" }); assert.ok(/auf_der_arbeit/.test(e.hinweis), "Hinweis fuer die Uhrzeit");
  e = await U.ueberblick({ jetzt: "16:20", datum: m }); assert.ok(e.schicht.abfahrt === "12:45" && !e.schicht.stand, "morgen: ganz normal mit Abfahrt");
  assert.ok(!/waehrend_schicht/.test(JSON.stringify(await U.ueberblick({ jetzt: "09:00" }))) && /ganzen Familie/.test((await U.ueberblick({})).hinweis), "keine Konflikt-Markierung, Hinweis: Familientermine");
  e = await U.ueberblick({ datum: m }); assert.ok(e.tag === "morgen" && e.wetter.max === 9 && e.termine.length === 3 && e.geburtstage[0].in_tagen === 1, "morgen: Wetter von morgen, alle Termine, Geburtstag in 1 Tag: " + JSON.stringify(e.geburtstage));
  aus = { schicht: null, kalender: true }; e = await U.ueberblick({});
  assert.ok(e.ok && e.fehlt.length === 2 && /Schicht/.test(e.fehlt.join()) && /Termine/.test(e.fehlt.join()) && /ehrlich/.test(e.hinweis) && e.wetter, "Ausfall von Schicht und Kalender: ehrlich gemeldet, Rest kommt");
  console.log("ueberblick: alle Pruefungen gruen");
})().catch(e => { console.error(e); process.exit(1); });
