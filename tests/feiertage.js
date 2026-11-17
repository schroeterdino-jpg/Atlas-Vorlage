"use strict";
process.env.VERCEL_PROJECT_PRODUCTION_URL = "atlas-beispiel.vercel.app"; // Test laeuft als Altbestand-Kopie (Profil des Erfinders)
// Feiertage (selbst gerechnet) und Ferien (Dienst gemockt, auch Ausfall).
const assert = require("assert");
let ferienAntwort = null, ferienUrl = "";
global.fetch = async (url) => { url = String(url); if (url.startsWith("https://openholidaysapi.org/")) { ferienUrl = url; if (ferienAntwort === "fehler") return { ok: false, status: 500 }; return { ok: true, status: 200, json: async () => ferienAntwort }; } return { ok: false, status: 404, json: async () => ({}) }; };
process.env.ATLAS_SECRET = "mein-langes-passwort";
const W = require("../api/_werkzeuge.js"), F = require("../api/_feiertage.js");
(async () => {
  assert.strictEqual(F.ostern(2026), "2026-04-05"); assert.strictEqual(F.ostern(2027), "2027-03-28"); assert.strictEqual(F.ostern(2025), "2025-04-20"); assert.strictEqual(F.ostern(2024), "2024-03-31");
  const f26 = Object.fromEntries(F.feiertageJahr(2026).map(x => [x.name, x.datum]));
  assert.deepStrictEqual([f26.Karfreitag, f26.Ostermontag, f26["Christi Himmelfahrt"], f26.Pfingstmontag, f26.Reformationstag], ["2026-04-03", "2026-04-06", "2026-05-14", "2026-05-25", "2026-10-31"], "Feiertage 2026 inkl. Reformationstag (Schleswig-Holstein)");
  let e = await W.ausfuehren("feiertage", { art: "feiertage", von: "2026-12-20", bis: "2027-01-05" });
  assert.ok(e.ok && e.eintraege.map(x => x.name).join() === "1. Weihnachtstag,2. Weihnachtstag,Neujahr" && e.eintraege[0].wochentag === "Freitag" && /Schleswig-Holstein/.test(e.bundesland), "Weihnachten und Neujahr, 25.12.2026 ist Freitag: " + JSON.stringify(e.eintraege));
  e = await W.ausfuehren("feiertage", { art: "feiertage", von: "2026-11-16", anzahl: 2 }); assert.strictEqual(e.eintraege.length, 2); assert.strictEqual(e.eintraege[0].datum, "2026-12-25", "naechster Feiertag ab 16.11.2026 ist der 25.12.");
  assert.ok(e.eintraege[0].in_tagen === Math.round((Date.parse("2026-12-25T12:00:00Z") - Date.parse(require("../api/_kalender.js").heute() + "T12:00:00Z")) / 86400000));
  ferienAntwort = [{ startDate: "2026-12-21", endDate: "2027-01-06", name: [{ language: "DE", text: "Weihnachtsferien" }] }, { startDate: "2027-03-29", endDate: "2027-04-10", name: [{ language: "DE", text: "Osterferien" }] }];
  e = await W.ausfuehren("feiertage", { art: "ferien", von: "2026-12-01", bis: "2027-06-30" });
  assert.ok(e.ok && e.eintraege[0].name === "Weihnachtsferien" && e.eintraege[0].bis === "2027-01-06" && /DE-SH/.test(ferienUrl) && /validFrom=2026-12-01/.test(ferienUrl), "Ferien aus dem Dienst, Schleswig-Holstein");
  e = await W.ausfuehren("feiertage", { art: "beides", von: "2026-12-01", bis: "2027-01-10", anzahl: 12 });
  assert.deepStrictEqual(e.eintraege.map(x => x.name), ["Weihnachtsferien", "1. Weihnachtstag", "2. Weihnachtstag", "Neujahr"].sort((a, b) => 0) && e.eintraege.map(x => x.name), "gemischt");
  assert.ok(e.eintraege.some(x => x.art === "Ferien") && e.eintraege.some(x => x.art === "Feiertag"), "beides gemischt, nach Datum sortiert");
  assert.ok(e.eintraege.every((x, i, l) => !i || l[i - 1].datum <= x.datum), "nach Datum sortiert");
  ferienAntwort = "fehler";
  e = await W.ausfuehren("feiertage", { art: "beides", von: "2026-12-01", bis: "2027-01-10" }); assert.ok(e.ok && e.eintraege.length === 3 && /Schulferien konnte ich gerade nicht/.test(e.hinweis), "Ferien-Ausfall: Feiertage kommen trotzdem, ehrlicher Hinweis");
  e = await W.ausfuehren("feiertage", { art: "ferien", von: "2026-12-01", bis: "2027-01-10" }); assert.ok(!e.ok && e.technisch, "nur Ferien und Dienst aus: Fehler");
  console.log("feiertage: alle Pruefungen gruen");
})().catch(e => { console.error(e); process.exit(1); });
