"use strict";
// Termin-Finder: freie Zeitfenster aus Schichtplan (Abfahrt bis Schichtende) und Google-Kalender (Termine mit Uhrzeit).
const Kal = require("./_kalender.js");
const P = require("./_plan.js");
const TAGE = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const FENSTER = { vormittag: ["08:00", "12:00"], nachmittag: ["12:00", "17:00"], abend: ["17:00", "21:00"], tags: ["08:00", "20:00"] };
const hm = m => String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
const uhr = s => /^\d{1,2}:\d{2}$/.test(String(s || "")) ? P.minuten(String(s).padStart(5, "0")) : null;
function belegt(liste, iso) { // Termine mit Uhrzeit als Minutenbereiche des Tages
  const out = [];
  for (const e of liste) {
    const b = e.start && e.start.dateTime, en = e.end && e.end.dateTime; if (!b || !en) continue;
    const t0 = b.slice(0, 10), t1 = en.slice(0, 10); if (t0 > iso || t1 < iso) continue;
    out.push({ von: t0 < iso ? 0 : P.minuten(b.slice(11, 16)), bis: t1 > iso ? 1440 : P.minuten(en.slice(11, 16)), titel: e.summary || "Termin" });
  }
  return out;
}
async function finder(a) {
  const dauer = Math.min(600, Math.max(15, Number(a.dauer_minuten) || 60));
  const heute = Kal.heute(), von = /^\d{4}-\d{2}-\d{2}$/.test(a.von || "") ? a.von : heute; let bis = /^\d{4}-\d{2}-\d{2}$/.test(a.bis || "") ? a.bis : Kal.plusTage(von, 6);
  if (bis < von) bis = von; if (Kal.plusTage(von, 13) < bis) bis = Kal.plusTage(von, 13);
  const f = FENSTER[a.tageszeit] || FENSTER.tags; const ab = uhr(a.ab_uhrzeit) ?? P.minuten(f[0]), spaetestens = uhr(a.bis_uhrzeit) ?? P.minuten(f[1]);
  if (spaetestens - ab < dauer) return { ok: false, hinweis: "Das Zeitfenster ist kürzer als die gewünschte Dauer. Nachfragen." };
  const liste = await Kal.liste(von, bis); if (!liste) return require("./_google.js").NICHT_VERBUNDEN;
  const jetzt = new Date().toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" }), jm = P.minuten(jetzt);
  const tage = []; let nSchicht = 0;
  for (let iso = von; iso <= bis; iso = Kal.plusTage(iso, 1)) {
    const sperr = belegt(liste, iso).map(x => ({ von: Math.max(0, x.von - 10), bis: Math.min(1440, x.bis + 10), grund: x.titel }));
    const info = await P.tagInfo(iso).catch(() => null); let schicht = null;
    if (info && info.zeiten) { schicht = info.art; sperr.push({ von: P.minuten(info.zeiten.abfahrt), bis: P.minuten(info.zeiten.ende) + 30, grund: info.art }); nSchicht++; }
    sperr.sort((x, y) => x.von - y.von);
    let start = iso === heute ? Math.max(ab, Math.ceil((jm + 15) / 15) * 15) : ab; const frei = [];
    for (const s of sperr.concat([{ von: spaetestens, bis: spaetestens }])) {
      const ende = Math.min(s.von, spaetestens); if (ende - start >= dauer) frei.push({ von: hm(start), bis: hm(ende), minuten: ende - start });
      start = Math.max(start, Math.ceil(s.bis / 5) * 5);
    }
    if (frei.length) tage.push({ datum: iso, tag: TAGE[new Date(iso + "T12:00:00Z").getUTCDay()], schicht: schicht || undefined, frei: frei.slice(0, 3) });
  }
  const anzahl = tage.reduce((n, t) => n + t.frei.length, 0);
  return { ok: true, von, bis, dauer_minuten: dauer, tage: tage.slice(0, 8), anzahl_fenster: anzahl, schicht_unbekannt: nSchicht === 0 ? true : undefined,
    hinweis: anzahl ? "Nenne die 2 bis 3 besten Möglichkeiten gesprochen, nicht alle. Die Fenster halten 10 Minuten Abstand zu Terminen und sind ohne Schicht samt Abfahrt und 30 Minuten nach Schichtende gerechnet. Der Kalender enthält Termine der ganzen Familie: sage, dass Termine von anderen mitgerechnet sind. Danach fragen, ob ein Termin eingetragen werden soll (nicht von selbst eintragen)." : "In diesem Zeitraum ist nichts Passendes frei. Ehrlich sagen und anbieten, kürzer oder zu anderer Tageszeit oder später zu suchen." + (nSchicht === 0 ? " Die Schicht ist nicht gesetzt: darauf hinweisen." : "") };
}
module.exports = { finder };
