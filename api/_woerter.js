"use strict";
// Woerterbuch fuer die Spracherkennung: Hinweis-Woerter (Whisper bekommt sie als Vorgabe) und Korrekturen (falsch gehoert -> richtig).
const K = require("./_keys.js");
const Fa = require("./_fahrt.js");
const Pw = require("./_profil.js");

const FEST_BASIS = ["Atlas"];
const festListe = pr => FEST_BASIS.concat([pr.name, pr.nachname, pr.ort], pr.woerter || []).filter(Boolean);

async function laden() {
  let w = {}; try { const r = await K.redis(["HGET", "atlas:plan", "woerter"]); if (r) w = JSON.parse(r); } catch (e) {}
  return { hinweise: Array.isArray(w.hinweise) ? w.hinweise : [], korrekturen: w.korrekturen && typeof w.korrekturen === "object" ? w.korrekturen : Object.assign({}, (await Pw.laden()).korrekturen || {}) };
}

// Text aus dem Einrichtungs-Formular: Hinweise je Zeile, Korrekturen je Zeile als "falsch = richtig"
async function speichern(hinweiseText, korrekturText) {
  const hinweise = String(hinweiseText || "").split(/\n/).map(x => x.trim()).filter(Boolean).slice(0, 80);
  const korrekturen = {};
  for (const z of String(korrekturText || "").split(/\n/)) {
    const i = z.indexOf("="); if (i < 1) continue;
    const f = z.slice(0, i).trim(), r = z.slice(i + 1).trim();
    if (f && r && f.toLowerCase() !== r.toLowerCase()) korrekturen[f] = r;
  }
  await K.redis(["HSET", "atlas:plan", "woerter", JSON.stringify({ hinweise, korrekturen })]);
  return { hinweise, korrekturen };
}

// Strassen, Orte und Namen aus den gespeicherten Adressen
async function ausAdressen() {
  const aus = [];
  try {
    const o = await Fa.orte({ aktion: "zeigen" });
    const adr = [o.heim, o.arbeit].concat((o.orte || []).map(x => x.adresse));
    (o.orte || []).forEach(x => aus.push(x.name));
    adr.forEach(a => { const t = String(a || "").split(","); const s = (t[0] || "").replace(/\s*\d+\s*[a-zA-Z]?\s*$/, "").trim(); if (s) aus.push(s); const ort = (t[t.length - 1] || "").replace(/\d{5}/, "").trim(); if (ort && t.length > 1) aus.push(ort); });
  } catch (e) {}
  return aus;
}

async function prompt() {
  const w = await laden();
  const alle = []; const seen = new Set();
  for (const x of w.hinweise.concat(await ausAdressen(), festListe(await Pw.laden()))) { const k = x.toLowerCase(); if (!seen.has(k)) { seen.add(k); alle.push(x); } }
  let p = "Gespräch mit dem Assistenten Atlas. " + ((await Pw.laden()).name || "Der Nutzer") + " spricht meist Deutsch. Namen: ";
  for (const x of alle) { if ((p + x + ", ").length > 700) break; p += x + ", "; }
  return p.replace(/, $/, ".");
}

async function korrigieren(text) {
  const w = await laden(); let t = String(text || "");
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  for (const f of Object.keys(w.korrekturen).sort((a, b) => b.length - a.length)) t = t.replace(new RegExp("(^|[^\\p{L}])" + esc(f) + "(?![\\p{L}])", "giu"), (m, v) => v + w.korrekturen[f]);
  return t;
}

module.exports = { laden, speichern, prompt, korrigieren };
