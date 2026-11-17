"use strict";
// Orte in der Naehe (Tankstelle, Apotheke, Parkplatz ...): Google Places, sortiert nach Entfernung.
const K = require("./_keys.js");
const Fa = require("./_fahrt.js");

function entfernung(km) { return km < 1 ? Math.round(km * 1000 / 10) * 10 + " m" : String(Math.round(km * 10) / 10).replace(".", ",") + " km"; }
function uhr(iso) { try { return new Date(iso).toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" }); } catch (e) { return ""; } }

const hm = (h, m) => String(h).padStart(2, "0") + ":" + String(m || 0).padStart(2, "0");
// Zeiten eines Wochentags (Google: 0 = Sonntag) aus regularOpeningHours.periods
function zeitenTag(perioden, tag) {
  if (!Array.isArray(perioden) || !perioden.length) return "";
  if (perioden.length === 1 && perioden[0].open && !perioden[0].close) return "rund um die Uhr";
  const t = perioden.filter(q => q.open && q.open.day === tag && q.close).sort((x, y) => x.open.hour - y.open.hour).map(q => hm(q.open.hour, q.open.minute) + "–" + hm(q.close.hour, q.close.minute));
  return t.length ? t.join(", ") : "geschlossen";
}
function wochentag(plus) { const d = new Date(Date.now() + plus * 86400000); const n = d.toLocaleDateString("en-US", { timeZone: "Europe/Berlin", weekday: "short" }); return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(n); }
const SPRIT = /tank|benzin|diesel|sprit|super\b|e10|e5/i;
const eur = v => typeof v === "number" ? v.toFixed(3).replace(".", ",") : null; // Tankpreise haben drei Stellen (2,499)
function sorteVon(a) { const kr = String(a.kraftstoff || "").toLowerCase().replace(/[^a-z0-9]/g, ""); return ["e5", "e10", "diesel"].includes(kr) ? kr : kr === "super" || kr === "benzin" ? "e5" : ""; }
function station(x, sorte) { return { name: String(x.brand || x.name || "Tankstelle").trim(), adresse: [[x.street, x.houseNumber].filter(Boolean).join(" "), x.place].filter(Boolean).join(", "), km: x.dist, entfernung: entfernung(x.dist), offen: typeof x.isOpen === "boolean" ? x.isOpen : null, preise: { e5: eur(x.e5), e10: eur(x.e10), diesel: eur(x.diesel) }, lat: x.lat, lon: x.lng, _p: sorte ? x[sorte] : null }; }
// Abstand eines Punktes zu einer Strecke in km (flache Naeherung reicht auf wenigen km)
function abstandKm(p, a, b) {
  const k = Math.cos(p[0] * Math.PI / 180), ax = (a[1] - p[1]) * k, ay = a[0] - p[0], bx = (b[1] - p[1]) * k, by = b[0] - p[0], dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l2)) : 0;
  return { d: Math.hypot(ax + t * dx, ay + t * dy) * 111.2, t };
}
// Tankstellen entlang einer Route: guenstigste nahe der Strecke
async function unterwegs(a, ctx) {
  const tk = await K.schluesselHolen("tankerkoenig").catch(() => null);
  if (!tk) return { ok: false, hinweis: "Für Tankstellen auf der Strecke fehlt der Tankerkönig-Schlüssel in der Einrichtung." };
  const s = ctx && ctx.standort, von = a.von ? String(a.von) : s && isFinite(s.lat) && isFinite(s.lon) ? s.lat + "," + s.lon : "heim";
  const vonName = a.von ? String(a.von) : von === "heim" ? "heim" : "Standort";
  const e = await Fa.strecke(von, String(a.auf_dem_weg_nach));
  if (!e.ok) return e;
  const P = e.karte && e.karte.punkte;
  if (!P || P.length < 2) return { ok: false, hinweis: "Für diese Strecke habe ich keine Route bekommen." };
  const cum = [0]; for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Fa.km2(P[i - 1], P[i]));
  const gesamt = cum[cum.length - 1], schritt = Math.max(8, gesamt / 10), rad = Math.min(25, Math.max(4, Math.ceil(schritt / 2) + 1)), proben = [];
  for (let d = 0; d < gesamt + schritt; d += schritt) { const i = cum.findIndex(c => c >= Math.min(d, gesamt)); proben.push(P[i < 0 ? P.length - 1 : i]); }
  const antworten = await Promise.all(proben.map(q => fetch("https://creativecommons.tankerkoenig.de/json/list.php?lat=" + q[0] + "&lng=" + q[1] + "&rad=" + rad + "&sort=dist&type=all&apikey=" + encodeURIComponent(tk), { signal: AbortSignal.timeout(9000) }).then(r => r.ok ? r.json() : null).catch(() => null)));
  if (!antworten.some(j => j && j.ok === true)) return { ok: false, technisch: true, hinweis: "Tankerkönig antwortet nicht." };
  const sorte = sorteVon(a), preisArt = sorte || "e10", alle = new Map();
  antworten.forEach(j => ((j && j.stations) || []).forEach(x => alle.set(x.id || x.lat + "," + x.lng, x)));
  const maxAbstand = Math.min(5, Math.max(0.5, +a.max_umweg_km || 2));
  let l = [];
  for (const x of alle.values()) {
    if (x.isOpen === false || typeof x[preisArt] !== "number" && !(sorte === "" && typeof x.diesel === "number")) continue;
    let ab = 1e9, bei = 0; const pt = [x.lat, x.lng];
    for (let i = 0; i < P.length - 1; i++) { const r = abstandKm(pt, P[i], P[i + 1]); if (r.d < ab) { ab = r.d; bei = cum[i] + r.t * (cum[i + 1] - cum[i]); } }
    if (ab > maxAbstand) continue;
    const o = station(x, sorte || preisArt); o.abstand_m = Math.round(ab * 100) * 10; o.bei_km = Math.round(bei * 10) / 10; o.entfernung = "km " + String(o.bei_km).replace(".", ",") + " · " + (ab < 1 ? Math.round(ab * 10) * 100 + " m" : String(Math.round(ab * 10) / 10).replace(".", ",") + " km") + " abseits"; l.push(o);
  }
  l.sort((x, y) => (x._p || 9) - (y._p || 9) || x.bei_km - y.bei_km); l = l.slice(0, 4).map(o => { delete o._p; delete o.km; return o; });
  const karte = { punkte: P, von: vonName, nach: String(a.auf_dem_weg_nach) };
  if (!l.length) return { ok: true, art: "Tankstelle", auf_dem_weg: true, orte: [], nach: e.nach, km: e.km, fahrzeit_min: e.minuten, hinweis: "Keine offene Tankstelle mit Preis nahe der Strecke gefunden. Das ehrlich sagen, anbieten, den Umweg zu erhöhen." };
  return { ok: true, art: "Tankstelle", auf_dem_weg: true, von: vonName, nach: e.nach, km: e.km, fahrzeit_min: e.minuten, kraftstoff: sorte || undefined, orte: l, karte, hinweis: "Die günstigste zuerst nennen: Marke, Ort, Preis pro Liter (gesprochen auf zwei Stellen gerundet), bei km X der Strecke und wie weit sie abseits liegt. " + (sorte ? "" : "Sorte nicht genannt: E10 und Diesel nennen. ") + "Höchstens zwei nennen. Der Abstand ist Luftlinie zur Route (ca.), kein genauer Umweg. Keine Sternchen." };
}
async function sprit(a, mitte, von, hinweis) {
  const tk = await K.schluesselHolen("tankerkoenig").catch(() => null);
  if (!tk) return null;
  const r = await fetch("https://creativecommons.tankerkoenig.de/json/list.php?lat=" + mitte[0] + "&lng=" + mitte[1] + "&rad=10&sort=dist&type=all&apikey=" + encodeURIComponent(tk), { signal: AbortSignal.timeout(9000) });
  const j = r.ok ? await r.json() : null;
  if (!j || j.ok !== true) return { ok: false, technisch: true, hinweis: "Tankerkönig: " + String((j && j.message) || "keine Antwort").slice(0, 120) };
  const sorte = sorteVon(a);
  let l = (j.stations || []).map(x => station(x, sorte));
  if (sorte) l = l.filter(x => typeof x._p === "number" && x.offen !== false);
  if (a.guenstigste && sorte) l.sort((x, y) => x._p - y._p); else l.sort((x, y) => x.km - y.km);
  l = l.slice(0, 5).map(x => { delete x._p; return x; });
  if (!l.length) return { ok: true, orte: [], von, hinweis: "Keine offene Tankstelle mit Preis gefunden. Das ehrlich sagen." };
  return { ok: true, art: "Tankstelle", von, kraftstoff: sorte || undefined, orte: l, hinweis: hinweis + "Preise in Euro pro Liter (Quelle Tankerkönig). Im gesprochenen Text auf zwei Stellen runden (2,499 sagt man als 2,50), die Anzeige zeigt drei Stellen. " + (sorte ? "" : "Sam hat keine Sorte genannt: nenne Super E10 und Diesel. ") + "Entfernung ist Luftlinie (ca.). Höchstens zwei nennen, kurze Sätze, keine Sternchen." };
}

async function nahe(a, ctx) {
  if (a.auf_dem_weg_nach) return unterwegs(a, ctx);
  const was = String(a.art || "").trim();
  if (!was) return { ok: false, hinweis: "Frage kurz nach, was Sam in der Nähe sucht (Tankstelle, Apotheke, Parkplatz ...)." };
  const key = await K.schluesselHolen("maps").catch(() => null);
  if (!key) return { ok: false, hinweis: "Für die Suche in der Nähe fehlt der Google-Maps-Schlüssel in der Einrichtung." };
  let mitte = null, von = "", hinweis = "";
  const s = ctx && ctx.standort;
  if (a.ort) { try { const p = await Fa.geocode(a.ort, key); mitte = [p.lat, p.lon]; von = String(a.ort); } catch (e) { return { ok: false, hinweis: e.unbekannt ? "Den Ort '" + e.unbekannt + "' kenne ich noch nicht. Frage nach der Adresse." : "Den Ort '" + a.ort + "' konnte ich nicht finden. Frage nach." }; } }
  else if (s && isFinite(s.lat) && isFinite(s.lon)) { mitte = [+s.lat, +s.lon]; von = "deinem Standort"; }
  else { const p = await Fa.geocode("heim", key); mitte = [p.lat, p.lon]; von = "deinem Zuhause"; hinweis = "Der Standort vom Handy fehlt, deshalb wurde von zu Hause aus gesucht. Das ehrlich sagen. "; }
  if (SPRIT.test(was) && !/apotheke|parkplatz/i.test(was)) { const sp = await sprit(a, mitte, von, hinweis); if (sp) return sp; }
  const r = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.location,places.currentOpeningHours.openNow,places.currentOpeningHours.nextCloseTime,places.regularOpeningHours.periods", "Content-Type": "application/json" },
    body: JSON.stringify({ textQuery: was, languageCode: "de", pageSize: 5, rankPreference: "DISTANCE", locationBias: { circle: { center: { latitude: mitte[0], longitude: mitte[1] }, radius: 15000 } } }),
    signal: AbortSignal.timeout(9000)
  });
  if (!r.ok) return { ok: false, technisch: true, hinweis: "Orte-Suche antwortet nicht (" + r.status + "). Ist 'Places API (New)' im Google-Konto aktiv?" };
  const j = await r.json();
  const orte = (j.places || []).filter(p => p.location).map(p => {
    const km = Fa.km2(mitte, [p.location.latitude, p.location.longitude]), o = p.currentOpeningHours || {};
    return { name: (p.displayName && p.displayName.text) || was, adresse: String(p.formattedAddress || "").replace(/, Deutschland$/, ""), entfernung: entfernung(km), km: Math.round(km * 100) / 100, offen: typeof o.openNow === "boolean" ? o.openNow : null, schliesst: o.openNow && o.nextCloseTime ? uhr(o.nextCloseTime) : "", heute: zeitenTag((p.regularOpeningHours || {}).periods, wochentag(0)), morgen: zeitenTag((p.regularOpeningHours || {}).periods, wochentag(1)) };
  }).sort((x, y) => x.km - y.km).slice(0, 5);
  if (!orte.length) return { ok: true, orte: [], von, hinweis: "Nichts gefunden. Das ehrlich sagen und anbieten, woanders zu suchen." };
  return { ok: true, art: was, von, orte, hinweis: hinweis + "Entfernung ist Luftlinie, das so sagen (ca.). Das nächste zuerst nennen, mit Entfernung und ob es offen ist (offen: null = unbekannt, nichts behaupten). Öffnungszeiten aus heute und morgen nennen, wenn danach gefragt oder wenn es geschlossen ist. Höchstens zwei nennen, in einem kurzen Satz, den Rest nur auf Nachfrage. Keine Sternchen oder Formatierung." };
}
module.exports = { nahe };
