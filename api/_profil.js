"use strict";
// Profil der Person, der diese Atlas-Kopie gehoert: Name, Wohnort, Heim- und Arbeitsadresse. Persoenliches steht hier (Redis), nie im Code.
// Altbestand: die Kopie des Erfinders (atlas-xi-seven-90) bekommt beim ersten Aufruf sein bisheriges Profil; jede andere Kopie startet leer
// und wird ueber den Einrichtungsassistenten in der App gefuellt.
const K = require("./_keys.js");
const KEY = "atlas:profil";
const LEER = { name: "", nachname: "", ort: "", region: "", lat: null, lon: null, heim: "", arbeit: "", woerter: [], korrekturen: {}, eingerichtet: false };
const ALT = {
  name: "Sam", nachname: "Mustermann", ort: "Musterstadt", region: "Beispielkreis", lat: 53.5511, lon: 9.9937,
  heim: "Musterweg 13, 12345 Musterstadt", arbeit: "Beispielring 6, 12345 Musterstadt",
  woerter: ["Leon", "Finny", "Alina", "Jana", "Iris", "Matzi", "Hanna"],
  korrekturen: { "Beispiel Rinn Ring": "Beispielring", "Beispiel Ring": "Beispielring", "Musterstad": "Musterstadt", "Mustermänn": "Mustermann", "Tal Beispiel Ring": "Karl-Beispiel-Ring", "Tal-Beispiel-Ring": "Karl-Beispiel-Ring" },
  eingerichtet: true
};
const istAltbestand = () => String(process.env.VERCEL_PROJECT_PRODUCTION_URL || "") === "atlas-beispiel.vercel.app";
let cache = null, cacheZ = 0;
const txt = (v, n) => String(v == null ? "" : v).replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim().slice(0, n);
function saeubern(p) {
  const o = {}; p = p || {};
  for (const [f, n] of [["name", 40], ["nachname", 40], ["ort", 80], ["region", 80], ["heim", 140], ["arbeit", 140]]) if (p[f] !== undefined) o[f] = txt(p[f], n).replace(/["\\<>{}]/g, "");
  for (const f of ["lat", "lon"]) if (p[f] !== undefined) { const v = Number(p[f]); o[f] = isFinite(v) && Math.abs(v) <= (f === "lat" ? 90 : 180) && p[f] !== null && p[f] !== "" ? v : null; }
  if (Array.isArray(p.woerter)) o.woerter = p.woerter.map(x => txt(x, 40)).filter(Boolean).slice(0, 60);
  if (p.eingerichtet !== undefined) o.eingerichtet = !!p.eingerichtet;
  return o;
}
async function laden() {
  if (cache && Date.now() - cacheZ < 30000) return cache;
  let p = null;
  try { const r = await K.redis(["GET", KEY]); if (r) { const x = JSON.parse(r); if (x && typeof x === "object" && !Array.isArray(x)) p = x; } } catch (e) {}
  if (!p) { p = istAltbestand() ? Object.assign({}, ALT) : {}; if (istAltbestand()) { try { await K.redis(["SET", KEY, JSON.stringify(Object.assign({}, LEER, p))]); } catch (e) {} } }
  cache = Object.assign({}, LEER, p); cacheZ = Date.now(); return cache;
}
async function speichern(neu) {
  const alt = await laden(), p = Object.assign({}, alt, saeubern(neu));
  await K.redis(["SET", KEY, JSON.stringify(p)]); cache = p; cacheZ = Date.now(); return p;
}
const vergessen = () => { cache = null; };
const genitiv = n => /[sßxz]$/i.test(n) ? n + "'" : n + "s";
/** Setzt den Namen der Person in Texte fuer die KI und in Ansagen ein (im Code steht noch "Sam" als Platzhalter). */
function ersetze(text, p) {
  const n = (p && p.name) || "", nn = (p && p.nachname) || "";
  if (n === "Sam" || typeof text !== "string") return text;
  const ziel = n || "der Nutzer";
  return text.replace(/Sam Mustermann/g, () => n ? (n + (nn ? " " + nn : "")) : "der Nutzer").replace(/\bSams\b/g, () => n ? genitiv(n) : "des Nutzers").replace(/\bSam\b/g, () => ziel);
}
module.exports = { laden, speichern, saeubern, ersetze, istAltbestand, vergessen, LEER, ALT };
