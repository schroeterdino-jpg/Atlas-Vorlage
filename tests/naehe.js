"use strict";
process.env.VERCEL_PROJECT_PRODUCTION_URL = "atlas-beispiel.vercel.app"; // Test laeuft als Altbestand-Kopie (Profil des Erfinders)
// Prueft "in der Naehe" mit Schein-Diensten.
const assert = require("assert");
const hs = {}; let body = null; const tk = [];
global.fetch = async (url, o) => {
  url = String(url); o = o || {};
  if (url.startsWith("https://db.test")) { const c = JSON.parse(o.body); let result = null; if (c[0] === "HSET") { hs[c[1] + "/" + c[2]] = c[3]; result = 1; } else if (c[0] === "HGET") result = hs[c[1] + "/" + c[2]] || null; return { ok: true, json: async () => ({ result }) }; }
  if (url.includes("tankerkoenig.de/json/list.php")) { tk.push(url); return { ok: true, json: async () => ({ ok: true, stations: [
    { id: "a", lat: 38.5, lng: -120.2, brand: "ARAL", name: "ARAL", street: "Hauptstr.", houseNumber: "1", place: "Musterstadt", dist: 0.8, e5: 1.89, e10: 1.83, diesel: 1.79, isOpen: true },
    { id: "b", lat: 40.7, lng: -120.95, brand: "", name: "Freie Tanke", street: "Weg", houseNumber: "", place: "Elmenhorst", dist: 3.1, e5: 1.85, e10: 1.79, diesel: 1.71, isOpen: true },
    { id: "c", lat: 38.5, lng: -120.2, brand: "Zu", name: "Zu", street: "X", place: "Y", dist: 1.0, e5: 1.7, e10: 1.6, diesel: 1.5, isOpen: false }] }) }; }
  if (url.includes("places.googleapis.com")) { body = JSON.parse(o.body); return { ok: true, json: async () => ({ places: [
    { displayName: { text: "Fern-Tanke" }, formattedAddress: "Weg 9, Hamburg, Deutschland", location: { latitude: 53.60, longitude: 10.0 }, currentOpeningHours: { openNow: false } },
    { displayName: { text: "Nah-Tanke" }, formattedAddress: "Straße 1, Musterstadt, Deutschland", location: { latitude: 53.5, longitude: 10.485 }, currentOpeningHours: { openNow: true, nextCloseTime: "2026-11-15T21:00:00Z" }, regularOpeningHours: { periods: [0,1,2,3,4,5,6].map(d => ({ open: { day: d, hour: 8, minute: 0 }, close: { day: d, hour: 20, minute: 30 } })) } }] }) }; }
  if (url.includes("routes.googleapis.com")) return { ok: true, json: async () => ({ routes: [{ duration: "3600s", staticDuration: "3600s", distanceMeters: 90000, polyline: { encodedPolyline: "_p~iF~ps|U_ulLnnqC_mqNvxq`@" } }] }) };
  if (url.includes("maps.googleapis.com/maps/api/geocode")) return { ok: true, json: async () => ({ results: [{ geometry: { location: { lat: 53.5, lng: 10.48 } }, formatted_address: "Zuhause", address_components: [] }] }) };
  return { ok: false, status: 404, json: async () => ({}) };
};
process.env.ATLAS_SECRET = "mein-langes-passwort"; process.env.KV_REST_API_URL = "https://db.test"; process.env.KV_REST_API_TOKEN = "t";
const K = require("../api/_keys.js"), W = require("../api/_werkzeuge.js");
(async () => {
  let e = await W.ausfuehren("in_der_naehe", { art: "Tankstelle" }, {});
  assert.ok(!e.ok && /Schlüssel/.test(e.hinweis), "ohne Schluessel: ehrlicher Hinweis");
  await K.schluesselSpeichern("maps", "AIza-test");
  e = await W.ausfuehren("in_der_naehe", { art: "Tankstelle" }, { standort: { lat: 53.5, lon: 10.48 } });
  assert.ok(e.ok && e.von === "deinem Standort" && e.orte.length === 2 && e.orte[0].name === "Nah-Tanke" && e.orte[0].offen === true && /^\d{2}:\d{2}$/.test(e.orte[0].schliesst) && e.orte[1].offen === false && /m$/.test(e.orte[0].entfernung) && / km$/.test(e.orte[1].entfernung) && !/Deutschland/.test(e.orte[0].adresse), "sortiert, offen, Entfernung: " + JSON.stringify(e));
  assert.ok(body.locationBias.circle.center.latitude === 53.5 && body.rankPreference === "DISTANCE", "Suche startet am Standort");
  assert.ok(e.orte[0].heute === "08:00–20:30" && e.orte[0].morgen === "08:00–20:30" && e.orte[1].heute === "", "Oeffnungszeiten heute/morgen: " + JSON.stringify(e.orte[0]));
  e = await W.ausfuehren("in_der_naehe", { art: "Tankstelle" }, { standort: { lat: 53.5, lon: 10.48 } });
  assert.ok(e.ok && e.orte[0].name === "Nah-Tanke" && !e.orte[0].preise && tk.length === 0, "ohne Tankerkoenig-Schluessel: Google-Orte");
  await K.schluesselSpeichern("tankerkoenig", "tk-test");
  e = await W.ausfuehren("in_der_naehe", { art: "Tankstelle" }, { standort: { lat: 53.5, lon: 10.48 } });
  assert.ok(e.ok && tk.length === 1 && e.orte.length === 3 && e.orte[0].preise.diesel === "1,790" && e.orte[0].preise.e10 === "1,830", "Spritpreise: " + JSON.stringify(e));
  e = await W.ausfuehren("in_der_naehe", { art: "Tankstelle", kraftstoff: "Diesel", guenstigste: true }, { standort: { lat: 53.5, lon: 10.48 } });
  assert.ok(e.ok && e.kraftstoff === "diesel" && e.orte.length === 2 && e.orte[0].name === "Freie Tanke" && e.orte.every(o => o.offen !== false), "billigster Diesel zuerst, Geschlossene raus");
  tk.length = 0;
  e = await W.ausfuehren("in_der_naehe", { art: "Tankstelle", auf_dem_weg_nach: "Hamburg", kraftstoff: "diesel" }, { standort: { lat: 38.5, lon: -120.2 } });
  assert.ok(e.ok && e.auf_dem_weg && tk.length >= 2 && e.karte.punkte.length === 3 && e.karte.von === "Standort" && e.orte.length === 2 && e.orte[0].name === "Freie Tanke" && e.orte[1].name === "ARAL" && e.orte.every(o => o.offen !== false && isFinite(o.lat) && /abseits/.test(o.entfernung)) && e.orte[0].bei_km > 100, "Tankstellen auf der Strecke, billigste zuerst, Geschlossene raus: " + JSON.stringify(e.orte));
  e = await W.ausfuehren("in_der_naehe", { art: "Tankstelle", auf_dem_weg_nach: "Hamburg", kraftstoff: "diesel", max_umweg_km: 0.5 }, { standort: { lat: 38.5, lon: -120.2 } }); assert.ok(e.ok && e.orte.length >= 1, "kleiner Umweg findet noch die Stationen direkt an der Route");
  e = await W.ausfuehren("in_der_naehe", { art: "Apotheke" }, {});
  assert.ok(e.ok && e.von === "deinem Zuhause" && /Standort vom Handy fehlt/.test(e.hinweis), "ohne Standort: von zu Hause, ehrlich gesagt");
  e = await W.ausfuehren("in_der_naehe", { art: "" }, {}); assert.ok(!e.ok, "ohne Art fragt nach");
  console.log("naehe ok");
})().catch(x => { console.error(x); process.exit(1); });
