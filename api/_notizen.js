"use strict";
// Notizen: Zettel zum Aufschreiben (Ideen, Infos, Gedanken). Nicht fuer Termine, Aufgaben oder Einkauf.
const K = require("./_keys.js");

const jetzt = () => new Date().toLocaleString("sv-SE", { timeZone: "Europe/Berlin" }).slice(0, 16).replace(" ", "T");
async function laden() { const r = await K.redis(["HGET", "atlas:listen", "notizen"]); if (!r) return []; try { return JSON.parse(r); } catch (e) { throw new Error("Notizen sind beschädigt"); } }
async function sichern(l) { await K.redis(["HSET", "atlas:listen", "notizen", JSON.stringify(l)]); }
const id = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const norm = s => String(s || "").toLowerCase().trim();
const kurz = n => ({ id: n.id, titel: n.titel || undefined, text: n.text.length > 300 ? n.text.slice(0, 300) + " …" : n.text, angelegt: n.zeit, geaendert: n.geaendert && n.geaendert !== n.zeit ? n.geaendert : undefined });
// Suche tolerant: Gross/Klein, Bindestrich/Leerzeichen ("Lego-Set" = "Lego Set" = "Legoset"), Fuellwoerter ("die Notiz löschen") werden ignoriert.
const FUELL = new Set(["notiz", "notizen", "die", "der", "das", "den", "dem", "ein", "eine", "einen", "mit", "von", "zu", "zum", "zur", "und", "oder", "bitte", "mal", "meine", "meiner", "meinen", "löschen", "loeschen", "lösche", "weg", "zeig", "zeige", "finde", "suche", "über", "ueber", "wegen", "zu"]);
const roh = s => String(s || "").toLowerCase().replace(/[^a-z0-9äöüß]+/g, " ").trim();
const dicht = s => roh(s).replace(/ /g, "");
function bewerten(n, wort) { const h = roh((n.titel || "") + " " + n.text), hd = h.replace(/ /g, ""); let p = 0; for (let i = 0; i < wort.length; i++) { if (h.includes(wort[i]) || hd.includes(wort[i])) p++; else if (i + 1 < wort.length && hd.includes(wort[i] + wort[i + 1])) { p += 2; i++; } } return p; }
function suchen(l, s) {
  const w = roh(s).split(" ").filter(x => x.length > 1 && !FUELL.has(x)); if (!w.length) return roh(s) ? [] : l.slice();
  const bew = l.map(n => [n, bewerten(n, w)]).filter(x => x[1] > 0); if (!bew.length) return [];
  const top = Math.max(...bew.map(x => x[1])); return bew.filter(x => x[1] === top).map(x => x[0]);
}

async function notiz(a) {
  const l = await laden(), text = String(a.text || "").trim();
  switch (a.aktion) {
    case "anlegen": {
      if (!text) return { ok: false, hinweis: "Es fehlt, was aufgeschrieben werden soll. Nachfragen." };
      if (l.length >= 300) return { ok: false, hinweis: "Es sind schon 300 Notizen gespeichert. Sam bitten, alte zu löschen." };
      const n = { id: id(), titel: a.titel ? String(a.titel).trim().slice(0, 80) : undefined, text: text.slice(0, 4000), zeit: jetzt() }; n.geaendert = n.zeit; l.push(n); await sichern(l);
      return { ok: true, angelegt: kurz(n), gesamt: l.length };
    }
    case "zeigen": {
      const t = suchen(l, a.suche).sort((x, y) => String(y.geaendert || y.zeit).localeCompare(String(x.geaendert || x.zeit))), n = Math.min(8, Math.max(1, +a.anzahl || 5));
      if (!l.length) return { ok: true, notizen: [], hinweis: "Es sind noch keine Notizen gespeichert." };
      if (!t.length) return { ok: true, notizen: [], hinweis: "Zu '" + a.suche + "' habe ich keine Notiz gefunden." };
      return { ok: true, notizen: t.slice(0, n).map(kurz), gefunden: t.length, hinweis: t.length > n ? "Es gibt noch " + (t.length - n) + " weitere. Kurz erwähnen." : "" };
    }
    case "anhaengen": {
      if (!text) return { ok: false, hinweis: "Es fehlt, was dazugeschrieben werden soll. Nachfragen." };
      const t = suchen(l, a.suche); if (!t.length) return { ok: false, hinweis: "Zu '" + (a.suche || "") + "' habe ich keine Notiz gefunden. Fragen, ob eine neue Notiz angelegt werden soll." };
      if (t.length > 1) return { ok: false, mehrdeutig: true, treffer: t.slice(0, 5).map(kurz), hinweis: "Mehrere Notizen passen. Nachfragen, welche gemeint ist." };
      const n = t[0]; n.text = (n.text + "\n" + text).slice(0, 4000); n.geaendert = jetzt(); await sichern(l); return { ok: true, geaendert: kurz(n) };
    }
    case "loeschen": {
      const t = suchen(l, a.suche); if (!norm(a.suche)) return { ok: false, hinweis: "Es fehlt, welche Notiz gelöscht werden soll. Nachfragen." };
      if (!t.length) return { ok: false, hinweis: "Zu '" + a.suche + "' habe ich keine Notiz gefunden." };
      if (t.length > 1) return { ok: false, mehrdeutig: true, treffer: t.slice(0, 5).map(kurz), hinweis: "Mehrere Notizen passen. Nachfragen, welche gemeint ist." };
      if (!a.bestaetigt) return { ok: false, bestaetigung_noetig: true, notiz: kurz(t[0]), hinweis: "Sam die Notiz kurz vorlesen und fragen, ob sie gelöscht werden soll. Erst nach Ja mit bestaetigt:true erneut aufrufen." };
      await sichern(l.filter(x => x !== t[0])); return { ok: true, geloescht: kurz(t[0]) };
    }
    default: return { ok: false, hinweis: "Unbekannte Aktion. Erlaubt: anlegen, zeigen, anhaengen, loeschen." };
  }
}
module.exports = { notiz };
