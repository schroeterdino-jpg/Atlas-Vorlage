"use strict";
process.env.VERCEL_PROJECT_PRODUCTION_URL = "atlas-beispiel.vercel.app"; // Test laeuft als Altbestand-Kopie (Profil des Erfinders)
// Prueft die Werkzeug-Schleife: KI ruft Werkzeug, Ergebnis geht zurueck, Antwort kommt; nicht gebaute Werkzeuge werden ehrlich gemeldet.
const assert = require("assert");
const store = {}; let aufrufe = [];
let skript = []; const vlog = [];
global.fetch = async (url, o) => {
  url = String(url);
  if (url.startsWith("https://db.test")) {
    const c = JSON.parse(o.body); let result = null;
    if (c[0] === "HSET") { store[c[2]] = c[3]; result = 1; } else if (c[0] === "HGET") result = store[c[2]] || null;
    else if (c[0] === "GET") result = null; else if (c[0] === "INCR") result = 1; else if (c[0] === "EXPIRE") result = 1;
    return { json: async () => ({ result }) };
  }
  if (url.startsWith("https://vektor.test")) {
    const pfad = url.slice("https://vektor.test".length), b = JSON.parse(o.body); vlog.push([pfad, b, o.headers.Authorization]);
    if (pfad === "/query-data") return { ok: true, json: async () => ({ result: [{ id: "alt1", score: 0.8, data: "Finny ist die Enkelin von Sam.", metadata: { datum: "2026-10-09" } }, { id: "alt2", score: 0.3, data: "Unwichtig", metadata: {} }] }) };
    return { ok: true, json: async () => ({ result: { ok: 1 } }) };
  }
  if (url.includes("chat/completions")) { aufrufe.push(JSON.parse(o.body)); const m = skript.shift(); return { ok: true, status: 200, json: async () => ({ choices: [{ message: m }] }) }; }
  return { ok: false, status: 404 };
};
process.env.ATLAS_SECRET = "mein-langes-passwort"; process.env.KV_REST_API_URL = "https://db.test"; process.env.KV_REST_API_TOKEN = "t";
const K = require("../api/_keys.js"), denken = require("../api/denken.js"), W = require("../api/_werkzeuge.js");
function run(h, body) { return new Promise(r => { const res = { setHeader() {}, status(c) { this.c = c; return this; }, json(j) { r([this.c, j]); } }; h({ method: "POST", headers: {}, body }, res); }); }
const call = (id, name, args) => ({ content: "", tool_calls: [{ id, type: "function", function: { name, arguments: JSON.stringify(args) } }] });
(async () => {
  const pw = "mein-langes-passwort"; await K.schluesselSpeichern("groq", "gsk_test");
  // jedes Werkzeug hat Name, Beschreibung, Parameter
  const namen = W.LISTE.map(w => w.name); assert.strictEqual(new Set(namen).size, namen.length, "Namen eindeutig");
  for (const w of W.LISTE) assert.ok(w.beschreibung && w.parameter && w.titel, w.name);
  for (const n of ["wetter", "schicht", "termine", "erinnerung", "einkauf", "wecker", "whatsapp", "navigation", "gedaechtnis", "uhrzeit", "pakete", "steuern"]) assert.ok(namen.includes(n), n + " fehlt");
  // Uhrzeit-Werkzeug laeuft wirklich
  let e = await W.ausfuehren("uhrzeit", { zeitzone: "Asia/Tokyo" }); assert.ok(e.ok && /\d{2}:\d{2}/.test(e.text));
  e = await W.ausfuehren("uhrzeit", { zeitzone: "Quatsch/Stadt" }); assert.strictEqual(e.ok, false);
  // nicht gebaut -> ehrlicher Hinweis, kein Absturz
  e = await W.ausfuehren("pakete", { anfrage: "x" }); assert.ok(e.noch_nicht_gebaut);
  e = await W.ausfuehren("gibtsnicht", {}); assert.strictEqual(e.ok, false);
  // Schleife: Werkzeug, dann Antwort
  skript = [call("c1", "uhrzeit", { zeitzone: "America/New_York" }), { content: "[de] In New York ist es gerade früher Morgen." }];
  let [c, j] = await run(denken, { pw, text: "wie spät ist es bei den Amis" });
  assert.deepStrictEqual([j.ok, j.antwort, j.sprache], [true, "In New York ist es gerade früher Morgen.", "de"]);
  assert.ok(j.werkzeuge.length === 1 && j.werkzeuge[0].name === "uhrzeit" && j.werkzeuge[0].ok && j.werkzeuge[0].args.zeitzone === "America/New_York" && j.werkzeuge[0].erg.ok, "Werkzeug-Daten fuer die Animation");
  const zweiter = aufrufe[1].messages; assert.strictEqual(zweiter[zweiter.length - 1].role, "tool", "Ergebnis geht an die KI zurueck");
  assert.ok(aufrufe[0].tools.length === W.LISTE.length, "alle Werkzeuge gehen an die KI");
  // nicht gebautes Werkzeug -> KI bekommt Hinweis, Antwort kommt trotzdem
  skript = [call("c2", "pakete", { anfrage: "Wo ist mein Paket?" }), { content: "[de] Das Wetter kann ich noch nicht abrufen." }];
  [, j] = await run(denken, { pw, text: "muss ich morgen nen Schirm mitnehmen" });
  assert.strictEqual(j.werkzeuge[0].name, "pakete"); assert.strictEqual(j.werkzeuge[0].ok, false); assert.ok(/noch nicht/.test(j.antwort));
  assert.ok(/noch_nicht_gebaut/.test(aufrufe[aufrufe.length - 1].messages.pop().content));
  // Endlosschleife wird gestoppt
  skript = [1, 2, 3, 4].map(i => call("x" + i, "uhrzeit", {}));
  [, j] = await run(denken, { pw, text: "loop" }); assert.strictEqual(j.ok, false, "nach 4 Runden ohne Antwort Abbruch mit Meldung");
  // Langzeitgedaechtnis
  await K.schluesselSpeichern("vektorurl", "https://vektor.test/"); await K.schluesselSpeichern("vektortoken", "tok");
  aufrufe = []; vlog.length = 0; skript = [{ content: "[de] Finny ist deine Enkelin." }];
  [, j] = await run(denken, { pw, text: "Wer ist Finny?" });
  assert.ok(/Finny ist die Enkelin/.test(aufrufe[0].messages[0].content), "passende Erinnerung steht im Systemtext");
  assert.ok(!/Unwichtig/.test(aufrufe[0].messages[0].content), "schwache Treffer bleiben draussen");
  assert.strictEqual(vlog[0][2], "Bearer tok");
  vlog.length = 0; e = await W.ausfuehren("gedaechtnis", { aktion: "merken", text: "Leon mag Samsaurier." });
  assert.ok(e.ok && /^a_/.test(e.id)); assert.strictEqual(vlog[0][0], "/upsert-data"); assert.strictEqual(vlog[0][1].data, "Leon mag Samsaurier.");
  vlog.length = 0; e = await W.ausfuehren("gedaechtnis", { aktion: "vergessen", text: "Finny" });
  assert.ok(e.bestaetigung_noetig && e.kandidaten[0].id === "alt1" && !vlog.some(v => v[0] === "/delete"), "ohne Bestaetigung wird nichts geloescht");
  e = await W.ausfuehren("gedaechtnis", { aktion: "vergessen", text: "Finny", id: "alt1", bestaetigt: true });
  assert.ok(e.ok); assert.deepStrictEqual(vlog.find(v => v[0] === "/delete")[1], ["alt1"]);
  e = await W.ausfuehren("gedaechtnis", { aktion: "suchen", text: "Finny" }); assert.ok(e.ok && e.treffer.length === 2);
    skript = [call("v1", "gedaechtnis", { aktion: "vergessen", text: "Finny" }), { content: "[de] Soll ich das löschen?" }];
  [, j] = await run(denken, { pw, text: "vergiss Finny" });
  assert.ok(!j.werkzeuge[0].fehler, "Rueckfrage vor dem Loeschen ist kein Fehler");
  await K.schluesselSpeichern("vektortoken", ""); await K.schluesselLoeschen("vektortoken");
  skript = [call("m1", "gedaechtnis", { aktion: "merken", text: "Test" }), { content: "[de] Das geht nicht." }];
  [, j] = await run(denken, { pw, text: "merk dir Test" });
  assert.ok(j.werkzeuge[0].fehler && /Vektor/.test(j.werkzeuge[0].fehler), "echte Fehler bleiben sichtbar");
    // Einkaufsliste, Aufgaben, Erinnerungen
  e = await W.ausfuehren("einkauf", { aktion: "hinzufuegen", eintraege: ["Milch", "Eier", "Milch"] }); assert.deepStrictEqual(e.hinzugefuegt, ["Milch", "Eier"]); assert.strictEqual(e.offen_gesamt, 2);
  e = await W.ausfuehren("einkauf", { aktion: "hinzufuegen", eintraege: ["milch"] }); assert.deepStrictEqual(e.schon_vorhanden, ["milch"], "Doppelte werden erkannt");
  e = await W.ausfuehren("einkauf", { aktion: "hinzufuegen", eintraege: ["Milch.", " 2 Liter Milch", "MILCH"] }); assert.deepStrictEqual(e.hinzugefuegt, [], "Schreibweise, Menge und Satzzeichen sind egal"); assert.strictEqual(e.schon_vorhanden.length, 3);
  e = await W.ausfuehren("einkauf", { aktion: "hinzufuegen", eintraege: ["Eier", "10 Eier", "Eiern"] }); assert.deepStrictEqual(e.hinzugefuegt, [], "Eier stehen schon drauf, Mehrzahl und Menge erkannt");
  e = await W.ausfuehren("einkauf", { aktion: "hinzufuegen", eintraege: ["laktosefreie Milch"] }); assert.deepStrictEqual(e.hinzugefuegt, []); assert.strictEqual(e.aehnlich[0].vorhanden, "Milch", "aehnlich: nachfragen statt doppelt eintragen");
  e = await W.ausfuehren("einkauf", { aktion: "hinzufuegen", eintraege: ["laktosefreie Milch"], trotzdem: true }); assert.deepStrictEqual(e.hinzugefuegt, ["laktosefreie Milch"]); await W.ausfuehren("einkauf", { aktion: "entfernen", eintraege: ["laktosefreie Milch"] });
  e = await W.ausfuehren("einkauf", { aktion: "hinzufuegen", eintraege: ["Hafermilch"] }); assert.deepStrictEqual(e.hinzugefuegt, ["Hafermilch"], "Hafermilch ist nicht Milch"); await W.ausfuehren("einkauf", { aktion: "entfernen", eintraege: ["Hafermilch"] });
  e = await W.ausfuehren("einkauf", { aktion: "abhaken", eintraege: ["eier"] }); assert.deepStrictEqual(e.erledigt, ["Eier"]);
  e = await W.ausfuehren("einkauf", { aktion: "zeigen" }); assert.deepStrictEqual(e.offen.map(x => x.text), ["Milch"]); assert.strictEqual(e.erledigt_anzahl, 1);
  await W.ausfuehren("einkauf", { aktion: "hinzufuegen", eintraege: ["Vollmilch"] });
  e = await W.ausfuehren("einkauf", { aktion: "entfernen", eintraege: ["mil"] }); assert.ok(e.mehrdeutig.length === 1, "Bei mehreren Treffern wird nachgefragt, nicht geraten");
  e = await W.ausfuehren("einkauf", { aktion: "leeren" }); assert.ok(e.bestaetigung_noetig, "Leeren nur nach Bestaetigung");
  e = await W.ausfuehren("einkauf", { aktion: "leeren", bestaetigt: true }); assert.ok(e.ok); e = await W.ausfuehren("einkauf", { aktion: "zeigen" }); assert.strictEqual(e.offen.length, 0);
  e = await W.ausfuehren("aufgaben", { aktion: "hinzufuegen", eintraege: ["Reifen wechseln"], faellig: "2026-11-30" }); assert.ok(e.ok);
  e = await W.ausfuehren("aufgaben", { aktion: "zeigen" }); assert.strictEqual(e.offen[0].faellig, "2026-11-30");
  e = await W.ausfuehren("erinnerung", { aktion: "anlegen", text: "Arzt anrufen", zeit: "morgen früh" }); assert.strictEqual(e.ok, false, "falsches Zeitformat wird abgelehnt");
  e = await W.ausfuehren("erinnerung", { aktion: "anlegen", text: "Arzt anrufen", zeit: "2020-01-01T07:30" }); assert.ok(e.ok);
  await W.ausfuehren("erinnerung", { aktion: "anlegen", text: "Später", zeit: "2099-01-01T07:30" });
  skript = [{ content: "[de] Hallo, wie kann ich helfen?" }];
  [, j] = await run(denken, { pw, text: "hallo" }); assert.strictEqual(j.antwort, "Erinnerung: Arzt anrufen. Hallo, wie kann ich helfen?", "faellige Erinnerung steht fest vor der Antwort, unabhaengig von der KI");
  skript = [{ content: "[de] Hallo." }]; [, j] = await run(denken, { pw, text: "nochmal" }); assert.strictEqual(j.antwort, "Hallo.", "wird nur einmal gemeldet, kuenftige nicht");
  e = await W.ausfuehren("erinnerung", { aktion: "loeschen", text: "arzt" }); assert.ok(e.bestaetigung_noetig);
  e = await W.ausfuehren("erinnerung", { aktion: "loeschen", text: "arzt", bestaetigt: true }); assert.ok(e.ok);
  e = await W.ausfuehren("erinnerung", { aktion: "zeigen" }); assert.deepStrictEqual(e.offen.map(x => x.text), ["Später"]);
    skript = [{ content: "Aufgabe „Reifen   “ ?? Oops! formatting Oops…  Need ? … [de] Aufgabe „Reifen wechseln“ wurde hinzugefügt." }];
  [, j] = await run(denken, { pw, text: "x" }); assert.deepStrictEqual([j.antwort, j.sprache], ["Aufgabe „Reifen wechseln“ wurde hinzugefügt.", "de"], "Denkreste vor dem Sprachcode werden entfernt");
    // gleicher Tag: eine Minute vorher ist faellig, eine Minute nachher nicht
  const LL = require("../api/_listen.js"), jt = LL.jetztBerlin(); assert.ok(/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(jt), "gleiche Schreibweise wie gespeicherte Zeiten: " + jt);
  const mm = d => new Date(Date.now() + d * 60000).toLocaleString("sv-SE", { timeZone: "Europe/Berlin" }).slice(0, 16).replace(" ", "T");
  await W.ausfuehren("erinnerung", { aktion: "anlegen", text: "Gleicher Tag vorbei", zeit: mm(-1) }); await W.ausfuehren("erinnerung", { aktion: "anlegen", text: "Gleicher Tag spaeter", zeit: mm(30) });
  skript = [{ content: "[de] Hallo." }]; [, j] = await run(denken, { pw, text: "hallo" });
  assert.strictEqual(j.antwort, "Erinnerung: Gleicher Tag vorbei. Hallo.", "Erinnerung vom selben Tag wird gemeldet, spaetere nicht");
  console.log("werkzeuge: alle Pruefungen gruen");
})().catch(e => { console.error(e); process.exit(1); });
