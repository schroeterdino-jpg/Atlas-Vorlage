"use strict";
// Einkaufsliste, Aufgaben, Erinnerungen: liegen in Atlas' eigener Datenbank (Redis), je Liste ein Eintrag mit JSON.
const K = require("./_keys.js");

function jetztBerlin() { // "2026-11-15T09:51" (gleiche Schreibweise wie gespeicherte Zeiten)
  return new Date().toLocaleString("sv-SE", { timeZone: "Europe/Berlin" }).slice(0, 16).replace(" ", "T");
}
async function laden(name) { const r = await K.redis(["HGET", "atlas:listen", name]); if (!r) return []; try { return JSON.parse(r); } catch (e) { throw new Error("Liste " + name + " ist beschädigt"); } }
async function sichern(name, liste) { await K.redis(["HSET", "atlas:listen", name, JSON.stringify(liste)]); }
const id = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const norm = s => String(s || "").toLowerCase().trim();
// Vergleich fuer Doppelte: Gross/Klein, Satzzeichen, Mengen ("2 Liter", "500 g") und einfache Mehrzahl-Endungen werden ignoriert.
const MENGE = new Set(["l", "liter", "kg", "kilo", "g", "gramm", "ml", "stück", "stueck", "stk", "packung", "packungen", "pack", "päckchen", "flasche", "flaschen", "dose", "dosen", "x", "paar", "bund", "becher", "tüte", "tüten"]);
const stamm = w => (w.length > 4 ? w.replace(/(en|er|n|e|s)$/, "") : w);
const woerter = s => String(s || "").toLowerCase().replace(/[^a-zäöüß0-9 ]+/g, " ").split(/\s+/).filter(w => w && !/^\d+([.,]\d+)?$/.test(w) && !MENGE.has(w)).map(stamm);
function gleich(a, b) { const x = woerter(a), y = woerter(b); return x.length > 0 && x.length === y.length && x.slice().sort().join(" ") === y.slice().sort().join(" "); }
function aehnlich(a, b) { const x = woerter(a), y = woerter(b); if (!x.length || !y.length || gleich(a, b)) return false; const k = x.length < y.length ? x : y, g = k === x ? y : x; return k.every(w => g.includes(w)); }
function finden(liste, text) { const t = norm(text); const g = liste.filter(x => norm(x.text) === t); if (g.length) return g; return liste.filter(x => norm(x.text).includes(t) || (t.length > 2 && t.includes(norm(x.text)))); }
const kurz = x => ({ id: x.id, text: x.text, erledigt: !!x.erledigt, faellig: x.faellig || undefined, zeit: x.zeit || undefined });

// eine gemeinsame Logik fuer Einkaufsliste und Aufgaben
async function liste(name, a) {
  const l = await laden(name); const items = (Array.isArray(a.eintraege) ? a.eintraege : []).map(s => String(s).trim()).filter(Boolean);
  switch (a.aktion) {
    case "hinzufuegen": {
      if (!items.length) return { ok: false, hinweis: "Es fehlt, was auf die Liste soll. Nachfragen." };
      const neu = [], gleiche = [], aehnl = []; const offen = () => l.filter(x => !x.erledigt);
      for (const t of items) {
        const g = offen().find(x => gleich(x.text, t)); if (g) { gleiche.push(t); continue; }
        const ae = offen().find(x => aehnlich(x.text, t)); if (ae && !a.trotzdem) { aehnl.push({ neu: t, vorhanden: ae.text }); continue; }
        const e = { id: id(), text: t.slice(0, 200), erledigt: false }; if (a.faellig && name === "aufgaben") e.faellig = String(a.faellig).slice(0, 10); l.push(e); neu.push(t);
      }
      await sichern(name, l); return { ok: true, hinzugefuegt: neu, schon_vorhanden: gleiche, aehnlich: aehnl.length ? aehnl : undefined, hinweis: aehnl.length ? "Nicht hinzugefügt, weil etwas Ähnliches schon auf der Liste steht. Sam kurz fragen (z. B. \"Milch steht schon als laktosefreie Milch drauf, trotzdem dazu?\") und bei Ja mit trotzdem:true wiederholen." : "", offen_gesamt: l.filter(x => !x.erledigt).length };
    }
    case "zeigen": return { ok: true, offen: l.filter(x => !x.erledigt).map(kurz), erledigt_anzahl: l.filter(x => x.erledigt).length, hinweis: l.some(x => !x.erledigt) ? "" : "Die Liste ist leer." };
    case "abhaken": case "entfernen": {
      if (!items.length) return { ok: false, hinweis: "Es fehlt, welcher Eintrag gemeint ist. Nachfragen." };
      const getan = [], unklar = [], fehlt = [];
      for (const t of items) {
        const g = finden(l.filter(x => a.aktion === "entfernen" || !x.erledigt), t);
        if (g.length === 1) { if (a.aktion === "abhaken") g[0].erledigt = true; else l.splice(l.indexOf(g[0]), 1); getan.push(g[0].text); }
        else if (g.length > 1) unklar.push({ gesucht: t, treffer: g.map(x => x.text) }); else fehlt.push(t);
      }
      await sichern(name, l); return { ok: !!getan.length || (!unklar.length && !fehlt.length), erledigt: getan, mehrdeutig: unklar, nicht_gefunden: fehlt };
    }
    case "leeren": {
      if (!a.bestaetigt) return { ok: false, bestaetigung_noetig: true, hinweis: "Frage Sam, ob wirklich die ganze Liste gelöscht werden soll (" + l.length + " Einträge). Erst nach seinem Ja mit bestaetigt=true wiederholen." };
      await sichern(name, []); return { ok: true, geloescht: l.length };
    }
  }
  return { ok: false, hinweis: "Unbekannte Aktion." };
}

const fuerApp = l => ({ aktion: "erinnerungen", liste: l.filter(x => !x.erledigt && !x.gemeldet).sort((x, y) => x.zeit.localeCompare(y.zeit)).slice(0, 40).map(x => ({ id: x.id, text: x.text.slice(0, 100), zeit: x.zeit })) }); // fuer die Android-App: sie plant die Benachrichtigungen
async function appListe() { return fuerApp(await laden("erinnerungen")); }
async function erinnerung(a) {
  let l = await laden("erinnerungen"); const jetzt = jetztBerlin();
  switch (a.aktion) {
    case "anlegen": {
      const text = String(a.text || "").trim(); const zeit = String(a.zeit || "").trim();
      if (!text) return { ok: false, hinweis: "Es fehlt, woran erinnert werden soll. Nachfragen." };
      if (!/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}$/.test(zeit)) return { ok: false, hinweis: "Die Zeit fehlt oder hat das falsche Format (JJJJ-MM-TTTHH:MM, deutsche Zeit). Rechne sie aus der aktuellen Zeit aus oder frage nach." };
      const e = { id: id(), text: text.slice(0, 200), zeit: zeit.replace(" ", "T"), erledigt: false }; l.push(e); await sichern("erinnerungen", l);
      return { ok: true, angelegt: kurz(e), fuerApp: fuerApp(l), hinweis: "In der Atlas-App auf dem Handy kommt zur Zeit eine Benachrichtigung, auch wenn Atlas geschlossen ist. Im Browser nicht: dort meldet Atlas sie erst, wenn Sam mit ihm spricht." };
    }
    case "zeigen": { const offen = l.filter(x => !x.erledigt).sort((x, y) => x.zeit.localeCompare(y.zeit)); return { ok: true, jetzt, fuerApp: fuerApp(l), offen: offen.map(kurz), hinweis: offen.length ? "" : "Keine offenen Erinnerungen." }; }
    case "erledigt": case "loeschen": {
      const offen = l.filter(x => !x.erledigt); const ke = x => ({ id: x.id, text: x.text, zeit: x.zeit });
      const m = String(a.zeit || "").match(/(\d{1,2})[:.](\d{2})/) || String(a.text || "").match(/(\d{1,2})[:.](\d{2})/); // Uhrzeit aus zeit oder Text
      const uhr = m ? String(m[1]).padStart(2, "0") + ":" + m[2] : "";
      const rest = String(a.text || "").replace(/\d{1,2}[:.]\d{2}(\s*uhr)?/gi, "").replace(/\b(um|von|die|der|das|erinnerung)\b/gi, " ").replace(/\s+/g, " ").trim();
      let g = a.id ? offen.filter(x => x.id === a.id) : (rest ? finden(offen, rest) : offen);
      if (uhr) g = g.filter(x => String(x.zeit).slice(11, 16) === uhr);
      if (!g.length) return { ok: false, hinweis: "Keine passende Erinnerung gefunden. Sage das ehrlich." };
      if (g.length > 1 && a.alle !== true) return { ok: false, mehrdeutig: g.map(ke), hinweis: "Mehrere passen. Nenne Sam die Uhrzeiten und frage, welche gemeint ist (oder ob alle). Rufe dann mit der id der gemeinten Erinnerung (oder mit alle=true) wieder auf, nicht noch einmal nur mit dem Text." };
      if (a.aktion === "loeschen" && !a.bestaetigt) return { ok: false, bestaetigung_noetig: true, kandidaten: g.map(ke), hinweis: "Frage Sam, ob " + (g.length > 1 ? "diese " + g.length + " Erinnerungen" : "diese Erinnerung") + " gelöscht werden soll. Erst nach seinem Ja mit bestaetigt=true und derselben id (bei mehreren alle=true mit demselben Text) wiederholen." };
      const ids = new Set(g.map(x => x.id));
      if (a.aktion === "erledigt") g.forEach(x => { x.erledigt = true; }); else l = l.filter(x => !ids.has(x.id));
      await sichern("erinnerungen", l); return { ok: true, [a.aktion === "erledigt" ? "erledigt" : "geloescht"]: g.map(x => x.text + (g.length > 1 ? " (" + String(x.zeit).slice(11, 16) + ")" : "")).join(", "), anzahl: g.length, fuerApp: fuerApp(l) };
    }
  }
  return { ok: false, hinweis: "Unbekannte Aktion." };
}

// Faellige Erinnerungen: der Server setzt sie fest vor die Antwort. Als gemeldet gilt eine erst, wenn die Antwort fertig ist.
async function faellige() { const l = await laden("erinnerungen"); const jetzt = jetztBerlin(); return l.filter(x => !x.erledigt && !x.gemeldet && x.zeit <= jetzt); }
async function alsGemeldet(ids) { const l = await laden("erinnerungen"); l.forEach(x => { if (ids.includes(x.id)) x.gemeldet = true; }); await sichern("erinnerungen", l); }
// Fuer die Kacheln der Startseite: offene zuerst, dann erledigte; einzelnes Antippen schaltet um.
async function kachelDaten(name) { const l = await laden(name); const o = l.filter(x => !x.erledigt), f = l.filter(x => x.erledigt); return { offen: o.length, eintraege: o.concat(f).slice(0, 200).map(x => ({ id: x.id, text: x.text, erledigt: !!x.erledigt })), erledigt: f.length, mehr: Math.max(0, l.length - 200) }; }
async function umschalten(name, idv, erledigt) { const l = await laden(name); const x = l.find(y => y.id === idv); if (!x) return false; x.erledigt = !!erledigt; await sichern(name, l); return true; }
async function aufraeumen(name) { const l = await laden(name); await sichern(name, l.filter(x => !x.erledigt)); return l.filter(x => x.erledigt).length; } // nur abgehakte weg, offene bleiben
// Fuer die Erinnerungs-Kachel: alle offenen, nach Zeit; einzelne per Hand loeschen (ohne Rueckfrage, Sam tippt selbst).
async function erinnerungsKachel() { const l = (await laden("erinnerungen")).filter(x => !x.erledigt).sort((x, y) => x.zeit.localeCompare(y.zeit)); return { offen: l.length, eintraege: l.slice(0, 100).map(x => ({ id: x.id, text: x.text.slice(0, 100), zeit: x.zeit })) }; }
async function erinnerungWeg(idv) { const l = await laden("erinnerungen"); const n = l.filter(x => x.id !== idv); if (n.length === l.length) return false; await sichern("erinnerungen", n); return true; }
module.exports = { erinnerungsKachel, erinnerungWeg, appListe, kachelDaten, umschalten, aufraeumen, liste, erinnerung, faellige, alsGemeldet, jetztBerlin };
