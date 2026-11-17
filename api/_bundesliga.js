"use strict";
// Bundesliga: Spieltag, Ergebnisse, Tabelle ueber die freie OpenLigaDB (ohne Schluessel). liga: 1 oder 2.
const BASIS = "https://api.openligadb.de/";
const saison = () => { const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Berlin" })); return d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1; }; // ab Juli neue Saison
const holen = async pfad => { const r = await fetch(BASIS + pfad, { signal: AbortSignal.timeout(9000) }); if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); };
const saisonText = () => { const j = saison(); return j + "/" + String(j + 1).slice(2); };
const lig = a => String(a.liga) === "2" ? "bl2" : "bl1";
const KURZ = { hsv: "hamburger", bvb: "dortmund", bayern: "bayern", gladbach: "gladbach", pauli: "pauli", "st pauli": "pauli", werder: "bremen", schalke: "schalke", leverkusen: "leverkusen", bayer: "leverkusen", frankfurt: "frankfurt", eintracht: "frankfurt", hoffenheim: "hoffenheim", wolfsburg: "wolfsburg", mainz: "mainz", augsburg: "augsburg", freiburg: "freiburg", stuttgart: "stuttgart", leipzig: "leipzig", union: "union", koeln: "köln", köln: "köln", heidenheim: "heidenheim", hertha: "hertha", hannover: "hannover", kiel: "kiel" };
const passt = (n, t0) => { const t = KURZ[String(t0 || "").toLowerCase().trim()] || t0; const a = String(n || "").toLowerCase(), b = String(t || "").toLowerCase().trim(); return !!b && (a.includes(b) || b.includes(a)); };

function stand(m) { // {t1, t2} oder null
  const e = (m.matchResults || []).find(r => r.resultTypeID === 2) || (m.matchResults || []).slice().sort((x, y) => (y.resultOrderID || 0) - (x.resultOrderID || 0))[0];
  if (e) return { t1: e.pointsTeam1, t2: e.pointsTeam2 };
  const g = (m.goals || []).slice(-1)[0]; if (g) return { t1: g.scoreTeam1, t2: g.scoreTeam2 };
  return null;
}
function spiel(m) {
  const beginn = new Date(m.matchDateTimeUTC || m.matchDateTime), jetzt = Date.now(), fertig = !!m.matchIsFinished, begonnen = beginn.getTime() <= jetzt, s = stand(m);
  const zeit = isNaN(beginn) ? "" : beginn.toLocaleString("de-DE", { timeZone: "Europe/Berlin", weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const heim = m.team1 && m.team1.teamName, gast = m.team2 && m.team2.teamName;
  if (fertig && s) return { heim, gast, stand: "beendet", ergebnis: s.t1 + ":" + s.t2 };
  if (begonnen && !fertig) return { heim, gast, stand: "läuft", ergebnis: s ? s.t1 + ":" + s.t2 : "0:0" };
  return { heim, gast, stand: "kommt", anstoss: zeit };
}
async function tabelle(a) {
  const t = await holen("getbltable/" + lig(a) + "/" + saison());
  if (!Array.isArray(t) || !t.length) return { ok: false, hinweis: "Die Tabelle ist gerade nicht abrufbar. Ehrlich sagen." };
  const z = t.map((x, i) => ({ platz: i + 1, team: x.teamName, spiele: x.matches, punkte: x.points, tore: x.goals + ":" + x.opponentGoals }));
  if (a.team) { const k = z.filter(x => passt(x.team, a.team)); if (!k.length) return { ok: false, hinweis: "Die Mannschaft '" + a.team + "' steht nicht in dieser Liga. Ehrlich sagen." }; return { ok: true, saison: saisonText(), tabelle: z, gefragt: k, hinweis: "Sam sieht die ganze Tabelle auf dem Bildschirm. Nenne nur Platz, Punkte und Spiele der gefragten Mannschaft, in einem kurzen Satz." }; }
  return { ok: true, saison: saisonText(), tabelle: z.slice(0, 18), hinweis: "Sam sieht die ganze Tabelle auf dem Bildschirm. Sage nur kurz: Tabellenführer mit Punkten und der Letzte, in ein bis zwei Sätzen, und biete an, einen Verein zu nennen." };
}
async function spiele(a) {
  const l = await holen("getmatchdata/" + lig(a));
  if (!Array.isArray(l) || !l.length) return { ok: false, hinweis: "Spieltag gerade nicht abrufbar. Ehrlich sagen." };
  const tag = l[0].group && l[0].group.groupName, alle = l.map(spiel);
  const gew = a.team ? l.map((m, i) => ({ m, s: alle[i] })).filter(x => passt(x.s.heim, a.team) || passt(x.s.gast, a.team)).map(x => x.s) : alle;
  if (!gew.length) return { ok: false, hinweis: "'" + a.team + "' spielt am " + (tag || "aktuellen Spieltag") + " nicht (oder der Name passt zu keinem Verein). Ehrlich sagen." };
  return { ok: true, saison: saisonText(), spieltag: tag, spiele: gew, hinweis: "Zuerst laufende Spiele, dann beendete mit Ergebnis, dann kommende mit Anstoß. Sam sieht alle Spiele auf dem Bildschirm: nenne nur laufende Spiele und die gefragte Mannschaft, sonst nur ein bis zwei Sätze. Bei 'läuft' ist es der Zwischenstand." };
}
async function bundesliga(a) {
  try { return a.aktion === "tabelle" ? await tabelle(a || {}) : await spiele(a || {}); }
  catch (e) { return { ok: false, technisch: true, hinweis: "Die Bundesliga-Daten sind gerade nicht erreichbar (" + String(e.message || e).slice(0, 80) + "). Ehrlich sagen." }; }
}
module.exports = { bundesliga, stand, spiel, saison };
