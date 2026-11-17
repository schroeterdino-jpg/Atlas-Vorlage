"use strict";
// Schichtplan und Urlaub. Alles liegt in Atlas' Datenbank (Redis, Eintrag atlas:plan), nichts fest im Code ausser den Startwerten.
const K = require("./_keys.js");
const Gg = require("./_google.js");
const Kal = require("./_kalender.js");
const WOCHENTAG = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
const NAME = { frueh: "Frühschicht", spaet: "Spätschicht" };
const REF_MONTAG = Date.UTC(2024, 0, 1), WOCHE = 7 * 86400000;
// Startwerte (von Sam genannt); jederzeit per Sprache aenderbar
const STANDARD = {
  frueh: { aufstehen: "03:45", briefing: "04:20", abfahrt: "04:30", ankunft: "04:50", beginn: "05:10", ende: "13:37", pausen: ["07:30-07:50", "11:30-12:00"] },
  spaet: { briefing: "12:45", abfahrt: "12:45", ankunft: "13:25", beginn: "13:45", ende: "22:12", pausen: ["15:45-16:05", "18:00-18:30"] }
};
const FELDER = ["aufstehen", "briefing", "abfahrt", "ankunft", "beginn", "ende", "pausen"];
const ymd = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || "")) && !isNaN(new Date(s + "T12:00:00Z"));
const wochenNr = iso => { const t = Date.parse(iso + "T00:00:00Z"), dow = (new Date(t).getUTCDay() + 6) % 7; return Math.round((t - dow * 86400000 - REF_MONTAG) / WOCHE); };
const dow = iso => new Date(iso + "T12:00:00Z").getUTCDay();
const lesbar = iso => WOCHENTAG[dow(iso)] + ", " + iso.slice(8) + "." + iso.slice(5, 7) + ".";

async function laden(feld, leer) { const r = await K.redis(["HGET", "atlas:plan", feld]); if (!r) return leer; try { return JSON.parse(r); } catch (e) { throw new Error("Plan-Daten " + feld + " sind beschädigt"); } }
async function sichern(feld, w) { await K.redis(["HSET", "atlas:plan", feld, JSON.stringify(w)]); }
const zeiten = s => ({ frueh: Object.assign({}, STANDARD.frueh, (s && s.zeiten && s.zeiten.frueh) || {}), spaet: Object.assign({}, STANDARD.spaet, (s && s.zeiten && s.zeiten.spaet) || {}) });
function schichtDerWoche(s, iso) { const gleich = (((wochenNr(iso) - s.base) % 2) + 2) % 2 === 0; return gleich ? s.shift : (s.shift === "frueh" ? "spaet" : "frueh"); }
function imUrlaub(urlaube, iso) { const d = dow(iso); return (urlaube || []).find(u => u.von <= iso && iso <= u.bis && !(u.ohne_we && (d === 0 || d === 6))); }

const hm = m => String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0"), minuten = t => +t.slice(0, 2) * 60 + +t.slice(3, 5);
// Ausnahme fuer einen Tag ("frueher los"): Beginn, Ankunft und Abfahrt rutschen um 'vor' Minuten nach vorn
function mitAusnahme(z, ausn) { if (!ausn || !ausn.vor) return z; const n = Object.assign({}, z); for (const f of ["abfahrt", "ankunft", "beginn"]) if (n[f]) n[f] = hm(Math.max(0, minuten(n[f]) - ausn.vor)); n.ausnahme = "früher: " + ausn.vor + " Minuten"; return n; }
async function tag(s, urlaube, iso, ausnahmen) {
  const d = dow(iso), z = zeiten(s);
  const u = imUrlaub(urlaube, iso);
  if (u) return { datum: iso, wochentag: WOCHENTAG[d], art: u.titel || "Urlaub" };
  if (d === 0 || d === 6) return { datum: iso, wochentag: WOCHENTAG[d], art: "frei (Wochenende)" };
  const k = schichtDerWoche(s, iso);
  return { datum: iso, wochentag: WOCHENTAG[d], art: NAME[k], zeiten: mitAusnahme(z[k], (ausnahmen || {})[iso]) };
}

async function schicht(a) {
  const s = await laden("schicht", null), urlaube = await laden("urlaub", []), ausn = await laden("ausnahmen", {});
  switch (a.aktion) {
    case "festlegen": {
      if (a.schicht !== "frueh" && a.schicht !== "spaet") return { ok: false, hinweis: "Es fehlt, ob Früh- oder Spätschicht. Nachfragen." };
      const naechste = a.woche === "naechste"; const heute = Kal.heute();
      if (!naechste && [0, 6].includes(dow(heute)) && !a.bestaetigt) return { ok: false, mehrdeutig: true, hinweis: "Heute ist Wochenende, die laufende Woche ist fast vorbei. Sam fragen: 'Meinst du die Woche, die gerade zu Ende geht, oder die neue Woche ab Montag?' Dann mit woche 'naechste' (ab Montag) oder 'diese' plus bestaetigt:true wiederholen." };
      const neu = Object.assign({ zeiten: {} }, s || {}, { base: wochenNr(heute) + (naechste ? 1 : 0), shift: a.schicht });
      await sichern("schicht", neu);
      return { ok: true, gespeichert: (naechste ? "Nächste Woche " : "Diese Woche ") + NAME[a.schicht] + ", danach im wöchentlichen Wechsel (Montag ist Wechsel)." };
    }
    case "zeiten_zeigen": return { ok: true, zeiten: zeiten(s), hinweis: s ? "" : "Das sind die Startwerte; die Schicht dieser Woche ist noch nicht gesetzt." };
    case "zeit_setzen": {
      if (a.schicht !== "frueh" && a.schicht !== "spaet") return { ok: false, hinweis: "Früh- oder Spätschicht? Nachfragen." };
      if (!FELDER.includes(a.feld)) return { ok: false, hinweis: "Mögliche Felder: aufstehen, briefing (Uhrzeit des Briefing-Push), abfahrt, ankunft, beginn, ende, pausen. Nachfragen, was geändert werden soll." };
      let w = String(a.wert || "").trim();
      if (a.feld === "pausen") { const p = w.split(/[,;]/).map(x => x.trim()).filter(Boolean); if (!p.length || !p.every(x => /^\d{1,2}:\d{2}-\d{1,2}:\d{2}$/.test(x))) return { ok: false, hinweis: "Pausen als 'HH:MM-HH:MM', mehrere mit Komma. Nachfragen." }; w = p.map(x => x.replace(/(^|-)(\d):/g, "$10$2:")); }
      else { const m = w.match(/^(\d{1,2})[:.]?(\d{2})?$/); if (!m || +m[1] > 23 || +(m[2] || 0) > 59) return { ok: false, hinweis: "Uhrzeit nicht verstanden (HH:MM). Nachfragen." }; w = String(m[1]).padStart(2, "0") + ":" + (m[2] || "00"); }
      const neu = Object.assign({ base: wochenNr(Kal.heute()), shift: a.schicht, zeiten: {} }, s || {}); neu.zeiten = Object.assign({}, neu.zeiten); neu.zeiten[a.schicht] = Object.assign({}, neu.zeiten[a.schicht], { [a.feld]: w });
      if (!s) neu.noch_offen = true;
      await sichern("schicht", neu);
      return { ok: true, gespeichert: NAME[a.schicht] + ": " + a.feld + " " + (Array.isArray(w) ? w.join(", ") : w), hinweis: s ? "" : "Die Schicht dieser Woche ist noch nicht gesetzt: danach fragen." };
    }
    case "abfragen": {
      if (!s || s.noch_offen) return { ok: false, hinweis: "Die Schicht dieser Woche ist noch nicht gesetzt. Sam fragen: 'Welche Schicht hast du diese Woche, früh oder spät?' und dann aktion festlegen." };
      let von = ymd(a.von) ? a.von : Kal.heute(), bis = ymd(a.bis) ? a.bis : von;
      if (Number.isInteger(a.wochen_ab_jetzt)) { const h = Kal.heute(), mo = Kal.plusTage(h, -((dow(h) + 6) % 7)); von = Kal.plusTage(mo, 7 * a.wochen_ab_jetzt); bis = Kal.plusTage(von, 6); } // Kalenderwoche Mo-So: 0 diese, 1 naechste, 2 uebernaechste
      if (bis < von) bis = von; if (Kal.plusTage(von, 60) < bis) bis = Kal.plusTage(von, 60);
      const tage = []; for (let t = von; t <= bis; t = Kal.plusTage(t, 1)) tage.push(await tag(s, urlaube, t, ausn));
      const zus = []; for (const t of tage) { const l = zus[zus.length - 1]; if (l && l.art === t.art) { l.bis = t; } else zus.push({ art: t.art, von: t, bis: t }); }
      return { ok: true, zusammenfassung: zus.map(z => (z.von === z.bis ? lesbar(z.von.datum) : lesbar(z.von.datum) + " bis " + lesbar(z.bis.datum)) + ": " + z.art), tage: tage.length > 14 ? tage.filter(t => t.art !== "frei (Wochenende)") : tage, hinweis: "Wochentage und Daten genau aus 'zusammenfassung' übernehmen, nicht selbst nachrechnen." };
    }
  }
  return { ok: false, hinweis: "Unbekannte Aktion. Möglich: abfragen, festlegen, zeiten_zeigen, zeit_setzen." };
}

// Kalendereintraege fuer einen Zeitraum: am Stueck, oder je Woche Mo-Fr (ohne Wochenende)
function bloecke(von, bis, ohneWe) {
  if (!ohneWe) return [[von, bis]];
  const out = []; let t = von;
  while (t <= bis) { const d = dow(t); if (d === 0 || d === 6) { t = Kal.plusTage(t, 1); continue; } let e = t; while (e < bis && ![0, 6].includes(dow(Kal.plusTage(e, 1)))) e = Kal.plusTage(e, 1); out.push([t, e]); t = Kal.plusTage(e, 1); }
  return out;
}
async function kalenderLoeschen(u) { for (const k of (u.kids || (u.kid ? [u.kid] : []))) await Gg.api("/calendars/primary/events/" + encodeURIComponent(k), { method: "DELETE" }).catch(() => {}); }
async function urlaub(a) {
  let l = await laden("urlaub", []); const heute = Kal.heute();
  const aktuell = l.filter(u => u.bis >= heute).sort((x, y) => x.von.localeCompare(y.von));
  switch (a.aktion) {
    case "abfragen": return { ok: true, urlaub: aktuell.map(u => ({ was: u.titel || "Urlaub", ohne_wochenende: !!u.ohne_we, von: u.von, bis: u.bis, von_lesbar: lesbar(u.von), bis_lesbar: lesbar(u.bis) })), hinweis: aktuell.length ? "" : "Kein Urlaub eingetragen." };
    case "eintragen": {
      if (!ymd(a.von) || !ymd(a.bis)) return { ok: false, hinweis: "Von- und Bis-Datum (JJJJ-MM-TT) fehlen. Aus Sams Worten ausrechnen oder nachfragen." };
      if (a.bis < a.von) return { ok: false, hinweis: "Das Ende liegt vor dem Anfang. Nachfragen." };
      if (a.von < Kal.plusTage(heute, -1)) return { ok: false, hinweis: "Das Datum liegt in der Vergangenheit. Nachfragen, ob das Jahr stimmt." };
      if (l.some(u => u.von === a.von && u.bis === a.bis)) return { ok: true, hinweis: "Dieser Urlaub ist schon eingetragen." };
      const ueber = l.filter(u => u.von <= a.bis && a.von <= u.bis);
      if (ueber.length && !a.bestaetigt) return { ok: false, bestaetigung_noetig: true, ueberschneidet: ueber.map(u => ({ von: u.von, bis: u.bis })), hinweis: "Überschneidet sich mit eingetragenem Urlaub. Sam fragen, ob der alte ersetzt werden soll, dann mit bestaetigt wiederholen." };
      for (const u of ueber) { if (await Gg.verbunden()) await kalenderLoeschen(u); l.splice(l.indexOf(u), 1); }
      const titel = String(a.titel || "").trim().slice(0, 80), neu = { von: a.von, bis: a.bis }; if (titel && titel.toLowerCase() !== "urlaub") neu.titel = titel; if (a.ohne_wochenende) neu.ohne_we = true;
      let kalender = "nicht verbunden";
      if (await Gg.verbunden()) { neu.kids = []; for (const [v, b] of bloecke(a.von, a.bis, neu.ohne_we)) { const e = await Gg.api("/calendars/primary/events", { method: "POST", body: JSON.stringify({ summary: neu.titel || "Urlaub 🌴", start: { date: v }, end: { date: Kal.plusTage(b, 1) }, transparency: "transparent" }) }); if (e && e.id) neu.kids.push(e.id); } kalender = "eingetragen"; }
      l.push(neu); await sichern("urlaub", l);
      return { ok: true, eingetragen: { was: neu.titel || "Urlaub", von: lesbar(a.von), bis: lesbar(a.bis), ohne_wochenende: !!neu.ohne_we }, kalender, hinweis: kalender === "eingetragen" ? "" : "Im Plan gespeichert, aber der Google Kalender ist nicht verbunden." };
    }
    case "beenden": {
      let g = aktuell; if (ymd(a.von)) g = aktuell.filter(u => u.von <= a.von && a.von <= u.bis);
      if (!g.length) return { ok: false, hinweis: "Kein passender Urlaub eingetragen." };
      if (g.length > 1) return { ok: false, mehrdeutig: g.map(u => ({ von: u.von, bis: u.bis })), hinweis: "Mehrere Urlaube eingetragen. Fragen, welcher gemeint ist, dann mit von wiederholen." };
      const u = g[0];
      if (!a.bestaetigt) return { ok: false, bestaetigung_noetig: true, urlaub: { was: u.titel || "Urlaub", von: lesbar(u.von), bis: lesbar(u.bis) }, hinweis: "Sam den Eintrag vorlesen und fragen, ob er gelöscht werden soll. Erst nach Ja mit bestaetigt:true wiederholen." };
      if (await Gg.verbunden()) await kalenderLoeschen(u);
      l.splice(l.indexOf(u), 1); await sichern("urlaub", l);
      return { ok: true, geloescht: { was: u.titel || "Urlaub", von: lesbar(u.von), bis: lesbar(u.bis) } };
    }
  }
  return { ok: false, hinweis: "Unbekannte Aktion. Möglich: eintragen, abfragen, beenden." };
}
// Fuer die Abfahrt: Schichtangaben eines Tages (null = Schicht ist noch nicht gesetzt)
async function tagInfo(iso, roh) { const s = await laden("schicht", null); if (!s || s.noch_offen) return null; return tag(s, await laden("urlaub", []), iso, roh ? {} : await laden("ausnahmen", {})); }
async function ausnahme(iso, vor) { const a = await laden("ausnahmen", {}); if (vor > 0) a[iso] = { vor }; else delete a[iso]; for (const k of Object.keys(a)) if (k < Kal.plusTage(Kal.heute(), -7)) delete a[k]; await sichern("ausnahmen", a); }
module.exports = { schicht, urlaub, schichtDerWoche, wochenNr, tagInfo, ausnahme, minuten, hm, zeiten };
