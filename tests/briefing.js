"use strict";
process.env.VERCEL_PROJECT_PRODUCTION_URL = "atlas-beispiel.vercel.app"; // Test laeuft als Altbestand-Kopie (Profil des Erfinders)
// Briefing: der fertige Vorlese-Text passt zur Uhrzeit (keine Schicht/Heimfahrt, wenn Feierabend schon vorbei ist).
const assert = require("assert");
process.env.ATLAS_SECRET = "mein-langes-passwort";
const Kal = require("../api/_kalender.js"), P = require("../api/_plan.js"), Wx = require("../api/_wetter.js"), L = require("../api/_listen.js"), Ge = require("../api/_geburtstage.js"), Fe = require("../api/_feiertage.js"), Fa = require("../api/_fahrt.js"), Na = require("../api/_nachrichten.js");
const h = Kal.heute();
P.tagInfo = async () => ({ art: "Frühschicht", zeiten: { aufstehen: "03:45", abfahrt: "04:30", ankunft: "04:50", beginn: "05:10", ende: "13:37" } });
Kal.termine = async () => ({ ok: true, termine: [] });
Wx.wetter = async () => ({ ok: true, aktuell: { temperatur: 7, wetter: "Regenschauer" }, tage: [{ max: 9, min: 4 }], empfehlung: { schirm: true }, warnungen: [] });
L.liste = async () => ({ ok: true, offen: [] }); L.erinnerung = async () => ({ ok: true, offen: [] });
Ge.geburtstag = async () => ({ ok: true, geburtstage: [] }); Fe.feiertage = async () => ({ ok: true, eintraege: [] });
Fa.abfahrt = async () => ({ ok: true, fahrzeit_jetzt_min: 30, fahrzeit_normal_min: 18, staus: [], empfehlung: "Achtung: früher los" });
Fa.strecke = async () => ({ ok: true, minuten: 20, normal_minuten: 18, staus: [] });
Na.nachrichten = async () => ({ ok: true, ebenen: { deutschland: [{ titel: "Bahn-Streik" }] } });
const U = require("../api/_ueberblick.js");
(async () => {
  let e = await U.ueberblick({ briefing: true, jetzt: "20:07" });
  assert(/^Guten Abend, Sam\./.test(e.vorlesen), e.vorlesen);
  assert(!/Heimweg|Fahrt zur Arbeit|bei der Arbeit|Gleich beginnt/.test(e.vorlesen), "keine Arbeit am Abend: " + e.vorlesen);
  assert(/Morgen hast du Frühschicht, aufstehen um 03:45 Uhr, Abfahrt um 04:30 Uhr/.test(e.vorlesen), e.vorlesen);
  assert(/7 Grad/.test(e.vorlesen) && /Schirm/.test(e.vorlesen) && /Bahn-Streik/.test(e.vorlesen), e.vorlesen);
  e = await U.ueberblick({ briefing: true, jetzt: "04:00" });
  assert(/^Guten Morgen, Sam\./.test(e.vorlesen) && /Abfahrt um 04:30 Uhr/.test(e.vorlesen) && /30 Minuten/.test(e.vorlesen) && /früher losfahren/.test(e.vorlesen), e.vorlesen);
  assert(!/Morgen hast du/.test(e.vorlesen), "morgens kein 'Morgen hast du'");
  e = await U.ueberblick({ briefing: true, jetzt: "12:30" });
  assert(/bei der Arbeit, Feierabend ist um 13:37 Uhr/.test(e.vorlesen) && /Guten Tag/.test(e.vorlesen), e.vorlesen);
  console.log("briefing: alle Pruefungen gruen");
})().catch(x => { console.error(x); process.exit(1); });
