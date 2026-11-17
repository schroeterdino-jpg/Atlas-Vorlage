"use strict";
// "Was steht an": Tagesueberblick aus Schicht, Terminen, Wetter, Aufgaben, Erinnerungen, Geburtstagen und Feiertagen.
const Kal = require("./_kalender.js");
const Pu = require("./_profil.js");
const P = require("./_plan.js");
const Wx = require("./_wetter.js");
const L = require("./_listen.js");
const Ge = require("./_geburtstage.js");
const Fe = require("./_feiertage.js");
const Fa = require("./_fahrt.js");
const Na = require("./_nachrichten.js");
const Ab = require("./_autobahn.js");
const frist = (p, ms) => Promise.race([p, new Promise(r => setTimeout(() => r(null), ms))]).catch(() => null);

const wert = r => (r.status === "fulfilled" ? r.value : null);
async function ueberblick(a, ctx) {
  const heute = Kal.heute(), iso = /^\d{4}-\d{2}-\d{2}$/.test(a.datum || "") ? a.datum : heute, plus = Math.round((Date.parse(iso + "T12:00:00Z") - Date.parse(heute + "T12:00:00Z")) / 86400000);
  const [schicht, termine, wetter, aufgaben, erinn, geb, fei] = (await Promise.allSettled([
    P.tagInfo(iso), Kal.termine({ von: iso, bis: iso }), plus >= 0 && plus <= 6 ? Wx.wetter({}) : Promise.resolve(null), L.liste("aufgaben", { aktion: "zeigen" }), L.erinnerung({ aktion: "zeigen" }),
    Ge.geburtstag({ aktion: "zeigen", anzahl: 3 }), Fe.feiertage({ art: "beides", von: iso, bis: Kal.plusTage(iso, 7), anzahl: 3 })])).map(wert);
  const out = { ok: true, datum: iso, tag: plus === 0 ? "heute" : plus === 1 ? "morgen" : iso, fehlt: [] };
  const jetztHM = /^\d{1,2}:\d{2}$/.test(a.jetzt || "") ? a.jetzt.padStart(5, "0") : new Date().toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" }), jm = P.minuten(jetztHM);
  if (schicht && schicht.zeiten) {
    const z = schicht.zeiten; out.schicht = { art: schicht.art, beginn: z.beginn, ende: z.ende };
    if (plus === 0) { // Uhrzeit beachten: Vergangenes nicht mehr als Aufgabe nennen
      const ab = P.minuten(z.abfahrt), be = P.minuten(z.beginn), en = P.minuten(z.ende);
      if (jm < ab) { out.schicht.stand = "noch_nicht_losgefahren"; out.schicht.abfahrt = z.abfahrt; out.schicht.ankunft = z.ankunft; }
      else if (jm < be) { out.schicht.stand = "unterwegs_oder_vor_arbeitsbeginn"; }
      else if (jm < en) { out.schicht.stand = "auf_der_arbeit"; out.schicht.noch_bis_ende_min = en - jm; }
      else { out.schicht.stand = "schicht_vorbei"; }
    } else { out.schicht.abfahrt = z.abfahrt; out.schicht.ankunft = z.ankunft; }
    out.schicht.beginn = out.schicht.stand === "auf_der_arbeit" || out.schicht.stand === "schicht_vorbei" ? undefined : z.beginn;
    out.schicht.ende = out.schicht.stand === "schicht_vorbei" ? undefined : z.ende;
    if (out.termine) { /* unten gesetzt */ }
  } else if (schicht) out.schicht = { art: schicht.art, hinweis: "keine Arbeitsfahrt" }; else out.fehlt.push("Schicht (noch nicht gesetzt)");
  if (termine && termine.ok) { const jetzt = heute + "T" + new Date().toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" }); out.termine = (termine.termine || []).filter(t => plus !== 0 || t.ganztag || !t.ende || t.ende >= jetzt).map(t => ({ titel: t.titel, zeit: t.ganztag ? "ganztägig" : String(t.beginn).slice(11, 16), ort: t.ort, aus_kalender: t.eigener_kalender === false ? t.kalender : undefined })); } else out.fehlt.push("Termine (Kalender nicht verbunden oder nicht erreichbar)");
  if (wetter && wetter.ok) { const t = wetter.tage && wetter.tage[plus]; out.wetter = plus === 0 ? { jetzt: wetter.aktuell && wetter.aktuell.temperatur, text: wetter.aktuell && wetter.aktuell.wetter, max: t && t.max, min: t && t.min, schirm: wetter.empfehlung && wetter.empfehlung.schirm, regen_ab: wetter.empfehlung && wetter.empfehlung.regen_ab ? String(wetter.empfehlung.regen_ab).slice(11, 16) : undefined, warnungen: wetter.warnungen && wetter.warnungen.length ? wetter.warnungen.map(w => w.titel) : undefined } : { text: t && t.wetter, max: t && t.max, min: t && t.min }; } else if (plus >= 0 && plus <= 6) out.fehlt.push("Wetter");
  if (aufgaben && aufgaben.ok) { const f = (aufgaben.offen || []).filter(x => !x.faellig || x.faellig <= iso); out.aufgaben = f.slice(0, 5).map(x => x.text + (x.faellig ? " (fällig " + x.faellig.slice(5).split("-").reverse().join(".") + ")" : "")); out.aufgaben_gesamt_offen = (aufgaben.offen || []).length; }
  if (erinn && erinn.ok) out.erinnerungen = (erinn.offen || []).filter(x => String(x.zeit || "").slice(0, 10) <= iso).slice(0, 5).map(x => ({ text: x.text, zeit: String(x.zeit || "").slice(11, 16), ueberfaellig: x.zeit && x.zeit < heute + "T00:00" ? true : undefined }));
  if (geb && geb.ok) { const g = geb.geburtstage.filter(x => x.in_tagen <= plus + 3 && x.in_tagen >= plus); if (g.length) out.geburtstage = g.map(x => ({ name: x.name, datum: x.datum, in_tagen: x.in_tagen - plus, beziehung: x.beziehung })); }
  if (fei && fei.ok) { const f = fei.eintraege.filter(x => x.datum <= iso && (x.bis || x.datum) >= iso); if (f.length) out.feiertag_oder_ferien = f.map(x => x.name + (x.art === "Ferien" ? " (Schulferien)" : "")); const n = fei.eintraege.find(x => x.art === "Feiertag" && x.datum > iso && x.in_tagen - plus <= 3); if (n) out.bald_feiertag = n.name + " am " + n.text; }
  if (a.briefing && plus === 0) { // Morgen-Briefing: Fahrt zur Arbeit oder Heimweg mit Stau, dazu eine Nachrichtenzeile (je max. 9 s, sonst weglassen)
    const st = out.schicht && out.schicht.stand, [fa, nw] = await Promise.all([
      out.schicht && out.schicht.art && !out.schicht.hinweis && st !== "schicht_vorbei" ? (st === "auf_der_arbeit" ? (out.schicht.noch_bis_ende_min <= 90 ? frist(Fa.strecke("arbeit", "heim"), 9000).then(f => f && f.ok ? { art: "heim", f } : null) : Promise.resolve(null)) : frist(Fa.abfahrt({}), 9000).then(f => f && f.ok && f.fahrzeit_jetzt_min ? { art: "arbeit", f } : null)) : Promise.resolve(null),
      frist(Na.nachrichten({ ebene: "deutschland" }), 9000)]);
    if (fa) { const f = fa.f, stau = f.staus && f.staus.length ? f.staus[0] : null; out.fahrt = { art: fa.art, minuten: fa.art === "arbeit" ? f.fahrzeit_jetzt_min : f.minuten, normal: fa.art === "arbeit" ? f.fahrzeit_normal_min : f.normal_minuten, stau: stau ? String(stau.satz || stau.strasse || "Stau").slice(0, 80) : undefined, empfehlung: f.empfehlung, abfahrt: f.abfahrt }; }
    if (fa && fa.f.karte && fa.f.karte.punkte) { const ab = await frist(Ab.aufStrecke(fa.f.karte.punkte), 8000); if (ab && ab.ok && ab.sperrungen.length) out.autobahn_sperrung = ab.sperrungen.slice(0, 2).map(x => x.strasse + (x.ort ? " " + x.ort : "")).join("; "); }
    const n1 = nw && nw.ok && nw.ebenen && (nw.ebenen.deutschland || [])[0]; if (n1) out.nachricht = String(n1.kurz || n1.titel).slice(0, 120);
  }
  if (a.briefing && plus === 0) { // fertigen Text bauen: die KI liest ihn nur vor und kann nichts falsch deuten
    const std = Number(jetztHM.slice(0, 2)), gruss = std < 11 ? "Guten Morgen" : std < 17 ? "Guten Tag" : "Guten Abend", T = [gruss + ((await Pu.laden()).name ? ", " + (await Pu.laden()).name : "") + "."], sc = out.schicht, stand = sc && sc.stand;
    try { const m = await P.tagInfo(Kal.plusTage(iso, 1)); if (stand === "schicht_vorbei" && m && m.zeiten) { out.morgen = { art: m.art, aufstehen: m.zeiten.aufstehen, abfahrt: m.zeiten.abfahrt }; } } catch (e) {}
    if (sc && sc.art && !sc.hinweis) {
      if (stand === "noch_nicht_losgefahren") T.push("Du hast heute " + sc.art + ", Abfahrt um " + sc.abfahrt + " Uhr.");
      else if (stand === "unterwegs_oder_vor_arbeitsbeginn") T.push("Gleich beginnt deine " + sc.art + ".");
      else if (stand === "auf_der_arbeit") T.push("Du bist bei der Arbeit, Feierabend ist um " + sc.ende + " Uhr.");
    }
    if (out.fahrt) { const f = out.fahrt, plusm = f.normal ? f.minuten - f.normal : 0; T.push((f.art === "heim" ? "Der Heimweg dauert " : "Die Fahrt zur Arbeit dauert ") + "etwa " + f.minuten + " Minuten" + (plusm >= 5 ? ", " + plusm + " Minuten länger als sonst" : ", der Verkehr ist frei") + "." + (f.stau ? " Achtung, Stau: " + f.stau + "." : "") + (f.empfehlung && /fr(ü|ue)her|Achtung/.test(f.empfehlung) ? " Du solltest früher losfahren." : "")); }
    if (out.autobahn_sperrung) T.push("Achtung, Sperrung auf der Autobahn: " + out.autobahn_sperrung + ".");
    if (out.wetter) { const w = out.wetter, g = w.jetzt != null ? Math.round(w.jetzt) : w.max != null ? Math.round(w.max) : null; T.push("Draußen" + (g != null ? " sind es " + g + " Grad" : "") + (w.text ? ", " + w.text : "") + "." + (w.schirm ? " Nimm einen Schirm mit." : "")); }
    if (out.termine && out.termine.length) T.push("Termine: " + out.termine.slice(0, 3).map(t => t.titel + (t.zeit && t.zeit !== "ganztägig" ? " um " + t.zeit + " Uhr" : "")).join(", ") + ".");
    if (out.erinnerungen && out.erinnerungen.length) T.push("Erinnerung: " + out.erinnerungen.slice(0, 2).map(e => e.text + (e.zeit ? " um " + e.zeit + " Uhr" : "")).join(", ") + ".");
    if (out.morgen) T.push("Morgen hast du " + out.morgen.art + (out.morgen.aufstehen ? ", aufstehen um " + out.morgen.aufstehen + " Uhr" : "") + (out.morgen.abfahrt ? ", Abfahrt um " + out.morgen.abfahrt + " Uhr" : "") + ".");
    if (out.nachricht) T.push("Aus den Nachrichten: " + out.nachricht + ".");
    if (T.length === 1) T.push("Heute liegt nichts Besonderes an.");
    out.vorlesen = T.join(" ");
  }
  if (!out.fehlt.length) delete out.fehlt;
  out.hinweis = a.briefing && out.vorlesen ? "BRIEFING: Lies den Text in 'vorlesen' WORTGETREU vor, ohne etwas hinzuzufügen, wegzulassen oder umzudeuten (er ist schon richtig auf die Uhrzeit abgestimmt). Alles andere in diesem Ergebnis ignorieren, besonders morgen, fahrt und schicht nicht selbst deuten." : ((a.briefing ? "BRIEFING: freundlich begrüßen, dann in dieser Reihenfolge kurz sagen: Abfahrt und Fahrt (fahrt: Minuten, Stau, empfehlung - ob früher losfahren), Wetter, Termine/Erinnerungen, zuletzt die Nachricht (nachricht). Nichts erfinden. Was schon vorbei ist (Schicht beendet, Heimfahrt erledigt) NICHT erwähnen: Sam ist dann längst zu Hause. Denke mit: nenne nur, was jetzt noch nützlich ist. " : "") + "Gib einen kurzen, gesprochenen Tagesüberblick, das Wichtigste zuerst (Schicht und Abfahrt, Termine, Wetter wenn Schirm/Jacke oder Warnung nötig, fällige Erinnerungen, Geburtstage). Leere Bereiche weglassen, nichts erfinden. Berücksichtige die Uhrzeit: schicht.stand sagt, wo Sam gerade ist (auf_der_arbeit: nicht mehr sagen, wann er losfahren muss, nur dass er auf der Arbeit ist und wie lange noch; schicht_vorbei: Feierabend). Termine im Kalender gehören oft zur ganzen Familie: nicht annehmen, dass es Sams eigene Termine sind, und keinen Konflikt mit der Arbeitszeit melden. Schicht-Zeiten, die schon vorbei sind, nicht als Aufgabe nennen." + (out.fehlt ? " Nicht verfügbar: " + out.fehlt.join(", ") + ". Das kurz ehrlich sagen." : "") + " Beziehungen nur nennen, wenn im Eintrag beziehung steht. Jahr nicht mitsprechen.");
  return out;
}
module.exports = { ueberblick };
