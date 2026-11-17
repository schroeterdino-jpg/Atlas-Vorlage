"use strict";
// Wecker: die Liste liegt in Atlas' Datenbank (Redis); die Android-App uebernimmt sie und klingelt (Handy-Weckton, Schlummern).
const K = require("./_keys.js");
const TZ = "Europe/Berlin";
const jetzt = () => { const s = new Date().toLocaleString("sv-SE", { timeZone: TZ }); return { datum: s.slice(0, 10), zeit: s.slice(11, 16) }; };
const plus = (datum, n) => { const d = new Date(datum + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const id = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 4);
async function laden() { const r = await K.redis(["HGET", "atlas:plan", "wecker"]); if (!r) return []; try { const l = JSON.parse(r); return Array.isArray(l) ? l : []; } catch (e) { return []; } }
async function sichern(l) { await K.redis(["HSET", "atlas:plan", "wecker", JSON.stringify(l)]); }
function zeitOk(z) { const m = String(z || "").trim().match(/^(\d{1,2})[:.](\d{2})$/) || String(z || "").trim().match(/^(\d{1,2})$/); if (!m) return ""; const h = +m[1], mi = m[2] ? +m[2] : 0; if (h > 23 || mi > 59) return ""; return String(h).padStart(2, "0") + ":" + String(mi).padStart(2, "0"); }
function lesbar(w) {
  const wann = w.wdh === "taeglich" ? "täglich" : w.wdh === "werktags" ? "Montag bis Freitag" : w.datum === jetzt().datum ? "heute" : w.datum === plus(jetzt().datum, 1) ? "morgen" : w.datum;
  return w.zeit + " Uhr, " + wann + (w.name ? ", " + w.name : "") + (w.an ? "" : " (aus)");
}
function sicht(l) { return l.map(w => ({ id: w.id, zeit: w.zeit, datum: w.datum || "", wdh: w.wdh || "", name: w.name || "", an: w.an !== false, text: lesbar(w) })); }
async function wecker(a, ctx) {
  const n = jetzt(); let l = (await laden()).filter(w => w.wdh || (w.datum + "T" + w.zeit) > (n.datum + "T" + n.zeit)); // abgelaufene Einmal-Wecker raus
  const aktion = String(a.aktion || "liste");
  const hinweisApp = ctx && ctx.app ? " Der Wecker wird in der Uhr-App des Handys gestellt (normaler Wecker, klingelt auch bei geschlossenem Atlas)." : " Hinweis: Gestellt wird der Wecker nur über die Atlas-App auf dem Handy. Sam sagen, dass er Atlas dort öffnen muss, im Browser stellt sich nichts.";
  const fuer = (aktion, w) => ({ aktion, zeit: w.zeit, wdh: w.wdh || "", name: w.name || "" });
  const finde = () => {
    if (a.id) return l.filter(w => w.id === a.id);
    const z = zeitOk(a.zeit); const t = l.filter(w => (!z || w.zeit === z) && (!a.name || String(w.name || "").toLowerCase().includes(String(a.name).toLowerCase())));
    return z || a.name ? t : l;
  };
  if (aktion === "liste") { await sichern(l); return { ok: true, alle: sicht(l), hinweis: l.length ? "Zähle die Wecker kurz auf. Das sind die Wecker, die Atlas gestellt hat; die Uhr-App kann Atlas nicht auslesen." : "Es ist kein Wecker gestellt. Sage das." }; }
  if (aktion === "stellen") {
    let z = zeitOk(a.zeit);
    const im = Number(a.in_minuten); let relDatum = "";
    if (!z && isFinite(im) && im >= 1 && im <= 1440) { const d = new Date(Date.now() + Math.round(im) * 60000), t = d.toLocaleString("sv-SE", { timeZone: TZ }); z = t.slice(11, 16); relDatum = t.slice(0, 10); }
    if (!z) return { ok: false, hinweis: "Es fehlt die Uhrzeit für den Wecker (zum Beispiel 6:30). Nachfragen." };
    const wdh = a.wiederholen === "taeglich" || a.wiederholen === "werktags" ? a.wiederholen : "";
    let datum = ""; if (!wdh) { datum = relDatum || (/^\d{4}-\d{2}-\d{2}$/.test(String(a.datum || "")) ? a.datum : (z > n.zeit ? n.datum : plus(n.datum, 1))); if ((datum + "T" + z) <= (n.datum + "T" + n.zeit)) return { ok: false, hinweis: "Diese Zeit liegt in der Vergangenheit. Nachfragen, wann der Wecker klingeln soll." }; if (datum > plus(n.datum, 1)) return { ok: false, hinweis: "Die Uhr-App kann einen einmaligen Wecker nur für die nächsten 24 Stunden stellen, nicht für ein späteres Datum. Ehrlich sagen und anbieten, es dann zu tun oder einen Termin einzutragen." }; }
    const w = { id: id(), zeit: z, datum, wdh, name: String(a.name || "").slice(0, 40), an: true };
    if (l.some(x => x.zeit === z && x.datum === datum && x.wdh === wdh)) return { ok: true, doppelt: true, gestellt: lesbar(w), fuerApp: fuer("stellen", w), alle: sicht(l), hinweis: "In Atlas' Liste stand dieser Wecker schon, aber in der Uhr-App kann er fehlen (zum Beispiel von Hand gelöscht). Deshalb wurde er jetzt in der Uhr-App noch einmal gestellt. Sage: 'Ich habe den Wecker für " + lesbar(w) + " noch einmal gestellt.' und NICHT, dass er schon eingestellt war. Atlas kann nicht nachprüfen, ob die Uhr-App ihn übernommen hat." + hinweisApp };
    l.push(w); if (l.length > 30) return { ok: false, hinweis: "Es sind schon 30 Wecker gestellt. Sage das ehrlich." };
    await sichern(l); return { ok: true, gestellt: lesbar(w), fuerApp: fuer("stellen", w), alle: sicht(l), hinweis: "Bestätige kurz Uhrzeit und Tag." + hinweisApp };
  }
  if (aktion === "aus" || aktion === "an" || aktion === "loeschen") {
    let t = finde(); if (a.alle === true && !a.id && !a.zeit && !a.name) t = aktion === "an" ? l.filter(w => w.an === false) : l; // "alle Wecker"
    if (!t.length) return { ok: false, hinweis: "Ich finde keinen passenden Wecker. Frage nach der Uhrzeit." };
    if (t.length > 1 && a.alle !== true) return { ok: false, mehrdeutig: sicht(t), hinweis: "Mehrere Wecker passen: " + sicht(t).map(w => w.text).join("; ") + ". Frage, welchen er meint, oder ob alle gemeint sind. Dann mit id oder alle=true aufrufen." };
    const mehr = t.length > 1;
    if (aktion === "loeschen" && a.bestaetigt !== true) return { ok: true, rueckfrage: true, wecker: sicht(t), hinweis: "Noch NICHT gelöscht. Frage Sam: 'Soll ich " + (mehr ? "alle " + t.length + " Wecker" : "den Wecker " + lesbar(t[0])) + " löschen?' und rufe erst nach seinem Ja mit bestaetigt=true (und id oder alle=true) auf." };
    const ids = new Set(t.map(w => w.id));
    if (aktion === "loeschen") l = l.filter(w => !ids.has(w.id)); else l.forEach(w => { if (ids.has(w.id)) w.an = aktion === "an"; });
    await sichern(l);
    const auftrag = t.map(w => fuer(aktion === "an" ? "stellen" : "loeschen", w));
    const wort = aktion === "an" ? "wieder eingeschaltet" : aktion === "aus" ? "ausgeschaltet" : "gelöscht";
    return { ok: true, [aktion === "loeschen" ? "geloescht" : "geaendert"]: t.map(lesbar).join("; "), anzahl: t.length, fuerApp: mehr ? { aktion: "mehrere", liste: auftrag } : auftrag[0], alle: sicht(l), hinweis: "Sage kurz, dass " + (mehr ? "die " + t.length + " Wecker" : "der Wecker") + " " + wort + " " + (mehr ? "wurden" : "wurde") + ". Atlas kann nicht nachprüfen, ob die Uhr-App es wirklich übernommen hat; wenn es wichtig ist, soll Sam einmal in der Uhr-App nachsehen." + (aktion === "aus" ? " Atlas merkt sich den Wecker, mit 'Wecker wieder an' stellt er ihn neu." : "") + hinweisApp };
  }
  return { ok: false, hinweis: "Unbekannte Aktion." };
}
module.exports = { wecker, zeitOk };
