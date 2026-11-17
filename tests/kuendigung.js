"use strict";
process.env.VERCEL_PROJECT_PRODUCTION_URL = "atlas-beispiel.vercel.app"; // Test laeuft als Altbestand-Kopie (Profil des Erfinders)
// Kuendigung: fragt nur nach Fehlendem, baut den Brief aus fester Vorlage (nichts erfunden), merkt die letzten 5, Loeschen nur nach Ja.
const assert = require("assert");
const hs = {};
global.fetch = async (url, o) => {
  url = String(url); o = o || {};
  if (url.startsWith("https://db.test")) { const c = JSON.parse(o.body); let result = null; if (c[0] === "SET") { hs[c[1]] = c[2]; result = "OK"; } else if (c[0] === "GET") result = hs[c[1]] || null; else if (c[0] === "HSET") { hs[c[1] + "/" + c[2]] = c[3]; result = 1; } else if (c[0] === "HGET") result = hs[c[1] + "/" + c[2]] || null; return { ok: true, json: async () => ({ result }) }; }
  return { ok: false, status: 404, json: async () => ({}) };
};
process.env.ATLAS_SECRET = "mein-langes-passwort"; process.env.KV_REST_API_URL = "https://db.test"; process.env.KV_REST_API_TOKEN = "t";
const W = require("../api/_werkzeuge.js");
const k = a => W.ausfuehren("kuendigung", a);
(async () => {
  let e = await k({ aktion: "schreiben" }); assert.ok(!e.ok && /Anbieter/.test(e.hinweis) && /Zeitpunkt/.test(e.hinweis), "fragt Anbieter und Zeitpunkt");
  e = await k({ aktion: "schreiben", anbieter: "Vodafone" }); assert.ok(!e.ok && !/Anbieter \(bei/.test(e.hinweis) && /Zeitpunkt/.test(e.hinweis), "nur noch Zeitpunkt fehlt");
  e = await k({ aktion: "schreiben", anbieter: "Vodafone", zeitpunkt: "datum" }); assert.ok(!e.ok && /Datum/.test(e.hinweis), "bei Datum fehlt das Datum");
  e = await k({ aktion: "schreiben", anbieter: "Vodafone", zeitpunkt: "ausserordentlich" }); assert.ok(!e.ok && /Grund/.test(e.hinweis), "ausserordentlich braucht Grund");
  e = await k({ aktion: "schreiben", anbieter: "Vodafone", vertragsart: "Mobilfunkvertrag", nummer: "123456", zeitpunkt: "naechstmoeglich" });
  assert.ok(e.ok && /Sam Mustermann/.test(e.brief) && /Musterweg 13\n12345 Musterstadt/.test(e.brief) && /Vodafone/.test(e.brief) && /Mobilfunkvertrag/.test(e.brief) && /123456/.test(e.brief) && /nächstmöglichen Zeitpunkt/.test(e.brief), e.brief);
  assert.ok(/\[Anschrift des Anbieters bitte ergänzen\]/.test(e.brief) && e.luecken[0] === "Anschrift des Anbieters" && /keine Rechtsberatung/.test(e.hinweis) && /nicht verschickt/.test(e.hinweis), "Luecke ehrlich markiert");
  e = await k({ aktion: "schreiben", anbieter: "Fitness First", zeitpunkt: "datum", datum: "2027-03-31", anbieter_adresse: "Musterstr. 1, 20095 Hamburg" });
  assert.ok(e.ok && /zum 31\. März 2027/.test(e.brief) && /Musterstr\. 1\n20095 Hamburg/.test(e.brief) && !/bitte ergänzen/.test(e.brief) && e.luecken.length === 0 && !/Anschrift des Anbieters fehlt/.test(e.hinweis), e.brief);
  e = await k({ aktion: "schreiben", anbieter: "Abo", zeitpunkt: "ausserordentlich", grund: "Preiserhöhung ohne Zustimmung" }); assert.ok(e.ok && /fristlos/.test(e.brief) && /Preiserhöhung ohne Zustimmung/.test(e.brief) && /hilfsweise ordentlich/.test(e.brief));
  e = await k({ aktion: "schreiben", anbieter: "Test\nZeile", zeitpunkt: "naechstmoeglich" }); assert.ok(e.ok && !/Test\nZeile/.test(e.brief), "Zeilenumbrueche in Eingaben werden entfernt");
  for (let i = 0; i < 4; i++) await k({ aktion: "schreiben", anbieter: "A" + i, zeitpunkt: "naechstmoeglich" });
  assert.strictEqual(JSON.parse(hs["atlas:kuendigungen"]).length, 5, "nur die letzten fuenf");
  e = await k({ aktion: "zeigen" }); assert.ok(e.ok && e.anbieter === "A3" && e.brief && e.anzahl === 5, "neueste zuerst");
  e = await k({ aktion: "zeigen", anbieter: "gibtsnicht" }); assert.ok(!e.ok && e.vorhanden.length === 5, "unbekannt: ehrlich");
  e = await k({ aktion: "loeschen", anbieter: "A1" }); assert.ok(!e.ok && e.bestaetigung_noetig, "Loeschen braucht Ja"); assert.strictEqual(JSON.parse(hs["atlas:kuendigungen"]).length, 5);
  e = await k({ aktion: "loeschen", anbieter: "A1", bestaetigt: true }); assert.ok(e.ok && JSON.parse(hs["atlas:kuendigungen"]).length === 4, "geloescht");
  e = await k({ aktion: "loeschen" }); assert.ok(!e.ok && e.mehrdeutig, "ohne Namen bei mehreren: nachfragen");
  e = await k({ aktion: "schreiben", anbieter: "Neu", zeitpunkt: "naechstmoeglich", name: "Sam Mustermann", anschrift: "Testweg 5, 12345 Teststadt" }); assert.ok(/Testweg 5\n12345 Teststadt/.test(e.brief), "neue Anschrift gilt");
  e = await k({ aktion: "schreiben", anbieter: "Nochmal", zeitpunkt: "naechstmoeglich" }); assert.ok(/Testweg 5/.test(e.brief), "neue Anschrift wird gemerkt");
  // Foto-Brief an die Ehefrau: ohne fuer_name wird nachgefragt, nicht still in Sams Namen geschrieben
  hs["atlas:foto:letztes"] = JSON.stringify({ art: "brief", felder: { absender: "Provinzial Lebensversicherung AG", empfaenger: "Simone Mustermann", empfaenger_anschrift: "Musterweg 13, 12345 Musterstadt" }, at: Date.now() });
  let ep = await k({ aktion: "schreiben", anbieter: "Provinzial Lebensversicherung", zeitpunkt: "naechstmoeglich", nummer: "L1" });
  assert.ok(/NICHT nach der Anschrift/.test(ep.hinweis) && /Sams Anschrift/.test(ep.hinweis), "keine Rueckfrage nach der Anschrift der Person"); assert.ok(!ep.ok && ep.empfaenger_pruefen && ep.empfaenger === "Simone Mustermann" && /Soll ich die Kündigung in ihrem Namen/.test(ep.hinweis), JSON.stringify(ep));
  ep = await k({ aktion: "schreiben", anbieter: "Provinzial Lebensversicherung", zeitpunkt: "naechstmoeglich", eigener_vertrag: true }); assert.ok(ep.ok && /^Sam Mustermann/.test(ep.brief), "Sam bestaetigt: eigener Vertrag");
  ep = await k({ aktion: "schreiben", anbieter: "Vodafone", zeitpunkt: "naechstmoeglich" }); assert.ok(ep.ok, "anderer Anbieter als auf dem Foto: keine Rueckfrage");
  delete hs["atlas:foto:letztes"];
  const ohneAnb = await k({ aktion: "schreiben", zeitpunkt: "naechstmoeglich" }); assert.ok(/nie die einer Person|Anbieter/.test(ohneAnb.hinweis || ""), "Hinweis klar");
  const ohneZ = await k({ aktion: "schreiben", anbieter: "Telekom" }); assert.ok(!ohneZ.ok && /Eine Frage nie wiederholen/.test(ohneZ.hinweis) && /Platzhalter/.test(ohneZ.hinweis), "Anschrift des Anbieters nur einmal, sonst Platzhalter");
  // Vertrag der Ehefrau: Brief in ihrem Namen, nur einmalig (Sams Absender bleibt unveraendert)
  const vor = hs["atlas:plan"] ? JSON.stringify(hs["atlas:plan"]) : "";
  let fk = await k({ aktion: "schreiben", anbieter: "Provinzial Lebensversicherung AG", zeitpunkt: "naechstmoeglich", nummer: "L130666378", vertragsart: "Riester-Rente", fuer_name: "Simone Mustermann", fuer_anschrift: "Musterweg 13, 12345 Musterstadt" });
  assert.ok(fk.ok && /^Simone Mustermann\nMusterweg 13/.test(fk.brief) && /L130666378/.test(fk.brief) && !/Sam Mustermann/.test(fk.brief), fk.brief);
  fk = await k({ aktion: "schreiben", anbieter: "Telekom", zeitpunkt: "naechstmoeglich" }); assert.ok(/^Sam Mustermann/.test(fk.brief), "Sams Absender wurde nicht ueberschrieben");
  // Foto-Brief von der Versicherung, danach nur "Kuendigung": Absender vom Foto wird vorgeschlagen
  hs["atlas:foto:letztes"] = JSON.stringify({ art: "brief", felder: { absender: "Provinzial Lebensversicherung", vertragsnummer: "LV-123", absender_anschrift: "Provinzialplatz 1, 40591 Düsseldorf" }, at: Date.now() });
  let ev = await k({ aktion: "schreiben" });
  assert.ok(!ev.ok && ev.foto_vorschlag && ev.foto_vorschlag.anbieter === "Provinzial Lebensversicherung" && ev.foto_vorschlag.nummer === "LV-123" && /Soll ich Provinzial Lebensversicherung kündigen/.test(ev.hinweis), JSON.stringify(ev));
  hs["atlas:foto:letztes"] = JSON.stringify({ art: "schild_text", felder: {}, at: Date.now() });
  ev = await k({ aktion: "schreiben" }); assert.ok(!ev.ok && !ev.foto_vorschlag, "Schild-Foto liefert keinen Vorschlag");
  delete hs["atlas:foto:letztes"]; ev = await k({ aktion: "schreiben" }); assert.ok(!ev.ok && !ev.foto_vorschlag, "ohne Foto wird normal nach dem Anbieter gefragt");
  const F = require("../api/_foto.js"); assert.ok(/Kündigung schreiben/.test((F.HINWEIS || {}).brief || ""), "Brief-Hinweis bietet Kuendigung an");
  console.log("kuendigung: alle Pruefungen gruen");
})().catch(e => { console.error(e); process.exit(1); });
