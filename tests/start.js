"use strict";
process.env.VERCEL_PROJECT_PRODUCTION_URL = "atlas-beispiel.vercel.app"; // Test laeuft als Altbestand-Kopie (Profil des Erfinders)
// Kacheln der Startseite: api/start.js verdichtet Termine, Wetter, Sprit und Tankstelle.
const assert = require("assert");
const Kal = require("../api/_kalender.js");
const W = require("../api/_werkzeuge.js");
const T = require("../api/_tor.js");
T.tor = async (req) => req.body; // Passwort-Pruefung hier nicht Thema
const h = Kal.heute();
const orte = (k, p) => ({ ok: true, orte: [{ name: "AVIA", entfernung: "2,3 km", km: 2.3, preise: Object.assign({ e5: "2,150", e10: "2,050", diesel: "2,220" }, p) }] });
let aufrufe = [];
W.ausfuehren = async (name, a, ctx) => {
  aufrufe.push([name, a, ctx]);
  if (name === "termine") return { ok: true, termine: [{ titel: "Zahnarzt", beginn: h + "T23:50", ende: Kal.plusTage(h, 1) + "T00:30", ganztag: false }, { titel: "Frei", beginn: h, ende: h, ganztag: true }, { titel: "Vorbei", beginn: Kal.plusTage(h, -1) + "T09:00", ende: Kal.plusTage(h, -1) + "T10:00", ganztag: false }] };
  if (name === "wetter") return { ok: true, aktuell: { temperatur: 5.6, wetter: "bewölkt" }, empfehlung: { schirm: true, regen_ab: h + "T15:00" }, warnungen: [] };
  if (name === "in_der_naehe") return orte(a.kraftstoff);
  if (name === "notiz") return { ok: true, notizen: [{ titel: "Geschenk", text: "Lego" }, { text: "WLAN-Passwort Gästenetz: blau42\nzweite Zeile" }], gefunden: 5 };
  return { ok: false };
};
const start = require("../api/start.js");
const res = () => { const r = { code: 0, body: null }; r.status = c => { r.code = c; return r; }; r.json = b => { r.body = b; return r; }; r.setHeader = () => {}; return r; };
(async () => {
  let r = res(); await start({ method: "POST", body: { standort: { lat: 53.5, lon: 10.5 } } }, r);
  const b = r.body;
  assert.ok(b.ok, JSON.stringify(b));
  assert.strictEqual(b.termine.anzahl, 2, "vorbeigegangene Termine zaehlen nicht: " + JSON.stringify(b.termine));
  assert.ok(b.termine.zeilen[0].includes("ganztägig") || b.termine.zeilen[0].includes("23:50"));
  assert.strictEqual(b.wetter.temperatur, 6); assert.strictEqual(b.wetter.schirm, true); assert.strictEqual(b.wetter.regen_ab, "15:00");
  assert.strictEqual(b.sprit.diesel.preis, "2,220"); assert.strictEqual(b.sprit.e10.preis, "2,050"); assert.strictEqual(b.sprit.e5.preis, "2,150");
  assert.deepStrictEqual(b.notizen, { anzahl: 5, zeilen: ["Geschenk", "WLAN-Passwort Gästenetz: b"] }, "Notizen-Kachel: Anzahl und neueste Titel (Text gekuerzt, erste Zeile)");
  assert.deepStrictEqual(b.tanken, { name: "AVIA", entfernung: "2,3 km", preis: "2,220" });
  assert.ok(aufrufe.filter(x => x[0] === "in_der_naehe").every(x => x[1].guenstigste === true && x[2].standort.lat === 53.5), "Sprit ab Handy-Standort, guenstigste zuerst");
  // Ausfall eines Teils zerstoert die Kacheln nicht
  W.ausfuehren = async (name) => { if (name === "wetter") throw new Error("kaputt"); if (name === "termine") return { ok: false }; return { ok: false }; };
  r = res(); await start({ method: "POST", body: {} }, r);
  assert.ok(r.body.ok && r.body.wetter.fehler && r.body.termine.fehler && r.body.sprit.fehler && r.body.tanken.fehler && r.body.notizen.fehler, "Teilausfaelle werden als fehler gemeldet");
  console.log("start: alle Pruefungen gruen");
})().catch(e => { console.error(e); process.exit(1); });
