"use strict";
// Fahrzeit, Verkehr und Abfahrt. Fahrzeit mit Live-Verkehr ueber Google Routes (Schluessel "maps"), sonst OSRM ohne Verkehr.
const K = require("./_keys.js");
const P = require("./_plan.js");
const Kal = require("./_kalender.js");
const Pf = require("./_profil.js");
const standard = async () => { const p = await Pf.laden(); const o = {}; if (p.heim) o.heim = p.heim; if (p.arbeit) o.arbeit = p.arbeit; return o; };
const abfrage = async (url, opt) => { const r = await fetch(url, Object.assign({ signal: AbortSignal.timeout(9000) }, opt)); return r; };

// Heim und Arbeit: gespeicherte Adresse (Redis atlas:plan, Feld adressen), sonst die Startwerte
async function adressen() { const st = await standard().catch(() => ({})); try { const r = await K.redis(["HGET", "atlas:plan", "adressen"]); return Object.assign({}, st, r ? JSON.parse(r) : {}); } catch (e) { return Object.assign({}, st); } }
// Eigene Orte mit Namen (Mutter, Matzi, Gartenverein ...): { "mutter": { name: "Mutter", adresse: "..." } }
async function ortListe() { try { const r = await K.redis(["HGET", "atlas:plan", "orte"]); return r ? JSON.parse(r) : {}; } catch (e) { return {}; } }
// Familienwoerter, die gleich gemeint sind (Mama = Mutter = Mutti ...)
const GRUPPEN = [["mama", "mutti", "mutter", "mami", "mum"], ["papa", "vati", "vater", "pappa"], ["oma", "omi", "großmutter", "grossmutter"], ["opa", "opi", "großvater", "grossvater"], ["frau", "ehefrau"], ["tochter"], ["sohn"], ["enkel", "enkelin"]];
const gruppe = k => GRUPPEN.find(g => g.includes(k)) || null;
function ortFinden(liste, text) { const k = ortKey(text); if (liste[k]) return liste[k]; const g = gruppe(k); if (g) { const t = g.find(x => liste[x]); if (t) return liste[t]; } return null; }
const ortKey = n => String(n || "").trim().toLowerCase().replace(/\s+/g, " ");

async function geocode(text, key) {
  const k = String(text).trim().toLowerCase();
  const kp = k.match(/^(-?\d{1,2}(?:\.\d+)?),\s*(-?\d{1,3}(?:\.\d+)?)$/); if (kp) return { lat: +kp[1], lon: +kp[2], name: "Standort" }; // Handy-Standort als Koordinaten
  let adr = String(text);
  if (k === "heim" || k === "arbeit") adr = (await adressen())[k];
  else {
    const o = ortFinden(await ortListe(), text);
    if (o && o.adresse) adr = o.adresse;
    else if (o || gruppe(ortKey(text))) { const e = new Error("unbekannter Ort"); e.unbekannt = String(text).trim(); throw e; }
  }
  const ck = adr.toLowerCase();
  try { const c = await K.redis(["HGET", "atlas:geo", ck]); if (c) return JSON.parse(c); } catch (e) {}
  let p = null;
  if (key) {
    const r = await abfrage("https://maps.googleapis.com/maps/api/geocode/json?language=de&region=de&address=" + encodeURIComponent(adr) + "&key=" + encodeURIComponent(key));
    const j = r.ok ? await r.json() : null; const g = j && j.results && j.results[0];
    if (g) p = { lat: g.geometry.location.lat, lon: g.geometry.location.lng, name: g.formatted_address };
  }
  if (!p) {
    const r = await abfrage("https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=de&q=" + encodeURIComponent(adr), { headers: { "User-Agent": "Atlas-Assistent/1.0" } });
    if (!r.ok) throw new Error("Adresssuche antwortet nicht (" + r.status + ")");
    const j = await r.json(); if (j[0]) p = { lat: +j[0].lat, lon: +j[0].lon, name: j[0].display_name };
  }
  if (!p) return null;
  try { await K.redis(["HSET", "atlas:geo", ck, JSON.stringify(p)]); } catch (e) {}
  return p;
}

// Google-Linie (codiert) -> [[lat, lon], ...]
function polylineLesen(enc) {
  const out = []; let i = 0, lat = 0, lon = 0;
  while (i < enc.length) {
    for (const ziel of [0, 1]) { let sh = 0, r = 0, b; do { b = enc.charCodeAt(i++) - 63; r |= (b & 31) << sh; sh += 5; } while (b >= 32 && i <= enc.length); const d = (r & 1) ? ~(r >> 1) : (r >> 1); if (ziel === 0) lat += d; else lon += d; }
    out.push([lat / 1e5, lon / 1e5]);
  }
  return out;
}
// Kartendaten fuer die Animation: hoechstens ~140 Punkte [lat, lon, stufe], stufe 0 frei, 1 zaehfliessend, 2 Stau
function karteBauen(pts, intervalle) {
  if (!Array.isArray(pts) || pts.length < 2) return null;
  const stufe = new Array(pts.length).fill(0);
  (intervalle || []).forEach(v => { const a = v.startPolylinePointIndex || 0, e = v.endPolylinePointIndex || 0, w = v.speed === "TRAFFIC_JAM" ? 2 : v.speed === "SLOW" ? 1 : 0; for (let k = a; k < e && k < pts.length; k++) stufe[k] = Math.max(stufe[k], w); });
  const schritt = Math.max(1, Math.ceil(pts.length / 140)), aus = [];
  pts.forEach((p, k) => { if (k === 0 || k === pts.length - 1 || k % schritt === 0 || stufe[k] !== stufe[k - 1] || stufe[k] !== stufe[k + 1]) aus.push([Math.round(p[0] * 1e5) / 1e5, Math.round(p[1] * 1e5) / 1e5, stufe[k]]); });
  return { punkte: aus, stausRoh: stauStellen(pts, stufe) };
}
const rad = x => x * Math.PI / 180;
function km2(a, b) { const dl = rad(b[0] - a[0]), dn = rad(b[1] - a[1]), h = Math.sin(dl / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dn / 2) ** 2; return 12742 * Math.asin(Math.sqrt(h)); }
// Zusammenhaengende Teilstuecke mit Verkehr (Stufe 1 zaehfliessend, 2 Stau): Laenge, Anfang, Ende, Abstand vom Start; die schlimmsten drei in Fahrtreihenfolge
function stauStellen(pts, stufe) {
  const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + km2(pts[i - 1], pts[i]));
  const runs = []; let i = 0;
  while (i < pts.length - 1) { if (stufe[i] > 0) { let j = i, g = 0; while (j < pts.length - 1 && stufe[j] > 0) { g = Math.max(g, stufe[j]); j++; } runs.push({ grad: g, km: Math.round((cum[j] - cum[i]) * 10) / 10, von: pts[i], bis: pts[j], ab_km: Math.round(cum[i] * 10) / 10, i }); i = j; } else i++; }
  return runs.filter(r => r.km >= 0.25).sort((a, b) => b.grad - a.grad || b.km - a.km).slice(0, 3).sort((a, b) => a.i - b.i);
}
// Strasse und Ort zu einem Punkt (Google mit Schluessel, sonst Nominatim), gemerkt in atlas:geo
async function ortZuPunkt(p, key) {
  const ck = "rev:" + p[0].toFixed(3) + "," + p[1].toFixed(3);
  try { const c = await K.redis(["HGET", "atlas:geo", ck]); if (c) { const o0 = JSON.parse(c); if (o0 && typeof o0.stadt === "string") return o0; } } catch (e) {}
  let o = null;
  try {
    if (key) {
      const r = await abfrage("https://maps.googleapis.com/maps/api/geocode/json?language=de&latlng=" + p[0] + "," + p[1] + "&result_type=route|locality&key=" + encodeURIComponent(key));
      const j = r.ok ? await r.json() : null, g = j && j.results && j.results[0];
      if (g) { const c = g.address_components || [], f = t => (c.find(x => (x.types || []).includes(t)) || {}).long_name; o = { strasse: f("route") || "", ort: f("sublocality") || f("locality") || "", stadt: f("locality") || "" }; }
    }
    if (!o) {
      const r = await abfrage("https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=17&accept-language=de&lat=" + p[0] + "&lon=" + p[1], { headers: { "User-Agent": "Atlas-Assistent/1.0" } });
      const j = r.ok ? await r.json() : null, a = j && j.address;
      if (a) o = { strasse: a.road || "", ort: a.village || a.town || a.suburb || a.city || a.municipality || "", stadt: a.city || a.town || a.village || a.municipality || "" };
    }
  } catch (e) {}
  if (o) { try { await K.redis(["HSET", "atlas:geo", ck, JSON.stringify(o)]); } catch (e) {} }
  return o || { strasse: "", ort: "" };
}
async function stauNamen(roh, key, richtung) {
  const aus = [];
  for (const r of roh || []) {
    const von = await ortZuPunkt(r.von, key), bis = await ortZuPunkt(r.bis, key);
    const eintrag = { grad: r.grad === 2 ? "stark" : "zähflüssig", km: r.km, ab_km: r.ab_km, strasse: von.strasse || bis.strasse || "" };
    if (von.ort && bis.ort && von.ort !== bis.ort) { eintrag.von_ort = von.ort; eintrag.bis_ort = bis.ort; } else eintrag.bei = von.ort || bis.ort || "";
    if (richtung) eintrag.richtung = richtung;
    const km = String(r.km).replace(".", ",") + " km", wo = eintrag.strasse ? "auf der " + eintrag.strasse.replace(/^(\S+)$/, "$1") : "";
    eintrag.satz = (eintrag.grad === "stark" ? "Stau" : "Zähflüssig") + ": " + km + (wo ? " " + wo : "") + (eintrag.bei ? " bei " + eintrag.bei : " zwischen " + eintrag.von_ort + " und " + eintrag.bis_ort) + (richtung ? ", in Fahrtrichtung " + richtung : "") + ".";
    aus.push(eintrag);
    if (!key) await new Promise(res => setTimeout(res, 1100)); // Nominatim: hoechstens eine Anfrage pro Sekunde
  }
  return aus;
}

async function route(a, b, key, abfahrt) {
  let hinweis = "", fern = abfahrt instanceof Date && abfahrt.getTime() > Date.now() + 60000;
  if (key) {
    try {
      const r = await abfrage("https://routes.googleapis.com/directions/v2:computeRoutes", { method: "POST", headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": "routes.duration,routes.staticDuration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.travelAdvisory.speedReadingIntervals" },
        body: JSON.stringify({ origin: { location: { latLng: { latitude: a.lat, longitude: a.lon } } }, destination: { location: { latLng: { latitude: b.lat, longitude: b.lon } } }, travelMode: "DRIVE", routingPreference: fern ? "TRAFFIC_AWARE_OPTIMAL" : "TRAFFIC_AWARE", departureTime: fern ? abfahrt.toISOString() : undefined, extraComputations: ["TRAFFIC_ON_POLYLINE"], languageCode: "de-DE", units: "METRIC" }) });
      if (r.ok) { const j = await r.json(), g = j.routes && j.routes[0]; if (g && g.duration) return { minuten: Math.round(parseInt(g.duration) / 60), normal_minuten: Math.round(parseInt(g.staticDuration || g.duration) / 60), km: Math.round(g.distanceMeters / 100) / 10, live: !fern, prognose: fern, quelle: fern ? "Google Prognose für die Abfahrtszeit" : "Google mit Live-Verkehr", karte: g.polyline && g.polyline.encodedPolyline ? karteBauen(polylineLesen(g.polyline.encodedPolyline), g.travelAdvisory && g.travelAdvisory.speedReadingIntervals) : null }; }
      else hinweis = "Google Routes antwortet mit " + r.status + " (in der Google Cloud Console die 'Routes API' aktivieren)";
    } catch (e) { hinweis = "Google Routes nicht erreichbar"; }
  }
  const r = await abfrage("https://router.project-osrm.org/route/v1/driving/" + a.lon + "," + a.lat + ";" + b.lon + "," + b.lat + "?overview=full&geometries=geojson");
  if (!r.ok) throw new Error("Routenrechner antwortet nicht (" + r.status + ")");
  const j = await r.json(), g = j.routes && j.routes[0]; if (!g) return null;
  const m = Math.max(1, Math.round(g.duration / 60));
  return { minuten: m, normal_minuten: m, km: Math.round(g.distance / 100) / 10, live: false, quelle: "OSRM ohne Live-Verkehr", karte: g.geometry && Array.isArray(g.geometry.coordinates) ? karteBauen(g.geometry.coordinates.map(c => [c[1], c[0]]), []) : null, hinweis: hinweis || (key ? "" : "Ohne Google-Maps-Schlüssel gibt es keine Live-Verkehrslage.") };
}

async function strecke(von, nach, abfahrt) {
  const key = await K.schluesselHolen("maps").catch(() => null);
  let a, b;
  try { a = await geocode(von, key); b = await geocode(nach, key); }
  catch (e) { if (e.unbekannt) return { ok: false, hinweis: "'" + e.unbekannt + "' ist noch nicht als Ort gespeichert. Sam nach der Adresse fragen (Straße, Hausnummer, Ort) und mit kontakte speichern, dann die Fahrzeit nennen. Nicht raten.", ort_unbekannt: e.unbekannt }; throw e; }
  if (!a || !b) return { ok: false, hinweis: "Die Adresse '" + (!a ? von : nach) + "' habe ich nicht gefunden. Nach der genauen Adresse fragen." };
  const r = await route(a, b, key, abfahrt); if (!r) return { ok: false, hinweis: "Dafür habe ich keine Route gefunden." };
  let staus = []; const roh = r.karte && r.karte.stausRoh; if (r.karte) delete r.karte.stausRoh;
  if (roh && roh.length && r.live) { try { const zo = await ortZuPunkt([b.lat, b.lon], key); staus = await stauNamen(roh, key, zo.stadt || zo.ort); } catch (e) {} }
  return Object.assign({ ok: true, von: a.name, nach: b.name, verzoegerung_min: Math.max(0, r.minuten - r.normal_minuten), staus }, r);
}

// Tool "adressen": Heim- und Arbeitsadresse zeigen oder aendern (Aenderung erst nach Bestaetigung)
async function adressenTool(a) {
  const alle = await adressen();
  if (a.aktion !== "setzen") return { ok: true, heim: alle.heim, arbeit: alle.arbeit };
  const ort = String(a.ort || "").toLowerCase();
  if (ort !== "heim" && ort !== "arbeit") return { ok: false, hinweis: "Welche Adresse soll geändert werden: Heim oder Arbeit?" };
  if (!a.adresse || String(a.adresse).trim().length < 5) return { ok: false, hinweis: "Wie lautet die neue Adresse (Straße, Hausnummer, Ort)?" };
  const key = await K.schluesselHolen("maps").catch(() => null);
  let p; try { p = await geocode(String(a.adresse).trim(), key); } catch (e) { return { ok: false, technisch: true, hinweis: "Adresssuche gerade nicht erreichbar: " + String(e.message || e) }; }
  if (!p) return { ok: false, hinweis: "Die Adresse '" + a.adresse + "' habe ich nicht gefunden. Nach der genauen Adresse mit Ort fragen." };
  if (!a.bestaetigt) return { ok: false, bestaetigung_noetig: true, gefunden: p.name, alt: alle[ort], hinweis: "Sam die gefundene Adresse vorlesen und fragen, ob das stimmt. Erst nach Ja mit bestaetigt:true erneut aufrufen." };
  const neu = Object.assign({}, alle, { [ort]: String(a.adresse).trim() });
  await K.redis(["HSET", "atlas:plan", "adressen", JSON.stringify(neu)]);
  return { ok: true, ort, gespeichert: neu[ort], gefunden: p.name, hinweis: "Gespeichert. Fahrzeit und Abfahrt rechnen ab sofort damit." };
}

// Tool "meine_orte": eigene Orte mit Namen zeigen, speichern, loeschen (Speichern und Loeschen erst nach Bestaetigung)
async function orteTool(a) {
  const liste = await ortListe(), alle = await adressen();
  const zeigen = () => ({ heim: alle.heim, arbeit: alle.arbeit, orte: Object.values(liste).map(o => ({ name: o.name, adresse: o.adresse, telefon: o.telefon })) });
  if (a.aktion !== "setzen" && a.aktion !== "loeschen") return Object.assign({ ok: true }, zeigen());
  const name = String(a.name || "").trim(), k = ortKey(name);
  if (!k) return { ok: false, hinweis: "Wie soll der Ort heißen (zum Beispiel Mutter)?" };
  if (k === "heim" || k === "arbeit") return a.aktion === "setzen" ? adressenTool({ aktion: "setzen", ort: k, adresse: a.adresse, bestaetigt: a.bestaetigt }) : { ok: false, hinweis: "Heim und Arbeit kann man nur ändern, nicht löschen." };
  if (a.aktion === "loeschen") {
    if (!liste[k]) return { ok: false, hinweis: "Einen Ort '" + name + "' habe ich nicht gespeichert.", gespeichert: Object.values(liste).map(o => o.name) };
    if (!a.bestaetigt) return { ok: false, bestaetigung_noetig: true, ort: liste[k], hinweis: "Sam fragen, ob '" + liste[k].name + "' gelöscht werden soll. Erst nach Ja mit bestaetigt:true erneut aufrufen." };
    delete liste[k]; await K.redis(["HSET", "atlas:plan", "orte", JSON.stringify(liste)]);
    return { ok: true, geloescht: name };
  }
  if (!a.adresse || String(a.adresse).trim().length < 5) return { ok: false, hinweis: "Wie lautet die Adresse von '" + name + "' (Straße, Hausnummer, Ort)?" };
  const key = await K.schluesselHolen("maps").catch(() => null);
  let p; try { p = await geocode(String(a.adresse).trim(), key); } catch (e) { return { ok: false, technisch: true, hinweis: "Adresssuche gerade nicht erreichbar: " + String(e.message || e) }; }
  if (!p) return { ok: false, hinweis: "Die Adresse '" + a.adresse + "' habe ich nicht gefunden. Nach der genauen Adresse mit Ort fragen." };
  if (!a.bestaetigt) return { ok: false, bestaetigung_noetig: true, gefunden: p.name, alt: liste[k] ? liste[k].adresse : null, hinweis: "Sam die gefundene Adresse vorlesen und fragen, ob das stimmt. Erst nach Ja mit bestaetigt:true erneut aufrufen." };
  liste[k] = Object.assign({}, liste[k], { name, adresse: String(a.adresse).trim() }); await K.redis(["HSET", "atlas:plan", "orte", JSON.stringify(liste)]);
  return { ok: true, gespeichert: name, adresse: liste[k].adresse, gefunden: p.name, hinweis: "Gespeichert. Ab jetzt reicht der Name, zum Beispiel für Fahrzeit." };
}

// Tool "verkehr": Fahrzeit und Verkehrslage; ohne Angaben Heim -> Arbeit, "Heimweg" = Arbeit -> Heim
const BERLIN = "Europe/Berlin", hmBerlin = d => d.toLocaleTimeString("de-DE", { timeZone: BERLIN, hour: "2-digit", minute: "2-digit" });
function offsetBerlin(iso) { const m = new Date(iso + "T12:00:00Z").toLocaleString("sv-SE", { timeZone: BERLIN, timeZoneName: "longOffset" }).match(/GMT([+-]\d{2}:\d{2})/); return m ? m[1] : "+01:00"; }
// "HH:MM" (heute, sonst morgen) oder "JJJJ-MM-TTTHH:MM" in deutscher Zeit -> Date
function ankunftZeit(s) {
  s = String(s || "").trim(); let m;
  if ((m = s.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{1,2}):(\d{2})$/))) return new Date(m[1] + "T" + m[2].padStart(2, "0") + ":" + m[3] + ":00" + offsetBerlin(m[1]));
  if ((m = s.match(/^(\d{1,2}):(\d{2})$/))) { let tag = Kal.heute(), d = new Date(tag + "T" + m[1].padStart(2, "0") + ":" + m[2] + ":00" + offsetBerlin(tag)); if (d.getTime() <= Date.now()) { tag = Kal.plusTage(tag, 1); d = new Date(tag + "T" + m[1].padStart(2, "0") + ":" + m[2] + ":00" + offsetBerlin(tag)); } return d; }
  return null;
}
// Wann losfahren, um zu einer Uhrzeit anzukommen: Fahrzeit zur Abfahrtszeit vorhersagen, bis es passt
async function rueckwaerts(von, nach, ziel) {
  let e = await strecke(von, nach); if (!e.ok) return { e };
  const jetzt = Date.now(); let minuten = e.minuten, dep = new Date(ziel.getTime() - minuten * 60000), zuSpaet = false;
  for (let i = 0; i < 2; i++) {
    if (dep.getTime() <= jetzt + 60000) break;
    const f = await strecke(von, nach, dep); if (!f.ok) break;
    e = f; const neu = new Date(ziel.getTime() - f.minuten * 60000), diff = Math.abs(neu - dep) / 60000; minuten = f.minuten; dep = neu; if (diff <= 3) break;
  }
  if (dep.getTime() <= jetzt + 60000) { zuSpaet = true; dep = new Date(jetzt); }
  return { e, dep, zuSpaet, minuten, spaeteAnkunft: new Date(jetzt + e.minuten * 60000) };
}
async function verkehr(a) {
  const von = String(a.von || "heim").trim(), nach = String(a.nach || (von.toLowerCase() === "heim" ? "arbeit" : "heim")).trim();
  let plan = null;
  if (a.ankunft) { const ziel = ankunftZeit(a.ankunft); if (!ziel) return { ok: false, hinweis: "Die Ankunftszeit habe ich nicht verstanden. Nachfragen (zum Beispiel 12:00)." }; plan = await rueckwaerts(von, nach, ziel); plan.ziel = ziel; if (!plan.e.ok) return plan.e; }
  const e = plan ? plan.e : await strecke(von, nach); if (!e.ok) return e;
  const lage = e.verzoegerung_min < 5 ? "normal" : e.verzoegerung_min < 15 ? "leicht erhöht" : e.verzoegerung_min < 30 ? "dicht" : "sehr dicht";
  const stauHinweis = e.staus && e.staus.length ? "STAUSTELLEN nennen: Straße, 'bei X' oder 'zwischen X und Y', Länge, Grad, Fahrtrichtung (richtung). Jede Staustelle als fertigen Satz (satz) vorlesen. Die Gesamtverzögerung nüchtern in Minuten nennen. Die Verkehrslage genau mit dem Wort aus 'lage' benennen, kein anderes. " : "";
  const ankunftOut = plan ? { ankunft_ziel: hmBerlin(plan.ziel), abfahrt_spaetestens: hmBerlin(plan.dep), abfahrt_empfohlen: hmBerlin(new Date(plan.dep.getTime() - 10 * 60000)), puffer_min: 10, fahrzeit_zur_abfahrt_min: plan.minuten, zu_spaet: plan.zuSpaet || undefined, fruehestens_da: plan.zuSpaet ? hmBerlin(plan.spaeteAnkunft) : undefined } : null;
  const ankunftHinweis = plan ? (plan.zuSpaet ? "ACHTUNG: Selbst wenn Sam jetzt sofort losfährt, ist er erst um " + ankunftOut.fruehestens_da + " Uhr da, nicht um " + ankunftOut.ankunft_ziel + ". Das ehrlich sagen. " : "Sam will um " + ankunftOut.ankunft_ziel + " Uhr da sein: nenne 'abfahrt_spaetestens' als späteste Abfahrt und 'abfahrt_empfohlen' (mit 10 Minuten Puffer) als Empfehlung, dazu die Fahrzeit (fahrzeit_zur_abfahrt_min). Das ist eine Prognose für die Abfahrtszeit, kein Live-Verkehr, das kurz so sagen. ") : "";
  const weit = e.km > 250 ? "ACHTUNG: Das sind " + Math.round(e.km) + " km. Wahrscheinlich ist das der falsche Ort. Sam die gefundene Adresse (" + e.nach + ") nennen und fragen, ob das stimmt, bevor du die Fahrzeit nennst. " : "";
  return Object.assign({ ok: true, lage, staus: e.staus && e.staus.length ? e.staus : undefined, karte: e.karte ? Object.assign({}, e.karte, { von: String(von).trim(), nach: String(nach).trim() }) : undefined, weit_weg: !!weit, fahrzeit_min: e.minuten, normal_min: e.normal_minuten, verzoegerung_min: e.verzoegerung_min, km: e.km, live_verkehr: e.live, quelle: e.quelle, von: e.von, nach: e.nach, hinweis: ankunftHinweis + stauHinweis + weit + (e.hinweis || (e.verzoegerung_min >= 5 ? "Es gibt " + e.verzoegerung_min + " Minuten Verzögerung durch Verkehr." : "")) }, ankunftOut || {});
}

// Tool "abfahrt": wann los (aus Schichtplan + Fahrzeit), frueher los fuer einen Tag, rueckgaengig
async function abfahrt(a) {
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(a.datum || "") ? a.datum : Kal.heute();
  const t = await P.tagInfo(iso);
  if (!t) return { ok: false, hinweis: "Die Schicht dieser Woche ist noch nicht gesetzt. Sam fragen, welche Schicht er hat, und mit dem Werkzeug schicht festlegen." };
  if (!t.zeiten) return { ok: true, datum: iso, tag: t.art, hinweis: "An diesem Tag (" + t.art + ") ist keine Arbeitsfahrt." };
  if (a.aktion === "frueher_los" || a.aktion === "rueckgaengig") {
    if (a.aktion === "rueckgaengig") { await P.ausnahme(iso, 0); const n = await P.tagInfo(iso); return { ok: true, datum: iso, zurueckgesetzt: true, zeiten: n.zeiten }; }
    if (!/^\d{1,2}:\d{2}$/.test(String(a.beginn || ""))) return { ok: false, hinweis: "Es fehlt, wann Sam an dem Tag anfangen muss (HH:MM). Nachfragen." };
    const alt = P.minuten((await P.tagInfo(iso, true)).zeiten.beginn), neu = P.minuten(a.beginn.padStart(5, "0")), vor = Math.min(180, alt - neu);
    if (!(vor > 0)) return { ok: false, hinweis: "Der Beginn liegt nicht vor dem normalen Beginn (" + P.hm(alt) + "). Sam fragen, ob er etwas anderes meint." };
    await P.ausnahme(iso, vor); const n = await P.tagInfo(iso);
    return { ok: true, datum: iso, frueher: vor + " Minuten", zeiten: n.zeiten, hinweis: "Abfahrt und Ankunft sind um " + vor + " Minuten vorverlegt. Rückgängig mit aktion rueckgaengig." };
  }
  const out = { ok: true, datum: iso, schicht: t.art, abfahrt: t.zeiten.abfahrt, ankunft: t.zeiten.ankunft, beginn: t.zeiten.beginn, ende: t.zeiten.ende, ausnahme: t.zeiten.ausnahme };
  if (iso === Kal.heute()) {
    try {
      const f = await strecke("heim", "arbeit");
      if (f.ok) { out.staus = f.staus && f.staus.length ? f.staus : undefined; out.karte = f.karte ? Object.assign({}, f.karte, { von: "heim", nach: "arbeit" }) : undefined; out.fahrzeit_jetzt_min = f.minuten; out.fahrzeit_normal_min = f.normal_minuten; out.live_verkehr = f.live; out.quelle = f.quelle; const ein = P.minuten(t.zeiten.abfahrt) + f.minuten, ziel = P.minuten(t.zeiten.ankunft), beginn = P.minuten(t.zeiten.beginn);
        out.ankunft_geplant = P.hm(ein); out.puffer_bis_beginn_min = beginn - ein; out.kaffee_puffer_min = ziel - ein;
        // Sam faehrt absichtlich frueh (Kaffee vor der Schicht): erst wenn der Kaffee-Zeitpunkt wackelt, lohnt ein Hinweis
        if (ein <= ziel) out.empfehlung = "Alles im grünen Bereich: Du bist trotz Verkehr um " + out.ankunft_geplant + " Uhr da, vor deinem Kaffee-Ziel (" + t.zeiten.ankunft + " Uhr). Keine Eile.";
        else if (ein <= beginn) out.empfehlung = "Der Kaffee wird knapp: Ankunft " + out.ankunft_geplant + " Uhr statt " + t.zeiten.ankunft + " Uhr, Arbeitsbeginn " + t.zeiten.beginn + " Uhr ist aber sicher. Wer den Kaffee will, fährt " + (ein - ziel) + " Minuten früher.";
        else out.empfehlung = "Achtung: Mit dem Verkehr kommst du um " + out.ankunft_geplant + " Uhr, nach Arbeitsbeginn (" + t.zeiten.beginn + " Uhr). Spätestens um " + P.hm(Math.max(0, P.minuten(t.zeiten.abfahrt) - (ein - beginn))) + " Uhr losfahren.";
      }
    } catch (e) { out.fahrzeit_hinweis = "Fahrzeit gerade nicht abrufbar: " + String(e.message || e); }
  }
  return out;
}
module.exports = { ortZuPunkt, verkehr, abfahrt, strecke, adressen: adressenTool, orte: orteTool, geocode, km2, strecke, adressenListe: adressen, ortKey, ortListe, ortFinden };
