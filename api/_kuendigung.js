"use strict";
// Kuendigung schreiben: Atlas fragt Anbieter, Vertrag, Nummer und Zeitpunkt ab; der Brief wird aus einer festen Vorlage gebaut (nichts erfunden).
// Die App zeigt ihn zum Aendern, Kopieren und als PDF (Drucken > Als PDF speichern). Es wird nichts verschickt.
const K = require("./_keys.js");
const F = require("./_fahrt.js");
const Pk = require("./_profil.js");
const SLOT = "atlas:kuendigungen", PROFIL = "kuend_profil", MAX = 5;
const MON = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
const meinName = async t => { const pr = await Pk.laden(), n = (pr.name || "").replace(/[^\p{L}]/gu, ""); return !!n && new RegExp(n, "iu").test(String(t || "")); };
const heuteIso = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
const deutsch = iso => { const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? +m[3] + ". " + MON[+m[2] - 1] + " " + m[1] : String(iso); };
const sauber = (t, n) => String(t || "").replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim().slice(0, n || 120);
async function profil() {
  const pr = await Pk.laden();
  const s = { name: (pr.name + " " + pr.nachname).trim(), anschrift: pr.heim, ort: pr.ort };
  try { const r = await K.redis(["HGET", "atlas:plan", PROFIL]); if (r) Object.assign(s, JSON.parse(r)); } catch (e) {}
  try { const adr = (await F.adressenListe()).heim; if (adr && !s.eigene) s.anschrift = adr; } catch (e) {}
  return s;
}
async function liste() { try { const r = await K.redis(["GET", SLOT]); const l = r ? JSON.parse(r) : []; return Array.isArray(l) ? l : []; } catch (e) { return []; } }
const sichern = l => K.redis(["SET", SLOT, JSON.stringify(l.slice(0, MAX))]);

function brief(d, p) {
  const art = d.vertragsart ? " " + d.vertragsart : "";
  let wann;
  if (d.zeitpunkt === "datum") wann = "zum " + deutsch(d.datum) + ", hilfsweise zum nächstmöglichen Zeitpunkt";
  else if (d.zeitpunkt === "ausserordentlich") wann = "außerordentlich und fristlos" + (d.grund ? " aus folgendem Grund: " + d.grund : "") + ", hilfsweise ordentlich zum nächstmöglichen Zeitpunkt";
  else wann = "ordentlich zum nächstmöglichen Zeitpunkt";
  const zeilen = [p.name, p.anschrift.replace(/,\s*/, "\n"), "", d.anbieter, d.anbieter_adresse ? d.anbieter_adresse.replace(/,\s*/g, "\n") : "[Anschrift des Anbieters bitte ergänzen]", "",
    (p.ort ? p.ort + ", den " : "Den ") + deutsch(heuteIso()), "",
    "Kündigung" + art + (d.nummer ? " – Kunden-/Vertragsnummer " + d.nummer : ""), "",
    "Sehr geehrte Damen und Herren,", "",
    "hiermit kündige ich den auf mich laufenden Vertrag" + (d.vertragsart ? " (" + d.vertragsart + ")" : "") + (d.nummer ? " mit der Nummer " + d.nummer : "") + " " + wann + ".", "",
    "Bitte bestätigen Sie mir die Kündigung und den Zeitpunkt der Vertragsbeendigung schriftlich.", "",
    "Mit freundlichen Grüßen", "", "", p.name];
  return zeilen.join("\n");
}
async function kuendigung(a) {
  const akt = a.aktion || "schreiben";
  if (akt === "zeigen") {
    const l = await liste(), such = sauber(a.anbieter).toLowerCase();
    const g = such ? l.filter(x => x.anbieter.toLowerCase().includes(such)) : l;
    if (!g.length) return { ok: false, hinweis: l.length ? "Zu dem Anbieter habe ich keine Kündigung. Vorhandene nennen." : "Es gibt noch keine geschriebene Kündigung. Ehrlich sagen.", vorhanden: l.map(x => x.anbieter) };
    return { ok: true, anzahl: g.length, liste: g.map(x => ({ anbieter: x.anbieter, am: x.am })), brief: g[0].brief, anbieter: g[0].anbieter, hinweis: "Sage, dass der Brief offen ist (Kopieren, PDF). Mehrere: nenne die Anbieter." };
  }
  if (akt === "loeschen") {
    const l = await liste(), such = sauber(a.anbieter).toLowerCase(), g = l.filter(x => !such || x.anbieter.toLowerCase().includes(such));
    if (!g.length) return { ok: false, hinweis: "Keine passende Kündigung gespeichert.", vorhanden: l.map(x => x.anbieter) };
    if (g.length > 1 && !such) return { ok: false, mehrdeutig: g.map(x => x.anbieter), hinweis: "Mehrere gespeichert. Fragen, welche gelöscht werden soll." };
    if (!a.bestaetigt) return { ok: false, bestaetigung_noetig: true, anbieter: g[0].anbieter, hinweis: "Fragen, ob die Kündigung an '" + g[0].anbieter + "' gelöscht werden soll. Erst nach Ja mit bestaetigt:true erneut aufrufen." };
    await sichern(l.filter(x => x !== g[0])); return { ok: true, geloescht: g[0].anbieter };
  }
  if (akt !== "schreiben") return { ok: false, hinweis: "Unbekannte Aktion. Möglich: schreiben, zeigen, loeschen." };
  const d = { anbieter: sauber(a.anbieter, 80), vertragsart: sauber(a.vertragsart, 60), nummer: sauber(a.nummer, 40), zeitpunkt: a.zeitpunkt, datum: sauber(a.datum, 10), grund: sauber(a.grund, 200), anbieter_adresse: sauber(a.anbieter_adresse, 160) };
  const fehlt = [];
  if (!d.anbieter) fehlt.push("Anbieter (bei wem soll gekündigt werden)");
  if (!["naechstmoeglich", "datum", "ausserordentlich"].includes(d.zeitpunkt)) fehlt.push("Zeitpunkt (zum nächstmöglichen Zeitpunkt, zu einem bestimmten Datum oder außerordentlich mit Grund)");
  if (d.zeitpunkt === "datum" && !/^\d{4}-\d{2}-\d{2}$/.test(d.datum)) fehlt.push("Datum der Kündigung (JJJJ-MM-TT, aus Sams Worten ausrechnen)");
  if (d.zeitpunkt === "ausserordentlich" && !d.grund) fehlt.push("Grund der außerordentlichen Kündigung");
  if (!d.anbieter) { // Sam hat gerade ein Foto geschickt und sagt nur 'Kuendigung': der Absender vom Foto ist gemeint
    try { const r = await K.redis(["GET", "atlas:foto:letztes"]); const f = r ? JSON.parse(r) : null, fe = f && f.felder || {};
      if (fe.absender && ["rechnung", "brief"].includes(f.art)) return { ok: false, foto_vorschlag: { anbieter: fe.absender, nummer: fe.kundennummer || fe.vertragsnummer || "", anbieter_adresse: fe.absender_anschrift || "" }, hinweis: "Auf dem Foto, das Sam gerade geschickt hat, steht als Absender '" + fe.absender + "'. Frage nur kurz: 'Soll ich " + fe.absender + " kündigen? Zum nächstmöglichen Zeitpunkt oder zu einem bestimmten Datum?' Mit seiner Antwort rufst du kuendigung erneut auf (anbieter, nummer, anbieter_adresse aus foto_vorschlag, soweit vorhanden)." };
    } catch (e) {}
  }
  if (fehlt.length) return { ok: false, hinweis: "Es fehlt noch: " + fehlt.join("; ") + ". Nur das Fehlende in einem kurzen Satz erfragen; Art des Vertrags, Kunden-/Vertragsnummer und Anschrift des Anbieters sind freiwillig, einmal danach fragen. Die Anschrift des Anbieters (anbieter_adresse) ist die Adresse der Firma, bei der gekündigt wird, nie die einer Person. Weiß Sam sie nicht, oder sagt er 'nein' oder 'egal', rufe kuendigung sofort ohne diese Angabe auf (im Brief steht dann ein Platzhalter). Eine Frage nie wiederholen." };
  if (!a.fuer_name && !a.eigener_vertrag) { // Foto-Brief ist an eine andere Person gerichtet: erst nachfragen, nicht still in Sams Namen schreiben
    try { const r = await K.redis(["GET", "atlas:foto:letztes"]); const f = r ? JSON.parse(r) : null, fe = f && f.felder || {};
      const gleich = (x, y) => { const n = t => String(t || "").toLowerCase().replace(/[^a-z0-9äöüß]/g, ""); return n(x) && n(y) && (n(x).includes(n(y)) || n(y).includes(n(x))); };
      if (fe.empfaenger && !(await meinName(fe.empfaenger)) && (!fe.absender || gleich(fe.absender, d.anbieter))) return { ok: false, empfaenger_pruefen: true, empfaenger: fe.empfaenger, empfaenger_anschrift: fe.empfaenger_anschrift || "", hinweis: "Der Brief auf dem Foto ist an '" + fe.empfaenger + "' adressiert, nicht an Sam. Frage kurz: 'Der Vertrag gehört " + fe.empfaenger + ". Soll ich die Kündigung in ihrem Namen schreiben?' Bei Ja rufst du kuendigung erneut auf mit fuer_name = empfaenger. fuer_anschrift nur angeben, wenn empfaenger_anschrift oben gefüllt ist; sonst weglassen (dann steht Sams Anschrift im Brief, die Familie wohnt zusammen). Frage Sam NICHT nach der Anschrift der Person. Bei Nein (der Vertrag läuft doch auf Sam) mit eigener_vertrag:true." };
    } catch (e) {}
  }
  const p = await profil();
  if (a.fuer_name) { p.name = sauber(a.fuer_name, 60); if (a.fuer_anschrift) p.anschrift = sauber(a.fuer_anschrift, 120); } // Brief fuer eine andere Person (zum Beispiel die Ehefrau): nur fuer diesen Brief, wird nicht als Sams Absender gemerkt
  else if (a.name || a.anschrift) { // neuer Absender: merken
    if (a.name) p.name = sauber(a.name, 60); if (a.anschrift) { p.anschrift = sauber(a.anschrift, 120); p.eigene = true; }
    await K.redis(["HSET", "atlas:plan", PROFIL, JSON.stringify(p)]);
  }
  const text = brief(d, p), l = await liste(); l.unshift({ id: Date.now(), anbieter: d.anbieter, am: heuteIso(), brief: text, daten: d });
  await sichern(l);
  return { ok: true, anbieter: d.anbieter, zeitpunkt: d.zeitpunkt, brief: text, luecken: d.anbieter_adresse ? [] : ["Anschrift des Anbieters"],
    hinweis: "Der Brief ist fertig und liegt offen auf dem Bildschirm (ändern, kopieren, als PDF speichern oder drucken). Sage das in einem Satz. Es ist nur ein Entwurf, keine Rechtsberatung: Anschrift und Frist bitte prüfen" + (d.anbieter_adresse ? "." : "; die Anschrift des Anbieters fehlt noch im Brief und muss ergänzt werden (Kündigungsadresse steht meist auf Vertrag oder Rechnung).") + " Er wird nicht verschickt." };
}
module.exports = { kuendigung, brief };
