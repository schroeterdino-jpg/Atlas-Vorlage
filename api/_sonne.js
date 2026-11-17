"use strict";
// Sonne und Mond: Auf-/Untergang, Mondphase. Rechnet selbst (kein Netz), nach dem bekannten SunCalc-Verfahren.
const K = require("./_keys.js");
const Fa = require("./_fahrt.js");
const PI = Math.PI, rad = PI / 180, TAG = 86400000, J1970 = 2440588, J2000 = 2451545, E = rad * 23.4397;
const toJ = d => d.valueOf() / TAG - 0.5 + J1970, fromJ = j => new Date((j + 0.5 - J1970) * TAG), toDays = d => toJ(d) - J2000;
const ra = (l, b) => Math.atan2(Math.sin(l) * Math.cos(E) - Math.tan(b) * Math.sin(E), Math.cos(l));
const dek = (l, b) => Math.asin(Math.sin(b) * Math.cos(E) + Math.cos(b) * Math.sin(E) * Math.sin(l));
const hoehe = (H, phi, d) => Math.asin(Math.sin(phi) * Math.sin(d) + Math.cos(phi) * Math.cos(d) * Math.cos(H));
const sidereal = (d, lw) => rad * (280.16 + 360.9856235 * d) - lw;
const refr = h => { if (h < 0) h = 0; return 0.0002967 / Math.tan(h + 0.00312536 / (h + 0.08901179)); };
const mAnom = d => rad * (357.5291 + 0.98560028 * d);
const eklLaenge = M => M + rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M)) + rad * 102.9372 + PI;
function sonnePos(d) { const L = eklLaenge(mAnom(d)); return { dec: dek(L, 0), ra: ra(L, 0) }; }
function mondPos(d) {
  const L = rad * (218.316 + 13.176396 * d), M = rad * (134.963 + 13.064993 * d), F = rad * (93.272 + 13.22935 * d), l = L + rad * 6.289 * Math.sin(M), b = rad * 5.128 * Math.sin(F);
  return { ra: ra(l, b), dec: dek(l, b), dist: 385001 - 20905 * Math.cos(M) };
}
function sonnenZeiten(datum, lat, lng, h) {
  const lw = rad * -lng, phi = rad * lat, d = toDays(datum), n = Math.round(d - 0.0009 - lw / (2 * PI)), ds = 0.0009 + (0 + lw) / (2 * PI) + n, M = mAnom(ds), L = eklLaenge(M), dec = dek(L, 0);
  const transit = J2000 + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L), c = (Math.sin(h) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec));
  if (c > 1 || c < -1) return { mittag: fromJ(transit), auf: null, unter: null, immer: c < -1 ? "hell" : "dunkel" };
  const w = Math.acos(c), a = 0.0009 + (w + lw) / (2 * PI) + n, jset = J2000 + a + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);
  return { mittag: fromJ(transit), auf: fromJ(transit - (jset - transit)), unter: fromJ(jset) };
}
function mondHoehe(t, lat, lng) { const lw = rad * -lng, phi = rad * lat, d = toDays(t), c = mondPos(d), H = sidereal(d, lw) - c.ra, h = hoehe(H, phi, c.dec); return h + refr(h); }
function mondZeiten(tag0, lat, lng) { // tag0 = Beginn des Tages (Date)
  const hc = 0.133 * rad, at = i => new Date(tag0.valueOf() + i * 3600000);
  let h0 = mondHoehe(tag0, lat, lng) - hc, auf = null, unter = null;
  for (let i = 1; i <= 24 && !(auf && unter); i += 2) {
    const h1 = mondHoehe(at(i), lat, lng) - hc, h2 = mondHoehe(at(i + 1), lat, lng) - hc, a = (h0 + h2) / 2 - h1, b = (h2 - h0) / 2, xe = -b / (2 * a), ye = (a * xe + b) * xe + h1, dd = b * b - 4 * a * h1;
    let r = 0, x1 = 0, x2 = 0; if (dd >= 0) { const dx = Math.sqrt(dd) / (Math.abs(a) * 2); x1 = xe - dx; x2 = xe + dx; if (Math.abs(x1) <= 1) r++; if (Math.abs(x2) <= 1) r++; if (x1 < -1) x1 = x2; }
    if (r === 1) { if (h0 < 0) { if (!auf) auf = at(i + x1); } else if (!unter) unter = at(i + x1); }
    else if (r === 2) { if (ye < 0) { if (!auf) auf = at(i + x2); if (!unter) unter = at(i + x1); } else { if (!auf) auf = at(i + x1); if (!unter) unter = at(i + x2); } }
    h0 = h2;
  }
  return { auf, unter };
}
function mondPhase(datum) {
  const d = toDays(datum), s = sonnePos(d), m = mondPos(d), sd = 149598000;
  const phi = Math.acos(Math.sin(s.dec) * Math.sin(m.dec) + Math.cos(s.dec) * Math.cos(m.dec) * Math.cos(s.ra - m.ra));
  const inc = Math.atan2(sd * Math.sin(phi), m.dist - sd * Math.cos(phi)), ang = Math.atan2(Math.cos(s.dec) * Math.sin(s.ra - m.ra), Math.sin(s.dec) * Math.cos(m.dec) - Math.cos(s.dec) * Math.sin(m.dec) * Math.cos(s.ra - m.ra));
  return { anteil: (1 + Math.cos(inc)) / 2, phase: 0.5 + 0.5 * inc * (ang < 0 ? -1 : 1) / PI };
}
const PHASEN = [[0.03, "Neumond"], [0.22, "zunehmende Sichel"], [0.28, "zunehmender Halbmond (erstes Viertel)"], [0.47, "zunehmender Mond"], [0.53, "Vollmond"], [0.72, "abnehmender Mond"], [0.78, "abnehmender Halbmond (letztes Viertel)"], [0.97, "abnehmende Sichel"], [1.01, "Neumond"]];
const phasenName = p => PHASEN.find(x => p < x[0])[1];
function naechste(datum, ziel) { // naechster Neumond (0) oder Vollmond (0.5), stundenweise gesucht
  let vor = mondPhase(datum).phase;
  for (let i = 1; i <= 24 * 31; i++) { const t = new Date(datum.valueOf() + i * 3600000), p = mondPhase(t).phase; if (ziel === 0 ? (p < vor && vor > 0.9 && p < 0.1) : (vor < 0.5 && p >= 0.5)) return t; vor = p; }
  return null;
}
const TZ = "Europe/Berlin";
const uhr = d => d ? d.toLocaleTimeString("de-DE", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }) : null;
const kurz = d => d ? d.toLocaleDateString("de-DE", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" }) : null;
function tagesStart(ymd) { const t = new Date(ymd + "T00:00:00Z"), mitte = new Date(ymd + "T12:00:00Z"), off = new Date(mitte.toLocaleString("en-US", { timeZone: TZ })) - new Date(mitte.toLocaleString("en-US", { timeZone: "UTC" })); return new Date(t.valueOf() - off); }
const dauer = (a, b) => { const m = Math.round((b - a) / 60000); return Math.floor(m / 60) + " Std " + (m % 60) + " Min"; };

async function sonneMond(a, ctx) {
  const heute = new Date().toLocaleDateString("sv-SE", { timeZone: TZ }), ymd = /^\d{4}-\d{2}-\d{2}$/.test(String(a.datum || "")) ? a.datum : heute;
  let lat, lon, ort = "";
  if (a.ort) { const key = await K.schluesselHolen("maps").catch(() => null); try { const p = await Fa.geocode(a.ort, key); lat = p.lat; lon = p.lon; ort = String(a.ort); } catch (e) { return { ok: false, hinweis: e.unbekannt ? "Den Ort '" + e.unbekannt + "' kenne ich noch nicht. Frage nach der Adresse." : "Den Ort '" + a.ort + "' habe ich nicht gefunden. Frage nach." }; } }
  else if (ctx && ctx.standort && isFinite(ctx.standort.lat) && isFinite(ctx.standort.lon)) { lat = +ctx.standort.lat; lon = +ctx.standort.lon; ort = "deinem Standort"; }
  else { const key = await K.schluesselHolen("maps").catch(() => null); const p = await Fa.geocode("heim", key); lat = p.lat; lon = p.lon; ort = "zu Hause"; }
  const mitte = new Date(ymd + "T12:00:00Z"), s = sonnenZeiten(mitte, lat, lon, -0.833 * rad), dae = sonnenZeiten(mitte, lat, lon, -6 * rad), nu = new Date();
  const mz = mondZeiten(tagesStart(ymd), lat, lon), ph = mondPhase(mitte), voll = naechste(mitte, 0.5), neu = naechste(mitte, 0);
  const sonne = { aufgang: uhr(s.auf), untergang: uhr(s.unter), mittag: uhr(s.mittag), tageslaenge: s.auf && s.unter ? dauer(s.auf, s.unter) : null, daemmerung_beginn: uhr(dae.auf), daemmerung_ende: uhr(dae.unter), polar: s.immer };
  if (ymd === heute && s.auf && s.unter) sonne.jetzt = nu < s.auf ? "noch nicht aufgegangen" : nu < s.unter ? "ist oben" : "schon untergegangen";
  const mond = { phase: phasenName(ph.phase), beleuchtung_prozent: Math.round(ph.anteil * 100), zunehmend: ph.phase < 0.5, aufgang: uhr(mz.auf), untergang: uhr(mz.unter), naechster_vollmond: kurz(voll), naechster_neumond: kurz(neu) };
  return { ok: true, ort, datum: ymd, sonne, mond, hinweis: "Alle Zeiten in deutscher Zeit, so vorlesen. Nur nennen, was gefragt ist; bei 'wann geht die Sonne unter' reicht der Untergang. Mond: Phase und Beleuchtung nur wenn gefragt. Mond ohne Auf-/Untergang an diesem Tag ist normal (ehrlich so sagen)." };
}
module.exports = { sonneMond, mondPhase, sonnenZeiten, mondZeiten };
