"use strict";
process.env.VERCEL_PROJECT_PRODUCTION_URL = "atlas-beispiel.vercel.app"; // Test laeuft als Altbestand-Kopie (Profil des Erfinders)
// Prueft Google-Anmeldung und Kalender-Werkzeuge mit Schein-Diensten (kein Netz noetig).
const assert = require("assert");
const kv = {}, hs = {}; const g = [];
let events = [];
global.fetch = async (url, o) => {
  url = String(url); o = o || {};
  if (url.startsWith("https://db.test")) {
    const c = JSON.parse(o.body); let result = null;
    if (c[0] === "HSET") { hs[c[2]] = c[3]; result = 1; } else if (c[0] === "HGET") result = hs[c[2]] || null; else if (c[0] === "HKEYS") result = Object.keys(hs);
    else if (c[0] === "SET") { kv[c[1]] = c[2]; result = "OK"; } else if (c[0] === "GET") result = kv[c[1]] || null; else if (c[0] === "DEL") { delete kv[c[1]]; result = 1; }
    else if (c[0] === "INCR") result = 1; else if (c[0] === "EXPIRE") result = 1;
    return { json: async () => ({ result }) };
  }
  g.push({ url, o });
  if (url === "https://oauth2.googleapis.com/token") { const p = new URLSearchParams(o.body); return p.get("grant_type") === "authorization_code" ? { ok: true, json: async () => ({ access_token: "at1", refresh_token: "rt1", expires_in: 3600 }) } : { ok: true, json: async () => ({ access_token: "at2", expires_in: 3600 }) }; }
  if (url.includes("/calendarList")) return { ok: true, json: async () => ({ items: [{ id: "primary", summary: "Sam" }, { id: "geb", summary: "Geburtstage" }] }) };
  if (url.includes("/calendars/primary/events") && o.method === "POST") { const b = JSON.parse(o.body); return { ok: true, json: async () => ({ id: "neu1", summary: b.summary, start: b.start, end: b.end }) }; }
  if (o.method === "DELETE") return { ok: true, status: 204 };
  if (o.method === "PATCH") { const b = JSON.parse(o.body); return { ok: true, json: async () => ({ id: "z1", summary: "Zahnarzt", start: b.start, end: b.end }) }; }
  if (url.includes("/events")) { const q = new URL(url).searchParams.get("q"); return { ok: true, json: async () => ({ items: url.includes("geb") ? [] : events.filter(x => !q || x.summary.toLowerCase().includes(q.toLowerCase())) }) }; }
  return { ok: false, status: 404, json: async () => ({}) };
};
process.env.ATLAS_SECRET = "mein-langes-passwort"; process.env.KV_REST_API_URL = "https://db.test"; process.env.KV_REST_API_TOKEN = "t";
const K = require("../api/_keys.js"), setup = require("../api/setup.js"), cb = require("../api/google-callback.js"), W = require("../api/_werkzeuge.js");
const post = (h, body) => new Promise(r => { const res = { setHeader() {}, status(c) { this.c = c; return this; }, json(j) { r([this.c, j]); }, send(b) { r([this.c, b]); } }; h({ method: "POST", headers: { host: "atlas.test" }, body }, res); });
const get = (h, query) => new Promise(r => { const res = { setHeader() {}, status(c) { this.c = c; return this; }, json(j) { r([this.c, j]); }, send(b) { r([this.c, b]); } }; h({ method: "GET", headers: {}, query }, res); });
(async () => {
  const pw = "mein-langes-passwort";
  let e = await W.ausfuehren("termine", {}); assert.strictEqual(e.ok, false, "ohne Client-Daten kommt ein Fehler"); // Client-ID fehlt -> technischer Fehler wird gemeldet
  await K.schluesselSpeichern("googleid", "abc.apps.googleusercontent.com"); await K.schluesselSpeichern("googlesecret", "geheim");
  e = await W.ausfuehren("termine", {}); assert.ok(/noch nicht verbunden/.test(e.hinweis), "ohne Anmeldung kommt ein klarer Hinweis"); assert.ok(!e.technisch);
  // Anmeldung
  let [c, j] = await post(setup, { aktion: "googlelink", passwort: "falsch" }); assert.strictEqual(c, 401);
  [, j] = await post(setup, { aktion: "googlelink", passwort: pw });
  assert.ok(j.ok && j.adresse.startsWith("https://accounts.google.com/") && /client_id=abc/.test(j.adresse) && /access_type=offline/.test(j.adresse) && /calendar/.test(j.adresse));
  assert.strictEqual(j.redirect, "https://atlas.test/api/google-callback");
  const state = new URL(j.adresse).searchParams.get("state");
  [c, j] = await get(cb, { state: "0".repeat(32), code: "x" }); assert.ok(/abgelaufen/.test(j), "unbekannter state wird abgelehnt");
  [c, j] = await get(cb, { state, code: "abc" }); assert.ok(/verbunden/.test(j) && c === 200);
  assert.ok(await K.schluesselHolen("googletoken") === "rt1", "Dauer-Zugang gespeichert"); assert.ok(!JSON.stringify(hs).includes("rt1"), "verschluesselt gespeichert");
  [, j] = await get(cb, { state, code: "abc" }); assert.ok(/abgelaufen/.test(j), "state gilt nur einmal");
  [, j] = await post(setup, { aktion: "status", passwort: pw }); assert.strictEqual(j.google, true);
  // Termine
  events = [{ id: "z1", summary: "Zahnarzt", start: { dateTime: "2026-11-16T09:30:00+01:00" }, end: { dateTime: "2026-11-16T10:15:00+01:00" } }, { id: "g1", summary: "Geburtstag Mama", start: { date: "2026-11-16" }, end: { date: "2026-11-17" } }];
  e = await W.ausfuehren("termine", { von: "2026-11-16" }); assert.ok(e.ok && e.anzahl === 2);
  assert.strictEqual(e.termine[0].titel, "Geburtstag Mama", "Ganztaegiges steht vor den Uhrzeiten"); assert.strictEqual(e.termine[1].titel, "Zahnarzt"); assert.strictEqual(e.termine[1].beginn, "2026-11-16T09:30");
  assert.ok(e.termine.some(t => t.ganztag && t.titel === "Geburtstag Mama"));
  const ev = g.filter(x => x.url.includes("/events?")).pop(); assert.ok(/timeMin=2026-11-16T00%3A00%3A00%2B01%3A00/.test(ev.url), "Zeitraum mit Berliner Offset: " + ev.url);
  assert.ok(g.some(x => x.o.headers && x.o.headers.Authorization === "Bearer at2"), "Zugangstoken kommt aus dem Dauer-Zugang");
  // anlegen
  e = await W.ausfuehren("termin_neu", { aktion: "anlegen", titel: "Reifen", beginn: "morgen" }); assert.strictEqual(e.ok, false);
  e = await W.ausfuehren("termin_neu", { aktion: "anlegen", titel: "Reifenwechsel", beginn: "2026-11-20T14:00", dauer_minuten: 90, ort: "Werkstatt" });
  const post1 = g.filter(x => x.o.method === "POST" && x.url.includes("events")).pop(), pb = JSON.parse(post1.o.body);
  assert.ok(e.ok && pb.start.dateTime === "2026-11-20T14:00:00" && pb.end.dateTime === "2026-11-20T15:30:00" && pb.start.timeZone === "Europe/Berlin" && pb.location === "Werkstatt");
  e = await W.ausfuehren("termin_neu", { aktion: "anlegen", titel: "Geburtstag", beginn: "2026-12-01", ganztag: true }); assert.strictEqual(JSON.parse(g.filter(x => x.o.method === "POST").pop().o.body).end.date, "2026-12-02");
  e = await W.ausfuehren("termin_neu", { aktion: "anlegen", titel: "Frist: Sparkasse, Antwort", beginn: "2026-12-05", ganztag: true, frist: true });
  { const b = JSON.parse(g.filter(x => x.o.method === "POST").pop().o.body); assert.strictEqual(b.reminders.useDefault, false); assert.deepStrictEqual(b.reminders.overrides.map(o => o.minutes), [3780, 900]); }
  e = await W.ausfuehren("termin_neu", { aktion: "anlegen", titel: "Geburtstag", beginn: "2026-12-01", ganztag: true });
  assert.strictEqual(JSON.parse(g.filter(x => x.o.method === "POST").pop().o.body).reminders, undefined);
  // loeschen / verschieben nur mit Bestaetigung
  e = await W.ausfuehren("termin_neu", { aktion: "loeschen", suche: "Zahnarzt" }); assert.ok(e.bestaetigung_noetig && !g.some(x => x.o.method === "DELETE"));
  e = await W.ausfuehren("termin_neu", { aktion: "loeschen", suche: "Zahnarzt", bestaetigt: true }); assert.ok(e.ok && g.some(x => x.o.method === "DELETE" && x.url.endsWith("/events/z1")));
  e = await W.ausfuehren("termin_neu", { aktion: "verschieben", suche: "Zahnarzt", beginn: "2026-11-17T08:00" }); assert.ok(e.bestaetigung_noetig);
  e = await W.ausfuehren("termin_neu", { aktion: "verschieben", suche: "Zahnarzt", beginn: "2026-11-17T08:00", bestaetigt: true });
  const pa = JSON.parse(g.filter(x => x.o.method === "PATCH").pop().o.body); assert.ok(e.ok && pa.start.dateTime === "2026-11-17T08:00:00" && pa.end.dateTime === "2026-11-17T08:45:00", "Dauer bleibt erhalten");
  events.push({ id: "z2", summary: "Zahnarzt Kontrolle", start: { dateTime: "2026-12-05T10:00:00+01:00" }, end: { dateTime: "2026-12-05T10:30:00+01:00" } });
  e = await W.ausfuehren("termin_neu", { aktion: "loeschen", suche: "Zahnarzt", bestaetigt: true }); assert.ok(e.mehrdeutig && e.mehrdeutig.length >= 2, "bei mehreren Treffern wird nachgefragt");
  e = await W.ausfuehren("termin_neu", { aktion: "loeschen", suche: "Friseur", bestaetigt: true }); assert.strictEqual(e.ok, false);
  // Schicht und Urlaub
  const Kal = require("../api/_kalender.js"), heute = Kal.heute(), dd = new Date(heute + "T12:00:00Z"), mo = Kal.plusTage(heute, -((dd.getUTCDay() + 6) % 7));
  e = await W.ausfuehren("schicht", { aktion: "abfragen", von: mo }); assert.ok(!e.ok && /noch nicht gesetzt/.test(e.hinweis), "ohne gesetzte Schicht wird nachgefragt");
  const we = [0, 6].includes(dd.getUTCDay());
  if (we) { e = await W.ausfuehren("schicht", { aktion: "festlegen", schicht: "spaet", woche: "diese" }); assert.ok(e.mehrdeutig && !e.ok, "am Wochenende wird bei 'diese Woche' nachgefragt"); }
  e = await W.ausfuehren("schicht", { aktion: "festlegen", schicht: "spaet", woche: "diese", bestaetigt: true }); assert.ok(e.ok);
  e = await W.ausfuehren("schicht", { aktion: "abfragen", von: mo, bis: Kal.plusTage(mo, 13) });
  assert.strictEqual(e.tage.length, 14); assert.strictEqual(e.tage[0].art, "Spätschicht"); assert.strictEqual(e.tage[0].zeiten.beginn, "13:45"); assert.strictEqual(e.tage[5].art, "frei (Wochenende)"); assert.strictEqual(e.tage[7].art, "Frühschicht", "Wochenwechsel am Montag"); assert.strictEqual(e.tage[7].zeiten.ende, "13:37");
  e = await W.ausfuehren("schicht", { aktion: "festlegen", schicht: "frueh", woche: "naechste" }); e = await W.ausfuehren("schicht", { aktion: "abfragen", von: mo }); assert.strictEqual(e.tage[0].art, "Spätschicht", "naechste Woche Frueh = diese Woche Spaet");
  e = await W.ausfuehren("schicht", { aktion: "zeit_setzen", schicht: "frueh", feld: "abfahrt", wert: "4.15" }); assert.ok(e.ok);
  e = await W.ausfuehren("schicht", { aktion: "zeit_setzen", schicht: "spaet", feld: "pausen", wert: "15:45-16:05, 18:00-18:30" }); assert.ok(e.ok);
  e = await W.ausfuehren("schicht", { aktion: "zeit_setzen", schicht: "spaet", feld: "beginn", wert: "abends" }); assert.ok(!e.ok);
  e = await W.ausfuehren("schicht", { aktion: "zeiten_zeigen" }); assert.strictEqual(e.zeiten.frueh.abfahrt, "04:15"); assert.strictEqual(e.zeiten.frueh.beginn, "05:10");
  e = await W.ausfuehren("schicht", { aktion: "abfragen", wochen_ab_jetzt: 2 }); assert.strictEqual(e.tage.length, 7); assert.strictEqual(e.tage[0].datum, Kal.plusTage(mo, 14)); assert.strictEqual(e.zusammenfassung.length, 2); assert.ok(/^Montag, \d\d\.\d\d\. bis Freitag, \d\d\.\d\d\.: (Früh|Spät)schicht$/.test(e.zusammenfassung[0]), e.zusammenfassung[0]); assert.ok(/Wochenende/.test(e.zusammenfassung[1]));
  const u1 = Kal.plusTage(mo, 8), u2 = Kal.plusTage(mo, 10);
  e = await W.ausfuehren("urlaub", { aktion: "eintragen", von: u1, bis: u2 }); const up = JSON.parse(g.filter(x => x.o.method === "POST").pop().o.body);
  assert.ok(e.ok && up.summary.startsWith("Urlaub") && up.start.date === u1 && up.end.date === Kal.plusTage(u2, 1), "mehrtaegiger Ganztagstermin");
  e = await W.ausfuehren("schicht", { aktion: "abfragen", von: Kal.plusTage(mo, 7), bis: Kal.plusTage(mo, 11) }); assert.deepStrictEqual(e.tage.map(t => t.art), ["Frühschicht", "Urlaub", "Urlaub", "Urlaub", "Frühschicht"]);
  e = await W.ausfuehren("urlaub", { aktion: "eintragen", von: Kal.plusTage(u1, 1), bis: Kal.plusTage(u2, 5) }); assert.ok(e.bestaetigung_noetig, "Ueberschneidung fragt nach");
  e = await W.ausfuehren("urlaub", { aktion: "eintragen", von: "2020-01-01", bis: "2020-01-05" }); assert.ok(!e.ok);
  e = await W.ausfuehren("urlaub", { aktion: "abfragen" }); assert.strictEqual(e.urlaub.length, 1);
  const dels = g.filter(x => x.o.method === "DELETE").length;
  e = await W.ausfuehren("urlaub", { aktion: "beenden" }); assert.ok(e.bestaetigung_noetig && g.filter(x => x.o.method === "DELETE").length === dels, "Loeschen nur nach Bestaetigung");
  e = await W.ausfuehren("urlaub", { aktion: "beenden", bestaetigt: true }); assert.ok(e.ok);
  e = await W.ausfuehren("urlaub", { aktion: "abfragen" }); assert.strictEqual(e.urlaub.length, 0);
  // Training ueber mehrere Wochen, ohne Wochenende
  const t1 = Kal.plusTage(mo, 21), t2 = Kal.plusTage(mo, 38); const n0 = g.filter(x => x.o.method === "POST" && x.url.includes("events")).length;
  e = await W.ausfuehren("urlaub", { aktion: "eintragen", von: t1, bis: t2, titel: "Administrationstraining", ohne_wochenende: true });
  const neue = g.filter(x => x.o.method === "POST" && x.url.includes("events")).slice(n0).map(x => JSON.parse(x.o.body));
  assert.ok(e.ok && neue.length === 3 && neue.every(b => b.summary === "Administrationstraining") && neue[0].start.date === t1 && neue[0].end.date === Kal.plusTage(t1, 5), "je Woche Mo-Fr ein Eintrag");
  e = await W.ausfuehren("schicht", { aktion: "abfragen", von: Kal.plusTage(t1, 4), bis: Kal.plusTage(t1, 7) }); assert.deepStrictEqual(e.tage.map(t => t.art), ["Administrationstraining", "frei (Wochenende)", "frei (Wochenende)", "Administrationstraining"]);
  e = await W.ausfuehren("urlaub", { aktion: "beenden", von: t1, bestaetigt: true }); assert.ok(e.ok && e.geloescht.was === "Administrationstraining");
  console.log("kalender: alle Pruefungen gruen");
})().catch(e => { console.error(e); process.exit(1); });
