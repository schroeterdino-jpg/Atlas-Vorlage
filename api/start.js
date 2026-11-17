"use strict";
// Daten fuer die Kacheln der Startseite: Termine heute, Wetter, guenstigster Sprit, naechste guenstige Tankstelle.
const { tor } = require("./_tor.js");
const W = require("./_werkzeuge.js");
const Kal = require("./_kalender.js");
const L = require("./_listen.js");
const P = require("./_plan.js");

const ok = r => r.status === "fulfilled" && r.value && r.value.ok ? r.value : null;
const hm = () => new Date().toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" });

function termineKachel(e) {
  if (!e) return { fehler: true };
  const jetzt = Kal.heute() + "T" + hm();
  const l = (e.termine || []).filter(t => t.ganztag || !t.ende || t.ende >= jetzt);
  return { anzahl: l.length, zeilen: l.slice(0, 2).map(t => (t.ganztag ? "ganztägig" : String(t.beginn).slice(11, 16)) + " " + t.titel) };
}
function wetterKachel(w) {
  if (!w) return { fehler: true };
  const a = w.aktuell || {}, em = w.empfehlung || {};
  return { temperatur: a.temperatur != null ? Math.round(a.temperatur) : null, text: a.wetter || "", schirm: !!em.schirm, regen_ab: em.regen_ab ? String(em.regen_ab).slice(11, 16) : null, warnung: !!(w.warnungen && w.warnungen.length) };
}
function preis(e, sorte) { const o = e && e.orte && e.orte[0]; return o && o.preise && o.preise[sorte] ? { preis: o.preise[sorte], name: o.name, entfernung: o.entfernung } : null; }

function notizKachel(n) {
  if (!n) return { fehler: true };
  const l = n.notizen || []; if (!l.length) return { anzahl: 0, zeilen: [] };
  return { anzahl: n.gefunden || l.length, zeilen: l.slice(0, 2).map(x => String(x.titel || String(x.text).split("\n")[0]).slice(0, 26)) };
}
// Wann die App den Heimweg-Hinweis zeigen soll: 10 Minuten vor Schichtende, naechste 8 Tage (nur Arbeitstage)
async function heimwegZeiten() {
  const out = [], h = Kal.heute(), jetzt = new Date().toLocaleString("sv-SE", { timeZone: "Europe/Berlin" }).replace(" ", "T").slice(0, 16);
  for (let i = 0; i < 8; i++) {
    const d = Kal.plusTage(h, i), t = await P.tagInfo(d).catch(() => null);
    if (!t || !t.zeiten || !t.zeiten.ende) continue;
    const z = d + "T" + P.hm(P.minuten(t.zeiten.ende) - 10);
    if (z > jetzt) out.push({ zeit: z, art: t.art });
  }
  return out;
}
async function briefingZeiten() {
  const out = [], h = Kal.heute(), jetzt = new Date().toLocaleString("sv-SE", { timeZone: "Europe/Berlin" }).replace(" ", "T").slice(0, 16);
  for (let i = 0; i < 8; i++) {
    const d = Kal.plusTage(h, i), t = await P.tagInfo(d).catch(() => null);
    if (!t || !t.zeiten || !t.zeiten.briefing || !t.zeiten.abfahrt) continue;
    const z = d + "T" + t.zeiten.briefing;
    if (z > jetzt) out.push({ zeit: z, art: t.art });
    const ab = P.minuten(t.zeiten.abfahrt) - 20, lz = d + "T" + String(Math.floor(ab / 60)).padStart(2, "0") + ":" + String(ab % 60).padStart(2, "0"); // 20 Minuten vor Abfahrt: Verkehr pruefen
    if (ab > 0 && lz > jetzt) out.push({ zeit: lz, art: t.art, typ: "los" });
  }
  return out;
}
module.exports = async function handler(req, res) {
  const b = await tor(req, res); if (!b) return;
  try {
    if (b.aktion) { // Antippen in den Listen-Kacheln: abhaken/zurueck oder neuen Eintrag
      const name = b.liste === "mitnehmen" ? "mitnehmen" : "einkauf";
      if (b.aktion === "umschalten") { if (typeof b.id !== "string" || b.id.length > 40) return res.status(400).json({ ok: false }); await L.umschalten(name, b.id, !!b.erledigt); }
      else if (b.aktion === "erinnerung_weg") { if (typeof b.id !== "string" || b.id.length > 40) return res.status(400).json({ ok: false }); await L.erinnerungWeg(b.id); return res.status(200).json({ ok: true, erinnerungen: await L.erinnerungsKachel(), app: await L.appListe() }); }
      else if (b.aktion === "aufraeumen") await L.aufraeumen(name);
      else if (b.aktion === "hinzu") { const t = String(b.text || "").trim().slice(0, 200); if (!t) return res.status(400).json({ ok: false }); await L.liste(name, { aktion: "hinzufuegen", eintraege: [t], trotzdem: true }); }
      else return res.status(400).json({ ok: false });
      return res.status(200).json({ ok: true, daten: await L.kachelDaten(name) });
    }
    const s = b.standort && isFinite(b.standort.lat) && isFinite(b.standort.lon) ? { lat: +b.standort.lat, lon: +b.standort.lon } : null, ctx = { standort: s };
    const sprit = k => W.ausfuehren("in_der_naehe", { art: "Tankstelle", kraftstoff: k, guenstigste: true }, ctx);
    const [t, w, d, e10, e5, nz] = await Promise.allSettled([W.ausfuehren("termine", {}, ctx), W.ausfuehren("wetter", {}, ctx), sprit("diesel"), sprit("e10"), sprit("e5"), W.ausfuehren("notiz", { aktion: "zeigen", anzahl: 2 }, ctx)]);
    const liste = n => L.kachelDaten(n).catch(() => ({ fehler: true }));
    const [ek, mn] = await Promise.all([liste("einkauf"), liste("mitnehmen")]);
    const D = ok(d), E10 = ok(e10), E5 = ok(e5);
    const tank = preis(D, "diesel");
    res.status(200).json({
      ok: true, termine: termineKachel(ok(t)), wetter: wetterKachel(ok(w)),
      sprit: tank || preis(E10, "e10") || preis(E5, "e5") ? { diesel: tank, e10: preis(E10, "e10"), e5: preis(E5, "e5") } : { fehler: true },
      notizen: notizKachel(ok(nz)), einkauf: ek, mitnehmen: mn,
      tanken: tank ? { name: tank.name, entfernung: tank.entfernung, preis: tank.preis } : { fehler: true },
      erinnerungen: await L.appListe().catch(() => null),
      heimweg: await heimwegZeiten().catch(() => null),
      briefing: await briefingZeiten().catch(() => null),
      erinnerungsliste: await L.erinnerungsKachel().catch(() => ({ fehler: true }))
    });
  } catch (e) { res.status(200).json({ ok: false, fehler: String(e.message || e).slice(0, 200) }); }
};
