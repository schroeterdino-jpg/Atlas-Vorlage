"use strict";
// Feiertage (Schleswig-Holstein, selbst berechnet) und Schulferien (OpenHolidays, Schleswig-Holstein).
const Kal = require("./_kalender.js");

const TZ = "UTC";
const wochentag = iso => new Date(iso + "T12:00:00Z").toLocaleDateString("de-DE", { timeZone: TZ, weekday: "long" });
const tageBis = (iso, von) => Math.round((Date.parse(iso + "T12:00:00Z") - Date.parse(von + "T12:00:00Z")) / 86400000);
const MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
const lang = iso => { const [j, m, t] = iso.split("-"); return +t + ". " + MONATE[+m - 1]; };
function ostern(jahr) { // Gauss/Anonymous Gregorian
  const a = jahr % 19, b = Math.floor(jahr / 100), c = jahr % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const monat = Math.floor((h + l - 7 * m + 114) / 31), tag = ((h + l - 7 * m + 114) % 31) + 1;
  return jahr + "-" + String(monat).padStart(2, "0") + "-" + String(tag).padStart(2, "0");
}
function feiertageJahr(j) {
  const o = ostern(j), p = n => Kal.plusTage(o, n);
  return [["Neujahr", j + "-01-01"], ["Karfreitag", p(-2)], ["Ostermontag", p(1)], ["Tag der Arbeit", j + "-05-01"], ["Christi Himmelfahrt", p(39)], ["Pfingstmontag", p(50)], ["Tag der Deutschen Einheit", j + "-10-03"], ["Reformationstag", j + "-10-31"], ["1. Weihnachtstag", j + "-12-25"], ["2. Weihnachtstag", j + "-12-26"]].map(([name, datum]) => ({ name, datum }));
}
async function ferien(von, bis) {
  const r = await fetch("https://openholidaysapi.org/SchoolHolidays?countryIsoCode=DE&subdivisionCode=DE-SH&languageIsoCode=DE&validFrom=" + von + "&validTo=" + bis, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error("Ferien-Dienst antwortet mit " + r.status);
  const j = await r.json();
  return (Array.isArray(j) ? j : []).map(x => { const n = (x.name || []).find(t => t.language === "DE") || (x.name || [])[0]; return { name: n ? n.text : "Schulferien", datum: x.startDate, bis: x.endDate }; });
}

async function feiertage(a) {
  const heute = Kal.heute(), art = ["feiertage", "ferien", "beides"].includes(a.art) ? a.art : "beides";
  const ok = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
  let von = ok(a.von) ? a.von : heute, bis = ok(a.bis) ? a.bis : Kal.plusTage(von, 400); if (bis < von) bis = von; if (Kal.plusTage(von, 800) < bis) bis = Kal.plusTage(von, 800);
  const out = []; let hinweis = "";
  if (art !== "ferien") for (let j = +von.slice(0, 4); j <= +bis.slice(0, 4); j++) feiertageJahr(j).filter(f => f.datum >= von && f.datum <= bis).forEach(f => out.push({ art: "Feiertag", name: f.name, datum: f.datum, wochentag: wochentag(f.datum), text: lang(f.datum), in_tagen: tageBis(f.datum, heute) }));
  if (art !== "feiertage") {
    try { (await ferien(von, bis)).forEach(f => out.push({ art: "Ferien", name: f.name, datum: f.datum, bis: f.bis, wochentag: wochentag(f.datum), text: lang(f.datum) + " bis " + lang(f.bis), in_tagen: tageBis(f.datum, heute), laeuft_gerade: f.datum <= heute && f.bis >= heute })); }
    catch (e) { hinweis = "Die Schulferien konnte ich gerade nicht abrufen (" + String(e.message || e).slice(0, 80) + "). Das ehrlich sagen und nur die Feiertage nennen."; if (art === "ferien") return { ok: false, technisch: true, hinweis }; }
  }
  out.sort((x, y) => x.datum.localeCompare(y.datum));
  const n = Math.min(12, Math.max(1, +a.anzahl || 6));
  return { ok: true, bundesland: "Schleswig-Holstein", von, bis, eintraege: out.slice(0, n), gesamt: out.length, hinweis: hinweis || (out.length ? "Feiertage gelten für Schleswig-Holstein. Wer nach 'nächster Feiertag' oder 'nächste Ferien' fragt: den ersten passenden Eintrag mit Datum, Wochentag und in_tagen nennen." : "In diesem Zeitraum gibt es keinen Eintrag.") };
}
module.exports = { feiertage, feiertageJahr, ostern };
