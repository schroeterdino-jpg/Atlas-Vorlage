"use strict";
process.env.VERCEL_PROJECT_PRODUCTION_URL = "atlas-beispiel.vercel.app"; // Test laeuft als Altbestand-Kopie (Profil des Erfinders)
// Geburtstage: merken, bald, Alter, Schaltjahr, Loeschen nur nach Bestaetigung (Redis ist gemockt).
const assert = require("assert");
const store = {};
global.fetch = async (url, o) => {
  url = String(url);
  if (url.startsWith("https://db.test")) { const c = JSON.parse(o.body); let result = null; if (c[0] === "HSET") { store[c[2]] = c[3]; result = 1; } else if (c[0] === "HGET") result = store[c[2]] || null; return { json: async () => ({ result }) }; }
  return { ok: false, status: 404, json: async () => ({}) };
};
process.env.ATLAS_SECRET = "mein-langes-passwort"; process.env.UPSTASH_REDIS_REST_URL = "https://db.test"; process.env.UPSTASH_REDIS_REST_TOKEN = "t";
const Gg = require("../api/_google.js");
let kalAntwort = null, kalFehler = false, kalAnfragen = [];
Gg.api = async (pfad) => { kalAnfragen.push(pfad); if (kalFehler) throw new Error("kaputt"); if (!kalAntwort) return null; if (pfad.startsWith("/users/me/calendarList")) return { items: [{ id: "x@gmail.com", summary: "Privat" }, { id: "addressbook#contacts@group.v.calendar.google.com", summary: "Geburtstage" }] }; if (/contacts/.test(decodeURIComponent(pfad))) return { items: kalAntwort }; return { items: [] }; };
const W = require("../api/_werkzeuge.js"), Ge = require("../api/_geburtstage.js"), Kal = require("../api/_kalender.js");
const heute = Kal.heute(), plus = n => Kal.plusTage(heute, n), md = iso => iso.slice(5);
(async () => {
  let e = await W.ausfuehren("geburtstag", { aktion: "zeigen" }); assert.ok(e.ok && e.geburtstage.length === 0 && /noch keine/.test(e.hinweis), "leer: ehrlich");
  e = await W.ausfuehren("geburtstag", { aktion: "merken", name: "Finny", datum: "2015-" + md(plus(3)), beziehung: "Enkelin" });
  assert.ok(e.ok && e.gemerkt.in_tagen === 3 && e.gemerkt.wird_alt === +plus(3).slice(0, 4) - 2015, "Finny in 3 Tagen, Alter: " + JSON.stringify(e));
  e = await W.ausfuehren("geburtstag", { aktion: "merken", name: "Leon", datum: md(plus(40)) }); assert.ok(e.ok && e.gemerkt.wird_alt === undefined, "ohne Jahr kein Alter");
  e = await W.ausfuehren("geburtstag", { aktion: "merken", name: "Heute-Kind", datum: md(heute) }); assert.ok(e.ok && e.gemerkt.heute === true && e.gemerkt.in_tagen === 0, "heute zaehlt als heute");
  e = await W.ausfuehren("geburtstag", { aktion: "merken", name: "Oma", datum: md(plus(-1)) }); assert.ok(e.ok && e.gemerkt.in_tagen >= 360, "gestern war: naechstes Mal in rund einem Jahr: " + e.gemerkt.in_tagen);
  e = await W.ausfuehren("geburtstag", { aktion: "zeigen" }); assert.deepStrictEqual(e.geburtstage.map(x => x.name), ["Heute-Kind", "Finny", "Leon", "Oma"], "sortiert nach naechstem Geburtstag");
  assert.ok(/Heute/i.test(e.hinweis), "heute zuerst nennen");
  e = await W.ausfuehren("geburtstag", { aktion: "zeigen", anzahl: 2 }); assert.strictEqual(e.geburtstage.length, 2);
  e = await W.ausfuehren("geburtstag", { aktion: "zeigen", name: "fin" }); assert.ok(e.ok && e.geburtstage[0].name === "Finny" && /Glückwunsch/.test(e.hinweis) && e.geburtstage[0].beziehung === "Enkelin", "Name teilweise, mit Beziehung und Hinweis fuer den Entwurf");
  e = await W.ausfuehren("geburtstag", { aktion: "zeigen", name: "Unbekannt" }); assert.ok(e.ok && e.geburtstage.length === 0 && /kein Geburtstag/.test(e.hinweis));
  e = await W.ausfuehren("geburtstag", { aktion: "merken", name: "finny", datum: md(plus(5)) }); assert.ok(e.ok && e.aktualisiert && e.gemerkt.wird_alt !== undefined && e.gemerkt.name === "Finny", "gleicher Name aktualisiert (Schreibweise bleibt), Jahr bleibt");
  e = await W.ausfuehren("geburtstag", { aktion: "zeigen" }); assert.strictEqual(e.gesamt, 4, "kein Duplikat");
  // Datum
  assert.deepStrictEqual(Ge.datumLesen("3.3.1980"), { jahr: 1980, monat: 3, tag: 3 }); assert.deepStrictEqual(Ge.datumLesen("03-14"), { monat: 3, tag: 14 }); assert.strictEqual(Ge.datumLesen("31.04."), null); assert.strictEqual(Ge.datumLesen("quatsch"), null);
  e = await W.ausfuehren("geburtstag", { aktion: "merken", name: "X", datum: "morgen" }); assert.ok(!e.ok, "unverstaendliches Datum fragt nach");
  // 29. Februar
  assert.strictEqual(Ge.naechster({ monat: 2, tag: 29 }, "2027-01-10").iso, "2027-02-28", "Nicht-Schaltjahr: 28.2."); assert.strictEqual(Ge.naechster({ monat: 2, tag: 29 }, "2027-03-01").iso, "2028-02-29", "Schaltjahr: 29.2.");
  // Loeschen nur nach Bestaetigung
  e = await W.ausfuehren("geburtstag", { aktion: "loeschen", name: "Leon" }); assert.ok(!e.ok && e.bestaetigung_noetig, "fragt erst");
  e = await W.ausfuehren("geburtstag", { aktion: "zeigen" }); assert.strictEqual(e.gesamt, 4, "noch nichts geloescht");
  e = await W.ausfuehren("geburtstag", { aktion: "loeschen", name: "Leon", bestaetigt: true }); assert.ok(e.ok && e.geloescht === "Leon");
  e = await W.ausfuehren("geburtstag", { aktion: "zeigen" }); assert.strictEqual(e.gesamt, 3);
  e = await W.ausfuehren("geburtstag", { aktion: "loeschen", name: "Niemand", bestaetigt: true }); assert.ok(!e.ok);
  // Zusaetzlich aus dem Google-Kalender (nur lesen), eigene Eintraege gewinnen, keine Doppelten
  const jahr = plus(10).slice(0, 4);
  kalAntwort = [{ summary: "Finny Meier", status: "confirmed", start: { date: plus(10) } }, { summary: "Tante Bea's Geburtstag", start: { date: plus(20) } }, { summary: "Geburtstag von Onkel Jo", start: { date: plus(7) } }, { summary: "Abgesagt", status: "cancelled", start: { date: plus(2) } }, { summary: "Mit Uhrzeit", start: { dateTime: plus(2) + "T10:00:00Z" } }];
  e = await W.ausfuehren("geburtstag", { aktion: "zeigen", anzahl: 10 });
  const ns = e.geburtstage.map(x => x.name);
  assert.ok(ns.includes("Onkel Jo") && ns.includes("Tante Bea") && !ns.includes("Finny Meier") && !ns.includes("Abgesagt") && !ns.includes("Mit Uhrzeit"), "Kalender dazu, Finny nicht doppelt, Abgesagtes und Termine mit Uhrzeit nicht: " + ns.join());
  assert.strictEqual(e.geburtstage.find(x => x.name === "Onkel Jo").quelle, "Kalender"); assert.ok(e.geburtstage.find(x => x.name === "Finny").beziehung === "Enkelin", "eigener Eintrag gewinnt");
  assert.ok(/nichts dazu erfinden/.test(e.hinweis) && /eigener Geburtstag/.test(e.hinweis) && /Jahr nicht/.test(e.hinweis), "Hinweis: keine erfundenen Beziehungen, Sam selbst erkennen");
  assert.ok(kalAnfragen.every(p => !/POST|PATCH/.test(p)), "nur lesen");
  e = await W.ausfuehren("geburtstag", { aktion: "zeigen", name: "Jo" }); assert.ok(e.ok && e.geburtstage[0].name === "Onkel Jo" && /Glückwunsch/.test(e.hinweis), "Name aus dem Kalender gefunden, Entwurf moeglich");
  assert.ok(kalAnfragen.some(p => /q=Jo/.test(p)), "Suche im Kalender nutzt den Namen");
  kalFehler = true; e = await W.ausfuehren("geburtstag", { aktion: "zeigen", anzahl: 10 }); assert.ok(e.ok && e.geburtstage.some(x => x.name === "Finny"), "Kalender-Ausfall: eigene Geburtstage kommen trotzdem");
  kalFehler = false; kalAntwort = null;
  console.log("geburtstage: alle Pruefungen gruen");
})().catch(e => { console.error(e); process.exit(1); });
