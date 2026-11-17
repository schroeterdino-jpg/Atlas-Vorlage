"use strict";
// Termine ansehen, anlegen, verschieben, loeschen (Google Kalender, alle sichtbaren Kalender zum Lesen, "primary" zum Schreiben).
const Gg = require("./_google.js");
const TZ = "Europe/Berlin";
const tag = d => new Date(d).toLocaleDateString("sv-SE", { timeZone: TZ });
const heute = () => tag(Date.now());
function plusTage(iso, n) { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
// Offset von Berlin an einem Tag (+01:00 oder +02:00), damit "von/bis" exakt sind
function offset(iso) { const p = new Date(iso + "T12:00:00Z").toLocaleString("sv-SE", { timeZone: TZ, timeZoneName: "longOffset" }).match(/GMT([+-]\d{2}:\d{2})/); return p ? p[1] : "+01:00"; }
const kurz = e => { const g = !!(e.start && e.start.date); return { id: e.id, titel: e.summary || "(ohne Titel)", beginn: g ? e.start.date : (e.start.dateTime || "").slice(0, 16), ende: g ? e.end.date : (e.end.dateTime || "").slice(0, 16), ganztag: g, ort: e.location || undefined, kalender: e._kal || undefined, eigener_kalender: e._eigen }; };

async function liste(von, bis, suche) {
  const kals = await Gg.api("/users/me/calendarList?minAccessRole=reader&maxResults=20"); if (!kals) return null;
  const alle = [];
  for (const k of (kals.items || []).filter(k => k.selected !== false).slice(0, 8)) {
    const q = new URLSearchParams({ timeMin: von + "T00:00:00" + offset(von), timeMax: bis + "T23:59:59" + offset(bis), singleEvents: "true", orderBy: "startTime", maxResults: "50" }); if (suche) q.set("q", suche);
    const r = await Gg.api("/calendars/" + encodeURIComponent(k.id) + "/events?" + q.toString());
    (r.items || []).filter(e => e.status !== "cancelled").forEach(e => { e._kal = k.summaryOverride || k.summary; e._eigen = k.primary === true ? true : (k.accessRole === "owner" ? true : false); alle.push(e); });
  }
  alle.sort((a, b) => String((a.start.dateTime || a.start.date)).localeCompare(String(b.start.dateTime || b.start.date)));
  return alle;
}
async function termine(a) {
  const von = /^\d{4}-\d{2}-\d{2}$/.test(a.von || "") ? a.von : heute(); let bis = /^\d{4}-\d{2}-\d{2}$/.test(a.bis || "") ? a.bis : von;
  if (bis < von) bis = von; if (plusTage(von, 92) < bis) bis = plusTage(von, 92);
  const l = await liste(von, bis, a.suche); if (!l) return Gg.NICHT_VERBUNDEN;
  return { ok: true, von, bis, anzahl: l.length, termine: l.slice(0, 30).map(kurz), hinweis: l.length ? "" : "Keine Termine in diesem Zeitraum." };
}
async function suchen(text) {
  const l = await liste(heute(), plusTage(heute(), 180), text); if (!l) return null;
  return l.filter(e => !!(e.start && e.start.dateTime || e.start.date));
}
function zeit(s) { return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(String(s || "")); }
function aktionNorm(x) { const t = String(x || "").toLowerCase(); return /l(ö|oe)sch|delete|entfern|absag|streich/.test(t) ? "loeschen" : /verschieb|änder|aender|umleg|verleg/.test(t) ? "verschieben" : /anleg|neu|erstell|eintrag|hinzu|create/.test(t) ? "anlegen" : t; }
async function neu(a) {
  a = Object.assign({}, a, { aktion: aktionNorm(a.aktion) });
  if (!(await Gg.verbunden())) return Gg.NICHT_VERBUNDEN;
  if (a.aktion === "anlegen") {
    const titel = String(a.titel || "").trim(); if (!titel) return { ok: false, hinweis: "Es fehlt der Titel des Termins. Nachfragen." };
    let body;
    if (a.ganztag) { const t = String(a.beginn || "").slice(0, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return { ok: false, hinweis: "Es fehlt das Datum. Nachfragen." }; body = { summary: titel, start: { date: t }, end: { date: plusTage(t, 1) } }; if (a.frist) body.reminders = { useDefault: false, overrides: [{ method: "popup", minutes: 3780 }, { method: "popup", minutes: 900 }] }; /* Frist: Erinnerung 3 Tage vorher und am Vortag um 9 Uhr */ }
    else {
      if (!zeit(a.beginn)) return { ok: false, hinweis: "Beginn fehlt oder falsches Format (JJJJ-MM-TTTHH:MM, deutsche Zeit). Aus der aktuellen Zeit ausrechnen oder nachfragen." };
      const dauer = Math.min(1440, Math.max(5, Number(a.dauer_minuten) || 60)); const ende = zeit(a.ende) ? a.ende : new Date(new Date(a.beginn + ":00Z").getTime() + dauer * 60000).toISOString().slice(0, 16);
      body = { summary: titel, start: { dateTime: a.beginn + ":00", timeZone: TZ }, end: { dateTime: ende + ":00", timeZone: TZ } };
    }
    if (a.ort) body.location = String(a.ort).slice(0, 200);
    const e = await Gg.api("/calendars/primary/events", { method: "POST", body: JSON.stringify(body) });
    return { ok: true, angelegt: kurz(e) };
  }
  if (a.aktion === "verschieben" || a.aktion === "loeschen") {
    const l = await suchen(String(a.suche || "")); if (!l) return Gg.NICHT_VERBUNDEN;
    const g = l.filter(e => e.status !== "cancelled" && (!a.datum || String(e.start.dateTime || e.start.date).startsWith(a.datum)));
    if (!g.length) return { ok: false, hinweis: "Kein passender Termin in den nächsten sechs Monaten gefunden. Ehrlich sagen und fragen, wie er heißt." };
    if (g.length > 1 && a.aktion === "loeschen" && a.alle === true && a.bestaetigt === true && g.length <= 10) { // "beide/alle löschen": nach ausdrücklicher Bestätigung alle Treffer
      for (const e of g) await Gg.api("/calendars/primary/events/" + encodeURIComponent(e.id), { method: "DELETE" });
      return { ok: true, geloescht_anzahl: g.length, geloescht: g.map(kurz) };
    }
    if (g.length > 1) return { ok: false, mehrdeutig: g.slice(0, 6).map(kurz), hinweis: "Mehrere Termine passen. Sam fragen, welcher gemeint ist (Datum nennen) und dann mit datum wiederholen." };
    const e = g[0];
    if (!a.bestaetigt) return { ok: false, bestaetigung_noetig: true, termin: kurz(e), hinweis: "Lies Sam den Termin vor und frage, ob er " + (a.aktion === "loeschen" ? "gelöscht" : "verschoben auf " + (a.beginn || "?")) + " werden soll. Erst nach seinem Ja mit bestaetigt=true wiederholen." };
    const kal = encodeURIComponent((e.organizer && e.organizer.self ? "primary" : null) || "primary");
    if (a.aktion === "loeschen") { await Gg.api("/calendars/" + kal + "/events/" + encodeURIComponent(e.id), { method: "DELETE" }); return { ok: true, geloescht: kurz(e) }; }
    if (!zeit(a.beginn)) return { ok: false, hinweis: "Neuer Beginn fehlt oder falsches Format. Nachfragen." };
    const alt = new Date((e.end.dateTime || e.start.dateTime)).getTime() - new Date(e.start.dateTime).getTime(); const dauer = isFinite(alt) && alt > 0 ? alt : 3600000;
    const ende = new Date(new Date(a.beginn + ":00Z").getTime() + dauer).toISOString().slice(0, 16);
    const r = await Gg.api("/calendars/" + kal + "/events/" + encodeURIComponent(e.id), { method: "PATCH", body: JSON.stringify({ start: { dateTime: a.beginn + ":00", timeZone: TZ }, end: { dateTime: ende + ":00", timeZone: TZ } }) });
    return { ok: true, verschoben: kurz(r) };
  }
  return { ok: false, hinweis: "Unbekannte Aktion." };
}
module.exports = { termine, neu, heute, plusTage, liste };
