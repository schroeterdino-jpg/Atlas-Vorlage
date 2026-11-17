"use strict";
// Geburtstage: merken, nachsehen, wer hat bald, loeschen (nur nach Bestaetigung). Liegt in Atlas' Datenbank.
const K = require("./_keys.js");
const Kal = require("./_kalender.js");
const Gg = require("./_google.js");

const MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
const norm = s => String(s || "").toLowerCase().trim();
async function laden() { const r = await K.redis(["HGET", "atlas:listen", "geburtstage"]); if (!r) return []; try { return JSON.parse(r); } catch (e) { throw new Error("Geburtstagsliste ist beschädigt"); } }
async function sichern(l) { await K.redis(["HSET", "atlas:listen", "geburtstage", JSON.stringify(l)]); }
const tageBis = (iso, von) => Math.round((Date.parse(iso + "T12:00:00Z") - Date.parse(von + "T12:00:00Z")) / 86400000);
const gueltig = (m, t) => m >= 1 && m <= 12 && t >= 1 && t <= [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
function datumLesen(s) { // JJJJ-MM-TT oder MM-TT oder TT.MM.(JJJJ)
  s = String(s || "").trim(); let m;
  if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/))) return gueltig(+m[2], +m[3]) ? { jahr: +m[1], monat: +m[2], tag: +m[3] } : null;
  if ((m = s.match(/^(\d{1,2})-(\d{1,2})$/))) return gueltig(+m[1], +m[2]) ? { monat: +m[1], tag: +m[2] } : null;
  if ((m = s.match(/^(\d{1,2})\.(\d{1,2})\.?(\d{4})?$/))) return gueltig(+m[2], +m[1]) ? { jahr: m[3] ? +m[3] : undefined, monat: +m[2], tag: +m[1] } : null;
  return null;
}
// naechster Geburtstag ab heute (29.2. in Nicht-Schaltjahren: 28.2.)
function naechster(g, heute) {
  const jahr = +heute.slice(0, 4); let best = null;
  for (const j of [jahr, jahr + 1]) { let t = g.tag; if (g.monat === 2 && t === 29 && !(j % 4 === 0 && (j % 100 !== 0 || j % 400 === 0))) t = 28; const iso = j + "-" + String(g.monat).padStart(2, "0") + "-" + String(t).padStart(2, "0"); if (iso >= heute) { best = { iso, jahr: j }; break; } }
  return best;
}
function anzeige(g, heute) {
  const n = naechster(g, heute), tage = tageBis(n.iso, heute), wt = new Date(n.iso + "T12:00:00Z").toLocaleDateString("de-DE", { timeZone: "UTC", weekday: "long" });
  return { name: g.name, beziehung: g.beziehung || undefined, datum: g.tag + ". " + MONATE[g.monat - 1], in_tagen: tage, heute: tage === 0, wochentag: wt, wird_alt: g.jahr ? n.jahr - g.jahr : undefined };
}


// Geburtstage aus dem Google-Kalender ("Geburtstage" aus den Kontakten): nur lesen. Gibt [] zurueck, wenn nicht verbunden.
function kalName(e) { const t = String(e.summary || "").trim(); let m; if ((m = t.match(/^(.*?)['’]?s?\s+(?:Geburtstag|birthday)$/i))) return m[1].trim() || t; if ((m = t.match(/^(?:Geburtstag|birthday)\s+(?:von|of)\s+(.*)$/i))) return m[1].trim(); return t; }
async function ausKalender(heute, tage, suche) {
  try {
    const kals = await Gg.api("/users/me/calendarList?minAccessRole=reader&maxResults=20"); if (!kals) return [];
    const bis = Kal.plusTage(heute, tage), out = [];
    for (const k of (kals.items || []).filter(k => /contacts@group\.v\.calendar\.google\.com$/.test(k.id) || /geburtstag|birthday/i.test(k.summary || "")).slice(0, 2)) {
      const q = new URLSearchParams({ timeMin: heute + "T00:00:00Z", timeMax: bis + "T23:59:59Z", singleEvents: "true", orderBy: "startTime", maxResults: "250" }); if (suche) q.set("q", suche);
      const r = await Gg.api("/calendars/" + encodeURIComponent(k.id) + "/events?" + q.toString());
      for (const e of (r.items || [])) { const d = e.start && e.start.date; if (!d || e.status === "cancelled") continue; const m = d.match(/^(\d{4})-(\d{2})-(\d{2})$/); out.push({ name: kalName(e).slice(0, 60), tag: +m[3], monat: +m[2], quelle: "Kalender", iso: d }); }
    }
    return out;
  } catch (e) { return []; }
}
const gleicherName = (a, b) => { const x = norm(a), y = norm(b); return x === y || x.includes(y) || y.includes(x); };

async function geburtstag(a) {
  const heute = Kal.heute(), l = await laden(), name = String(a.name || "").trim();
  const finden = t => { const x = norm(t); const g = l.filter(e => norm(e.name) === x); return g.length ? g : l.filter(e => norm(e.name).includes(x) || x.includes(norm(e.name))); };
  switch (a.aktion) {
    case "merken": {
      if (!name) return { ok: false, hinweis: "Es fehlt, wessen Geburtstag. Nachfragen." };
      const d = datumLesen(a.datum); if (!d) return { ok: false, hinweis: "Das Datum habe ich nicht verstanden. Nach Tag und Monat fragen (das Jahr ist optional, mit Jahr weiß Atlas das Alter)." };
      const alt = l.find(e => norm(e.name) === norm(name)), neu = { name: alt ? alt.name : name.slice(0, 60), tag: d.tag, monat: d.monat, jahr: d.jahr || (alt && alt.jahr) || undefined, beziehung: a.beziehung ? String(a.beziehung).slice(0, 40) : (alt && alt.beziehung) || undefined };
      if (alt) Object.assign(alt, neu); else l.push(neu);
      await sichern(l); return { ok: true, gemerkt: anzeige(neu, heute), aktualisiert: !!alt };
    }
    case "zeigen": {
      const mitName = !!name, kal = await ausKalender(heute, mitName ? 366 : 60, mitName ? name : "");
      const eigene = (mitName ? finden(name) : l).map(x => anzeige(x, heute));
      const ausKal = kal.filter(k => (!mitName || gleicherName(k.name, name)) && !l.some(x => gleicherName(x.name, k.name))).map(k => { const t = tageBis(k.iso, heute); return { name: k.name, quelle: "Kalender", datum: k.tag + ". " + MONATE[k.monat - 1], in_tagen: t, heute: t === 0, wochentag: new Date(k.iso + "T12:00:00Z").toLocaleDateString("de-DE", { timeZone: "UTC", weekday: "long" }) }; });
      const gesehen = new Set(), alle = eigene.concat(ausKal).filter(x => { const k = norm(x.name); if (gesehen.has(k)) return false; gesehen.add(k); return true; }).sort((x, y) => x.in_tagen - y.in_tagen);
      if (!alle.length) return { ok: true, geburtstage: [], hinweis: mitName ? "Von '" + name + "' ist kein Geburtstag gespeichert (auch nicht im Google-Kalender). Fragen, ob Atlas ihn sich merken soll, wenn Sam das Datum nennt." : "Es sind noch keine Geburtstage gespeichert und im Kalender stehen in den nächsten 60 Tagen keine. Sam sagen, dass er sie einfach nennen kann (zum Beispiel 'Finny hat am 3. März Geburtstag')." };
      if (mitName) return { ok: true, geburtstage: alle, hinweis: "Für einen Glückwunsch-Entwurf: kurzer, herzlicher Text in Sams Stil, passend zur Beziehung (wird_alt nennen, wenn bekannt). Nichts wird gesendet, Sam kopiert den Text selbst. Verwandtschaft oder Beziehung nur nennen, wenn im Eintrag das Feld beziehung steht; sonst nur den Namen nennen und nichts dazu erfinden (kein Sohn, keine Frau, kein Kollege). Steht ein Eintrag für Sam selbst (gleicher Vorname), ist das sein eigener Geburtstag. Das Jahr nicht mitsprechen, nur Tag und Monat." };
      const n = Math.min(10, Math.max(1, +a.anzahl || 5));
      return { ok: true, geburtstage: alle.slice(0, n), gesamt: alle.length, hinweis: (alle[0].heute ? "Heute hat jemand Geburtstag: zuerst nennen." : "") + " Verwandtschaft oder Beziehung nur nennen, wenn im Eintrag das Feld beziehung steht; sonst nur den Namen nennen und nichts dazu erfinden (kein Sohn, keine Frau, kein Kollege). Steht ein Eintrag für Sam selbst (gleicher Vorname), ist das sein eigener Geburtstag. Das Jahr nicht mitsprechen, nur Tag und Monat." };
    }
    case "loeschen": {
      if (!name) return { ok: false, hinweis: "Es fehlt, wessen Geburtstag gelöscht werden soll. Nachfragen." };
      const g = finden(name); if (!g.length) return { ok: false, hinweis: "Von '" + name + "' ist kein Geburtstag gespeichert." };
      if (g.length > 1) return { ok: false, mehrdeutig: true, treffer: g.map(x => x.name), hinweis: "Mehrere passen. Nachfragen, welcher gemeint ist." };
      if (!a.bestaetigt) return { ok: false, bestaetigung_noetig: true, gefunden: anzeige(g[0], heute), hinweis: "Sam fragen, ob der Geburtstag von " + g[0].name + " gelöscht werden soll. Erst nach Ja mit bestaetigt:true erneut aufrufen." };
      await sichern(l.filter(x => x !== g[0])); return { ok: true, geloescht: g[0].name };
    }
    default: return { ok: false, hinweis: "Unbekannte Aktion. Erlaubt: merken, zeigen, loeschen." };
  }
}
module.exports = { geburtstag, datumLesen, naechster };
