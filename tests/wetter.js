"use strict";
process.env.VERCEL_PROJECT_PRODUCTION_URL = "atlas-beispiel.vercel.app"; // Test laeuft als Altbestand-Kopie (Profil des Erfinders)
// Prueft das Wetter-Werkzeug mit Schein-Diensten (kein Netz noetig).
const assert = require("assert");
const urls = []; let modus = "normal";
const jetzt = new Date().toLocaleString("sv-SE", { timeZone: "Europe/Berlin" }).slice(0, 13).replace(" ", "T");
const std = h => { const d = new Date(jetzt + ":00:00Z"); d.setUTCHours(d.getUTCHours() + h); return d.toISOString().slice(0, 13) + ":00"; };
const tag0 = jetzt.slice(0, 10);
global.fetch = async url => {
  url = String(url); urls.push(url);
  if (url.includes("geocoding-api")) { return { ok: true, json: async () => (url.includes("Nirgendwo") ? {} : { results: [{ name: "Wien", country: "Österreich", latitude: 48.2, longitude: 16.37 }] }) }; }
  if (url.includes("open-meteo.com/v1/forecast")) {
    if (modus === "kaputt") return { ok: false, status: 500, json: async () => ({}) };
    const n = 30, time = Array.from({ length: n }, (_, i) => std(i));
    return { ok: true, json: async () => ({
      current: { temperature_2m: 7.4, apparent_temperature: 4.1, precipitation: 0, weather_code: 3, wind_speed_10m: 22.2, wind_gusts_10m: 40 },
      hourly: { time, temperature_2m: time.map(() => 7), precipitation_probability: time.map((_, i) => (modus === "regen" && i >= 3 ? 80 : 5)), precipitation: time.map((_, i) => (modus === "regen" && i >= 3 ? 1.2 : 0)), weather_code: time.map(() => 3), wind_speed_10m: time.map(() => 20) },
      daily: { time: Array.from({ length: 7 }, (_, i) => { const d = new Date(tag0 + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + i); return d.toISOString().slice(0, 10); }), weather_code: Array(7).fill(61), temperature_2m_max: Array(7).fill(9.6), temperature_2m_min: Array(7).fill(3.2), precipitation_sum: Array(7).fill(2.5), precipitation_probability_max: Array(7).fill(70), wind_gusts_10m_max: Array(7).fill(55), sunrise: Array(7).fill(tag0 + "T07:30"), sunset: Array(7).fill(tag0 + "T16:10") }
    }) };
  }
  if (url.includes("brightsky")) { if (modus === "warnung") return { ok: true, json: async () => ({ alerts: [{ headline_de: "Amtliche WARNUNG vor STURMBÖEN", severity: "moderate", onset: tag0 + "T12:00", expires: "2099-01-01T00:00", description_de: "Es treten Sturmböen auf." }] }) }; if (modus === "warnfehler") return { ok: false, status: 503, json: async () => ({}) }; return { ok: true, json: async () => ({ alerts: [] }) }; }
  return { ok: false, status: 404, json: async () => ({}) };
};
const W = require("../api/_werkzeuge.js");
(async () => {
  let e = await W.ausfuehren("wetter", {});
  assert.ok(e.ok && e.ort === "Musterstadt", "ohne Ort gilt der Wohnort"); assert.ok(urls.some(u => /latitude=53\.55/.test(u) && /longitude=9\.99/.test(u)), "Koordinaten von Musterstadt");
  assert.strictEqual(e.aktuell.temperatur, 7.4); assert.strictEqual(e.aktuell.wetter, "bedeckt"); assert.strictEqual(e.stunden.length, 12); assert.strictEqual(e.tage.length, 7); assert.strictEqual(e.tage[0].wetter, "leichter Regen");
  assert.strictEqual(e.empfehlung.schirm, false, "kein Regen in den naechsten Stunden"); assert.strictEqual(e.empfehlung.jacke, true, "unter 10 Grad: Jacke"); assert.deepStrictEqual(e.warnungen, []);
  modus = "regen"; e = await W.ausfuehren("wetter", {}); assert.ok(e.empfehlung.schirm && e.empfehlung.regen_ab === std(3), "Regen ab drei Stunden ab jetzt");
  e = await W.ausfuehren("wetter", { von: std(4), bis: std(6) }); assert.strictEqual(e.stunden.length, 3); assert.strictEqual(e.stunden[0].zeit, std(4), "Zeitfenster wird beachtet");
  e = await W.ausfuehren("wetter", { ort: "Wien" }); assert.ok(e.ok && /Wien/.test(e.ort) && urls.some(u => /latitude=48\.2/.test(u)), "anderer Ort");
  e = await W.ausfuehren("wetter", { ort: "Nirgendwo" }); assert.ok(!e.ok && !e.technisch && /nicht gefunden/.test(e.hinweis), "unbekannter Ort: ehrlich");
  modus = "warnung"; e = await W.ausfuehren("wetter", {}); assert.strictEqual(e.warnungen.length, 1); assert.ok(/STURMB/.test(e.warnungen[0].titel) && /Warnung/i.test(e.hinweis));
  modus = "warnfehler"; e = await W.ausfuehren("wetter", {}); assert.ok(e.ok && e.warnungen.length === 0, "ohne Warndienst gibt es trotzdem Wetter");
  modus = "kaputt"; e = await W.ausfuehren("wetter", {}); assert.ok(!e.ok && e.technisch && /500/.test(e.hinweis), "Wetterdienst ausgefallen: echter Fehler wird gemeldet");
  console.log("wetter: alle Pruefungen gruen");
})().catch(e => { console.error(e); process.exit(1); });
