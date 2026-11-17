"use strict";
process.env.VERCEL_PROJECT_PRODUCTION_URL = "atlas-beispiel.vercel.app"; // Test laeuft als Altbestand-Kopie (Profil des Erfinders)
// Prueft Fahrzeit, Verkehr und Abfahrt mit Schein-Diensten (kein Netz noetig).
const assert = require("assert");
const hs = {}; const urls = []; const routenBodies = []; let google = "ok";
global.fetch = async (url, o) => {
  url = String(url); o = o || {}; urls.push(url);
  if (url.startsWith("https://db.test")) { const c = JSON.parse(o.body); let result = null; if (c[0] === "HSET") { hs[c[1] + "/" + c[2]] = c[3]; result = 1; } else if (c[0] === "HGET") result = hs[c[1] + "/" + c[2]] || null; else if (c[0] === "SET") { hs[c[1]] = c[2]; result = "OK"; } else if (c[0] === "GET") result = hs[c[1]] || null; return { json: async () => ({ result }) }; }
  if (url.includes("nominatim")) return { ok: true, json: async () => (url.includes("Nirgendwo") ? [] : [{ lat: "53.50", lon: "10.48", display_name: "Test, Musterstadt" }]) };
  if (url.includes("maps.googleapis.com/maps/api/geocode")) return { ok: true, json: async () => ({ results: [{ geometry: { location: { lat: 53.5, lng: 10.48 } }, formatted_address: "Google-Adresse", address_components: [{ long_name: "B404", types: ["route"] }, { long_name: "Kasseburg", types: ["locality"] }] }] }) };
  if (url.includes("routes.googleapis.com")) { routenBodies.push(String(o.body)); if (google === "aus") return { ok: false, status: 403, json: async () => ({}) }; return { ok: true, json: async () => ({ routes: [{ duration: "1500s", staticDuration: "900s", distanceMeters: 12300, polyline: { encodedPolyline: "_p~iF~ps|U_ulLnnqC_mqNvxq`@" }, travelAdvisory: { speedReadingIntervals: [{ startPolylinePointIndex: 1, endPolylinePointIndex: 2, speed: "TRAFFIC_JAM" }, { endPolylinePointIndex: 1, speed: "SLOW" }] } }] }) }; }
  if (url.includes("router.project-osrm.org")) return { ok: true, json: async () => ({ routes: [{ duration: 840, distance: 9800, geometry: { coordinates: [[10.48, 53.5], [10.5, 53.52], [10.55, 53.55]] } }] }) };
  return { ok: false, status: 404, json: async () => ({}) };
};
process.env.ATLAS_SECRET = "mein-langes-passwort"; process.env.KV_REST_API_URL = "https://db.test"; process.env.KV_REST_API_TOKEN = "t";
const K = require("../api/_keys.js"), W = require("../api/_werkzeuge.js"), Kal = require("../api/_kalender.js");
(async () => {
  // ohne Google-Schluessel: OSRM, ehrlich ohne Live-Verkehr
  let e = await W.ausfuehren("verkehr", {});
  assert.ok(e.ok && e.fahrzeit_min === 14 && e.live_verkehr === false && /ohne Live/.test(e.quelle) && /Schlüssel/.test(e.hinweis), "ohne Schluessel: OSRM, ohne Verkehrslage");
  assert.ok(e.karte && e.karte.punkte.length === 3 && e.karte.punkte.every(p => p[2] === 0), "OSRM: Linie ohne Staustufen");
  assert.ok(urls.some(u => u.includes("nominatim") && /Beispielring/.test(decodeURIComponent(u))), "Arbeitsadresse wird gesucht");
  const n = urls.filter(u => u.includes("nominatim")).length; await W.ausfuehren("verkehr", {}); assert.strictEqual(urls.filter(u => u.includes("nominatim")).length, n, "Adressen werden gemerkt");
  e = await W.ausfuehren("verkehr", { von: "arbeit" }); assert.ok(e.ok); assert.ok(urls.slice(-3).some(u => u.includes("osrm")), "Heimweg");
  e = await W.ausfuehren("verkehr", { nach: "Nirgendwo 1" }); assert.ok(!e.ok && /nicht gefunden/.test(e.hinweis) && !e.technisch);
  // Adressen: zeigen, aendern nur nach Bestaetigung, danach wird die neue gesucht
  e = await W.ausfuehren("adressen", { aktion: "zeigen" }); assert.ok(e.ok && /Musterweg/.test(e.heim) && /Beispielring/.test(e.arbeit), "Adressen werden gezeigt");
  e = await W.ausfuehren("adressen", { aktion: "setzen", ort: "arbeit", adresse: "Hauptstrasse 5, 21481 Lauenburg" }); assert.ok(!e.ok && e.bestaetigung_noetig, "Aenderung braucht Bestaetigung");
  assert.ok(!/Lauenburg/.test(((await W.ausfuehren("adressen", { aktion: "zeigen" })).arbeit)), "ohne Ja nichts gespeichert");
  e = await W.ausfuehren("adressen", { aktion: "setzen", ort: "arbeit", adresse: "Nirgendwo 1" }); assert.ok(!e.ok && /nicht gefunden/.test(e.hinweis), "unbekannte Adresse wird abgelehnt");
  e = await W.ausfuehren("adressen", { aktion: "setzen", ort: "arbeit", adresse: "Hauptstrasse 5, 21481 Lauenburg", bestaetigt: true }); assert.ok(e.ok, "nach Ja gespeichert");
  assert.ok(/Lauenburg/.test((await W.ausfuehren("adressen", { aktion: "zeigen" })).arbeit), "neue Arbeitsadresse gilt");
  await W.ausfuehren("verkehr", {}); assert.ok(urls.some(u => /Lauenburg/.test(decodeURIComponent(u))), "Fahrzeit nutzt die neue Adresse");
  // Unbekanntes Familienwort wird nie als Ortsname gesucht (Mutter = 818 km weit weg)
  let vorher = urls.length; e = await W.ausfuehren("verkehr", { nach: "Mutter" });
  assert.ok(!e.ok && e.ort_unbekannt && !urls.slice(vorher).some(u => /Mutter/i.test(decodeURIComponent(u))), "unbekannte Mutter wird nicht gesucht: " + JSON.stringify(e));
  // Eigene Orte: speichern nur nach Ja, danach reicht der Name; loeschen nur nach Ja
  e = await W.ausfuehren("meine_orte", { aktion: "setzen", name: "Mutter", adresse: "Königsberger Allee 10, Musterstadt" }); assert.ok(!e.ok && e.bestaetigung_noetig, "Ort speichern braucht Ja");
  assert.strictEqual((await W.ausfuehren("meine_orte", { aktion: "zeigen" })).orte.length, 0, "ohne Ja nichts gespeichert");
  e = await W.ausfuehren("meine_orte", { aktion: "setzen", name: "Mutter", adresse: "Königsberger Allee 10, Musterstadt", bestaetigt: true }); assert.ok(e.ok);
  e = await W.ausfuehren("verkehr", { nach: "mutter" }); assert.ok(e.ok && !urls.slice(-3).some(u => /Mutter/i.test(decodeURIComponent(u))), "Fahrzeit zu mutter: Name wird nicht als Ortssuche missverstanden");
  e = await W.ausfuehren("verkehr", { nach: "Mama" }); assert.ok(e.ok, "Mama findet den Ort 'Mutter'");
  e = await W.ausfuehren("meine_orte", { aktion: "loeschen", name: "Mutter" }); assert.ok(!e.ok && e.bestaetigung_noetig, "Loeschen braucht Ja");
  e = await W.ausfuehren("meine_orte", { aktion: "loeschen", name: "Mutter", bestaetigt: true }); assert.ok(e.ok && (await W.ausfuehren("meine_orte", { aktion: "zeigen" })).orte.length === 0, "geloescht");
  e = await W.ausfuehren("meine_orte", { aktion: "loeschen", name: "Gibtsnicht", bestaetigt: true }); assert.ok(!e.ok, "unbekannter Ort");
  // mit Schluessel: Live-Verkehr
  await K.schluesselSpeichern("maps", "AIza-test");
  e = await W.ausfuehren("verkehr", {}); assert.ok(e.ok && e.fahrzeit_min === 25 && e.normal_min === 15 && e.verzoegerung_min === 10 && e.live_verkehr && /Verzögerung/.test(e.hinweis), "Live-Verkehr: 10 Minuten Verzoegerung");
  assert.ok(e.karte && e.karte.punkte.length === 3 && e.karte.punkte[0][2] === 1 && e.karte.punkte[1][2] === 2 && Math.abs(e.karte.punkte[0][0] - 38.5) < 1e-6 && e.karte.nach === "arbeit", "Google: Kartenlinie mit Staustufen: " + JSON.stringify(e.karte));
  assert.ok(e.staus && e.staus.length >= 1 && e.staus[0].grad === "stark" && e.staus[0].strasse === "B404" && e.staus[0].bei === "Kasseburg" && !e.staus[0].bis_ort && e.staus[0].richtung === "Kasseburg" && e.lage === "leicht erhöht" && /STAUSTELLEN/.test(e.hinweis) && /^Stau: .* km auf der B404 bei Kasseburg, in Fahrtrichtung Kasseburg\.$/.test(e.staus[0].satz), "Staustellen mit Strasse und Ort: " + JSON.stringify(e.staus));
  assert.ok(!e.karte.stausRoh, "Rohdaten nicht in der Karte");
  google = "aus"; e = await W.ausfuehren("verkehr", {}); assert.ok(e.ok && !e.live_verkehr && /Routes API/.test(e.hinweis), "Google-Fehler wird benannt, Fahrzeit kommt trotzdem"); google = "ok";
  // Wann losfahren, um um 12:00 anzukommen (morgen, Prognose)
  { const morgen = Kal.plusTage(Kal.heute(), 1); routenBodies.length = 0;
    e = await W.ausfuehren("verkehr", { nach: "arbeit", ankunft: morgen + "T12:00" });
    assert.ok(e.ok && e.ankunft_ziel === "12:00" && e.abfahrt_spaetestens === "11:35" && e.abfahrt_empfohlen === "11:25" && e.fahrzeit_zur_abfahrt_min === 25 && !e.zu_spaet && /Prognose/.test(e.hinweis), "Ankunft 12:00 -> spaetestens 11:35, mit Puffer 11:25: " + JSON.stringify(e).slice(0, 400));
    assert.ok(routenBodies.some(b => /departureTime/.test(b) && /TRAFFIC_AWARE_OPTIMAL/.test(b)), "Google bekommt die Abfahrtszeit zur Prognose");
    const gleich = new Date(Date.now() + 5 * 60000).toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" });
    e = await W.ausfuehren("verkehr", { nach: "arbeit", ankunft: gleich }); assert.ok(e.ok && e.zu_spaet === true && /ACHTUNG/.test(e.hinweis), "5 Minuten bis zur Ankunft bei 25 Minuten Fahrt: zu spaet");
    e = await W.ausfuehren("verkehr", { nach: "arbeit", ankunft: "irgendwann" }); assert.ok(!e.ok, "unverstaendliche Zeit fragt nach"); }
  // Abfahrt
  e = await W.ausfuehren("abfahrt", { aktion: "zeigen" }); assert.ok(!e.ok && /nicht gesetzt/.test(e.hinweis), "ohne Schicht: nachfragen");
  const h = Kal.heute(), dd = new Date(h + "T12:00:00Z"), mo = Kal.plusTage(h, 7 - ((dd.getUTCDay() + 6) % 7)); // naechster Montag
  e = await W.ausfuehren("schicht", { aktion: "festlegen", schicht: "spaet", woche: "naechste" }); assert.ok(e.ok);
  e = await W.ausfuehren("abfahrt", { aktion: "zeigen", datum: mo }); assert.ok(e.ok && e.abfahrt === "12:45" && e.beginn === "13:45" && e.ankunft === "13:25" && e.schicht === "Spätschicht");
  e = await W.ausfuehren("abfahrt", { aktion: "frueher_los", datum: mo, beginn: "13:15" }); assert.ok(e.ok && e.zeiten.abfahrt === "12:15" && e.zeiten.ankunft === "12:55" && e.zeiten.beginn === "13:15", "30 Minuten frueher");
  e = await W.ausfuehren("schicht", { aktion: "abfragen", von: mo, bis: mo }); assert.strictEqual(e.tage[0].zeiten.abfahrt, "12:15", "Schichtplan kennt die Ausnahme");
  e = await W.ausfuehren("abfahrt", { aktion: "frueher_los", datum: mo, beginn: "14:30" }); assert.ok(!e.ok, "spaeterer Beginn ist kein frueher los");
  e = await W.ausfuehren("abfahrt", { aktion: "frueher_los", datum: mo, beginn: "13:00" }); assert.strictEqual(e.zeiten.abfahrt, "12:00", "zweite Aenderung rechnet vom normalen Beginn, nicht doppelt");
  e = await W.ausfuehren("abfahrt", { aktion: "rueckgaengig", datum: mo }); assert.ok(e.ok && e.zeiten.abfahrt === "12:45" && !e.zeiten.ausnahme, "rueckgaengig");
  e = await W.ausfuehren("abfahrt", { aktion: "zeigen", datum: Kal.plusTage(mo, 5) }); assert.ok(e.ok && /Wochenende/.test(e.tag) && !e.abfahrt, "Wochenende: keine Fahrt");
  if (new Date(h + "T12:00:00Z").getUTCDay() % 6 !== 0) { e = await W.ausfuehren("abfahrt", { aktion: "zeigen" }); assert.ok(e.ok && e.fahrzeit_jetzt_min === 25 && e.empfehlung && (!(e.kaffee_puffer_min > 0) || /grünen Bereich/.test(e.empfehlung)), "heute: wenn Puffer da ist, keine Hetze (Sam faehrt frueh wegen Kaffee); uhrzeitunabhaengig"); }
  console.log("fahrt: alle Pruefungen gruen");
})().catch(e => { console.error(e); process.exit(1); });
