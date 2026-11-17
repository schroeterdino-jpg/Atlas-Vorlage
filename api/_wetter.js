"use strict";
// Wetter: Open-Meteo (Vorhersage und Ortssuche, kein Schluessel noetig), Warnungen vom Deutschen Wetterdienst ueber Bright Sky.
const TZ = "Europe/Berlin";
const Pw = require("./_profil.js");
const heim = async () => { const p = await Pw.laden(); return p.lat != null && p.lon != null ? { name: p.ort || "Zuhause", lat: p.lat, lon: p.lon } : null; };
const WOCHENTAG = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
const TEXT = c => c === 0 ? "klar" : c === 1 ? "überwiegend klar" : c === 2 ? "teils bewölkt" : c === 3 ? "bedeckt" : (c === 45 || c === 48) ? "Nebel" : (c >= 51 && c <= 55) ? "Nieselregen" : (c === 56 || c === 57) ? "gefrierender Nieselregen" : (c >= 61 && c <= 65) ? (c === 61 ? "leichter Regen" : c === 63 ? "Regen" : "starker Regen") : (c === 66 || c === 67) ? "gefrierender Regen" : (c >= 71 && c <= 75) ? "Schnee" : c === 77 ? "Schneegriesel" : (c >= 80 && c <= 82) ? "Regenschauer" : (c === 85 || c === 86) ? "Schneeschauer" : c === 95 ? "Gewitter" : c >= 96 ? "Gewitter mit Hagel" : "unbekannt";
const heute = () => new Date().toLocaleString("sv-SE", { timeZone: TZ }).slice(0, 16).replace(" ", "T"); // "2026-11-15T11:30"
const abfrage = async url => { const r = await fetch(url, { signal: AbortSignal.timeout(9000) }); if (!r.ok) throw new Error("Wetterdienst antwortet nicht (" + r.status + ")"); return r.json(); };
const rund = (v, n) => v == null ? null : Math.round(v * (n || 1)) / (n || 1);

async function ort(name) {
  if (!name) return heim();
  const j = await abfrage("https://geocoding-api.open-meteo.com/v1/search?count=1&language=de&name=" + encodeURIComponent(name));
  const o = j.results && j.results[0]; if (!o) return null;
  return { name: o.name + (o.country ? ", " + o.country : ""), lat: o.latitude, lon: o.longitude };
}

async function wetter(a) {
  const o = await ort(String(a.ort || "").trim()); if (!o) return { ok: false, hinweis: "Den Ort '" + a.ort + "' habe ich nicht gefunden. Nach dem genauen Ort fragen." };
  const q = "latitude=" + o.lat + "&longitude=" + o.lon + "&timezone=" + encodeURIComponent(TZ) + "&forecast_days=7&wind_speed_unit=kmh" +
    "&current=temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_gusts_10m" +
    "&hourly=temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m" +
    "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_gusts_10m_max,sunrise,sunset";
  const f = await abfrage("https://api.open-meteo.com/v1/forecast?" + q);
  const jetzt = heute(); const c = f.current || {}, h = f.hourly || {}, d = f.daily || {};
  // Stunden: Fenster von/bis (deutsche Zeit) oder die naechsten 12 Stunden
  const ok16 = s => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(String(s || ""));
  const von = ok16(a.von) ? a.von : jetzt.slice(0, 13) + ":00"; let bis = ok16(a.bis) ? a.bis : null;
  const stunden = []; const zeiten = h.time || [];
  for (let i = 0; i < zeiten.length && stunden.length < 24; i++) {
    const t = zeiten[i]; if (t < von) continue; if (bis ? t > bis : stunden.length >= 12) break;
    stunden.push({ zeit: t, temperatur: rund(h.temperature_2m[i], 10), regen_prozent: h.precipitation_probability ? h.precipitation_probability[i] : null, regen_mm: rund(h.precipitation[i], 10), wetter: TEXT(h.weather_code[i]), wind_kmh: rund(h.wind_speed_10m[i]) });
  }
  const tage = (d.time || []).map((t, i) => ({ datum: t, wochentag: WOCHENTAG[new Date(t + "T12:00:00Z").getUTCDay()], wetter: TEXT(d.weather_code[i]), min: rund(d.temperature_2m_min[i], 10), max: rund(d.temperature_2m_max[i], 10), regen_mm: rund(d.precipitation_sum[i], 10), regen_prozent: d.precipitation_probability_max ? d.precipitation_probability_max[i] : null, boeen_kmh: rund(d.wind_gusts_10m_max[i]), sonnenaufgang: String(d.sunrise[i] || "").slice(11), sonnenuntergang: String(d.sunset[i] || "").slice(11) }));
  // Empfehlung fuer das Fenster
  const regenZeit = stunden.filter(s => (s.regen_prozent || 0) >= 50 || s.regen_mm >= 0.3);
  const kuehl = stunden.length ? Math.min(...stunden.map(s => s.temperatur)) : rund(c.temperature_2m, 10);
  let warnungen = [];
  try {
    const w = await abfrage("https://api.brightsky.dev/alerts?lat=" + o.lat.toFixed(4) + "&lon=" + o.lon.toFixed(4));
    warnungen = (w.alerts || []).filter(x => x.expires ? String(x.expires).slice(0, 16) >= jetzt.slice(0, 16) : true).slice(0, 4).map(x => ({ titel: x.headline_de || x.event_de || "Wetterwarnung", stufe: x.severity, beginn: x.onset, ende: x.expires, text: String(x.description_de || "").slice(0, 200) }));
  } catch (e) { /* Warnungen sind ein Zusatz: ohne sie gibt es trotzdem Wetter */ }
  return {
    ok: true, ort: o.name, jetzt,
    aktuell: { temperatur: rund(c.temperature_2m, 10), gefuehlt: rund(c.apparent_temperature, 10), wetter: TEXT(c.weather_code), niederschlag_mm: rund(c.precipitation, 10), wind_kmh: rund(c.wind_speed_10m), boeen_kmh: rund(c.wind_gusts_10m) },
    stunden, tage,
    empfehlung: { schirm: regenZeit.length > 0, regen_ab: regenZeit.length ? regenZeit[0].zeit : null, jacke: kuehl != null && kuehl < 10 },
    warnungen, hinweis: warnungen.length ? "Es gibt amtliche Wetterwarnungen: immer zuerst und ernst nennen, ohne Spruch." : ""
  };
}
module.exports = { wetter, heim, TEXT };
