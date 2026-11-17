"use strict";
process.env.VERCEL_PROJECT_PRODUCTION_URL = "atlas-beispiel.vercel.app"; // Test laeuft als Altbestand-Kopie (Profil des Erfinders)
// Kontakte: Name + Nummer + Adresse; Speichern/Aendern/Loeschen nur nach Ja; Nummer wird geprueft; Fahrzeit nutzt die Adresse weiter.
const assert = require("assert");
const hs = {}; const urls = [];
global.fetch = async (url, o) => {
  url = String(url); o = o || {}; urls.push(url);
  if (url.startsWith("https://db.test")) { const c = JSON.parse(o.body); let result = null; if (c[0] === "HSET") { hs[c[1] + "/" + c[2]] = c[3]; result = 1; } else if (c[0] === "HGET") result = hs[c[1] + "/" + c[2]] || null; return { ok: true, json: async () => ({ result }) }; }
  if (url.includes("nominatim")) return { ok: true, json: async () => (url.includes("Nirgendwo") ? [] : [{ lat: "53.50", lon: "10.48", display_name: "Test, Musterstadt" }]) };
  if (url.includes("router.project-osrm.org")) return { ok: true, json: async () => ({ routes: [{ duration: 840, distance: 9800, geometry: { coordinates: [[10.48, 53.5], [10.5, 53.52]] } }] }) };
  return { ok: false, status: 404, json: async () => ({}) };
};
process.env.ATLAS_SECRET = "mein-langes-passwort"; process.env.KV_REST_API_URL = "https://db.test"; process.env.KV_REST_API_TOKEN = "t";
const W = require("../api/_werkzeuge.js"), Ko = require("../api/_kontakte.js");
const k = a => W.ausfuehren("kontakte", a);
(async () => {
  assert.deepStrictEqual([Ko.nummer("0171 234 5678"), Ko.nummer("+49 171-2345678"), Ko.nummer("0049171123456"), Ko.nummer("12"), Ko.nummer("abc")], ["01712345678", "+491712345678", "+49171123456", null, null], "Nummern aufraeumen");
  let e = await k({ aktion: "zeigen" }); assert.ok(e.ok && e.anzahl === 0 && /Noch keine/.test(e.hinweis), "leer: ehrlich");
  e = await k({ aktion: "setzen", name: "Matzi", telefon: "0171 234 5678" }); assert.ok(e.ok && e.gespeichert.telefon === "01712345678", "nur Nummer: sofort gespeichert");
  e = await k({ aktion: "setzen", name: "Matzi", telefon: "12" }); assert.ok(!e.ok && /Telefonnummer/.test(e.hinweis), "falsche Nummer abgelehnt");
  e = await k({ aktion: "setzen", name: "Matzi" }); assert.ok(!e.ok && /Nummer oder die Adresse/.test(e.hinweis), "ohne Daten nachfragen");
  e = await k({ aktion: "setzen", name: "matzi", adresse: "Nirgendwo 1" }); assert.ok(!e.ok && /nicht gefunden/.test(e.hinweis), "unbekannte Adresse abgelehnt");
  e = await k({ aktion: "setzen", name: "matzi", adresse: "Bergstrasse 3, Musterstadt" }); assert.ok(!e.ok && e.bestaetigung_noetig, "Adresse braucht Ja");
  assert.ok(!(await k({ aktion: "zeigen", name: "Matzi" })).kontakt.adresse, "ohne Ja keine Adresse");
  e = await k({ aktion: "setzen", name: "matzi", adresse: "Bergstrasse 3, Musterstadt", bestaetigt: true }); assert.ok(e.ok && e.gespeichert.name === "Matzi" && e.gespeichert.telefon === "01712345678" && e.gespeichert.adresse, "Adresse dazu, Name und Nummer bleiben: " + JSON.stringify(e));
  e = await k({ aktion: "setzen", name: "Matzi", telefon: "0172 999 8877" }); assert.ok(!e.ok && e.bestaetigung_noetig && e.alt.telefon === "01712345678", "andere Nummer ueberschreibt nur nach Ja");
  e = await k({ aktion: "setzen", name: "Matzi", telefon: "0172 999 8877", bestaetigt: true }); assert.ok(e.ok && e.gespeichert.telefon === "01729998877");
  // Fahrzeit mit dem Namen geht weiter; ein Kontakt ohne Adresse wird ehrlich gemeldet
  e = await W.ausfuehren("verkehr", { nach: "Matzi" }); assert.ok(e.ok && urls.some(u => u.includes("nominatim") && /Bergstrasse/.test(decodeURIComponent(u))), "Fahrzeit nutzt Kontakt-Adresse");
  await k({ aktion: "setzen", name: "Zahnarzt", telefon: "04151 12345" });
  e = await W.ausfuehren("verkehr", { nach: "Zahnarzt" }); assert.ok(!e.ok && !e.technisch, "Kontakt ohne Adresse: kein Absturz: " + JSON.stringify(e).slice(0, 200));
  // meine_orte ueberschreibt die Nummer nicht
  e = await W.ausfuehren("meine_orte", { aktion: "setzen", name: "Matzi", adresse: "Waldweg 2, Musterstadt", bestaetigt: true }); assert.ok(e.ok);
  assert.strictEqual((await k({ aktion: "zeigen", name: "Matzi" })).kontakt.telefon, "01729998877", "Nummer bleibt nach meine_orte");
  assert.ok(/Dreiergruppen/.test((await k({ aktion: "zeigen", name: "Matzi" })).hinweis), "Nummer wird vorgelesen");
  assert.strictEqual((await k({ aktion: "zeigen", name: "Matz" })).kontakt.name, "Matzi", "Teilname findet");
  e = await k({ aktion: "zeigen", name: "Gibtsnicht" }); assert.ok(!e.ok && /ehrlich/i.test(e.hinweis), "unbekannt: ehrlich");
  e = await k({ aktion: "loeschen", name: "Zahnarzt" }); assert.ok(!e.ok && e.bestaetigung_noetig, "Loeschen braucht Ja");
  assert.strictEqual((await k({ aktion: "zeigen" })).anzahl, 2, "ohne Ja nichts geloescht");
  e = await k({ aktion: "loeschen", name: "Zahnarzt", bestaetigt: true }); assert.ok(e.ok && (await k({ aktion: "zeigen" })).anzahl === 1, "geloescht");
  console.log("kontakte: alle Pruefungen gruen");
})().catch(e => { console.error(e); process.exit(1); });
