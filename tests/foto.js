"use strict";
process.env.VERCEL_PROJECT_PRODUCTION_URL = "atlas-beispiel.vercel.app"; // Test laeuft als Altbestand-Kopie (Profil des Erfinders)
// Foto: Bild wird einmal gelesen, Art und Text gemerkt, Werkzeug liefert Hinweise je Art; Fehler werden ehrlich gemeldet.
const assert = require("assert");
const hs = {}; let groq = "ok", gesehen = [], letzteAnfrage = "";
global.fetch = async (url, o) => {
  url = String(url); o = o || {};
  if (url.startsWith("https://db.test")) { const c = JSON.parse(o.body); let result = null; if (c[0] === "SET") { hs[c[1]] = c[2]; result = "OK"; } else if (c[0] === "GET") result = hs[c[1]] || null; return { ok: true, json: async () => ({ result }) }; }
  if (url.includes("api.groq.com")) {
    const b = JSON.parse(o.body); gesehen.push(b.model); letzteAnfrage = JSON.stringify(b);
    if (groq === "aus") return { ok: false, status: 500, json: async () => ({}) };
    if (groq === "erstes_kaputt" && b.model === "qwen/qwen3.8-27b") return { ok: false, status: 503, json: async () => ({}) };
    const inhalt = groq === "muell" ? "Das ist ein Bild." : "```json\n" + JSON.stringify({ art: groq === "unbekannt" ? "ufo" : "schild_text", beschreibung: "Hinweisschild", text: "UWAGA\nWejście wzbronione", sprache: "PL", felder: { absender: " Vodafone  GmbH ", kundennummer: "K-123", leer: "x", betrag: null } }) + "\n```";
    return { ok: true, json: async () => ({ choices: [{ message: { content: inhalt } }] }) };
  }
  return { ok: false, status: 404, json: async () => ({}) };
};
process.env.ATLAS_SECRET = "mein-langes-passwort"; process.env.KV_REST_API_URL = "https://db.test"; process.env.KV_REST_API_TOKEN = "t";
const F = require("../api/_foto.js"), W = require("../api/_werkzeuge.js"), handler = require("../api/foto.js"), K = require("../api/_keys.js");
const BILD = "data:image/jpeg;base64,/9j/4AAQ";
const antwort = () => { const r = { kopf: {}, status: 200, body: null }; r.setHeader = (k, v) => { r.kopf[k] = v; }; r.status = c => { r.code = c; return r; }; r.json = o => { r.body = o; return r; }; return r; };
(async () => {
  for (const a of ["rezept", "adresse", "person", "produkt"]) assert.ok(F.ARTEN.includes(a) && F.HINWEIS[a], a + " fehlt");
  assert.ok(/nicht an ihrem Gesicht/.test(F.HINWEIS.person), "Personen werden nie erkannt");
  let e = await W.ausfuehren("foto", {}); assert.ok(!e.ok && /kein frisches Foto/.test(e.hinweis), "ohne Foto: ehrlich");
  let f = await F.analysieren(BILD, "k"); assert.deepStrictEqual([f.art, f.sprache, /Wejście/.test(f.text)], ["schild_text", "pl", true], "Fences und Gross/Klein werden verkraftet");
  assert.deepStrictEqual(f.felder, { absender: "Vodafone GmbH", kundennummer: "K-123" }, "Felder bereinigt, unbekannte und leere weg");
  await F.merken(f); e = await W.ausfuehren("foto", {}); assert.strictEqual(e.felder.kundennummer, "K-123", "Felder im Werkzeug"); assert.ok(e.ok && e.art === "schild_text" && /Wejście/.test(e.text) && /in welche Sprache/.test(e.hinweis) && /NICHT sofort/.test(e.hinweis) && /erfinde nichts/.test(e.hinweis) && e.vor_minuten === 0, JSON.stringify(e).slice(0, 200));
  f = await F.analysieren(BILD, "k", "Vodafone GmbH Kundennummer 4711 Rechnung Dezember Betrag 39,99 Euro");
  assert.ok(/EXAKTER TEXT/.test(letzteAnfrage) && /Kundennummer 4711/.test(letzteAnfrage) && /Kundennummer 4711/.test(f.text), "PDF-Text wird mitgegeben und bleibt der Text");
  f = await F.analysieren(BILD, "k", "kurz"); assert.ok(!/EXAKTER TEXT/.test(letzteAnfrage) && /Wejście/.test(f.text), "zu kurzer Dateitext zaehlt nicht");
  groq = "unbekannt"; f = await F.analysieren(BILD, "k"); assert.strictEqual(f.art, "sonstiges", "unbekannte Art -> sonstiges");
  groq = "erstes_kaputt"; gesehen = []; f = await F.analysieren(BILD, "k"); assert.deepStrictEqual(gesehen, ["qwen/qwen3.8-27b", "qwen/qwen3.6-27b"], "zweites Modell als Ersatz");
  groq = "muell"; await assert.rejects(F.analysieren(BILD, "k"), /nicht lesbar/, "Muell-Antwort wird gemeldet");
  groq = "aus"; await assert.rejects(F.analysieren(BILD, "k"), e2 => e2.foto, "Groq down: Fehler");
  for (const art of F.ARTEN) { hs["atlas:foto:letztes"] = JSON.stringify({ art, beschreibung: "x", text: "t", sprache: "de", at: Date.now() - 3 * 60000 }); const r = await W.ausfuehren("foto", {}); assert.ok(r.ok && r.hinweis.length > 40 && r.vor_minuten === 3, "Hinweis fuer " + art); }
  hs["atlas:foto:letztes"] = JSON.stringify({ art: "rechnung", beschreibung: "x", text: "t", sprache: "de", at: Date.now() }); const h = (await W.ausfuehren("foto", {})).hinweis; assert.ok(/kuendigung/.test(h) && /kundennummer/.test(h) && /nicht erneut erfragen/.test(h), "Rechnung: Kuendigung uebernimmt Felder");
  // Handler: Eingabe pruefen
  K.sitzungOk = () => true; K.schluesselHolen = async () => "k"; groq = "ok";
  const aufruf = async b => { const r = antwort(); await handler({ method: "POST", body: b, headers: {} }, r); return r; };
  let r = await aufruf({ bild: "hallo" }); assert.strictEqual(r.code, 400, "kein Foto -> 400");
  r = await aufruf({ bild: "data:image/jpeg;base64," + "A".repeat(3600000) }); assert.strictEqual(r.code, 413, "zu gross -> 413");
  r = await aufruf({ bild: BILD }); assert.ok(r.body.ok && r.body.art === "schild_text" && r.body.text === undefined, "Antwort ohne Volltext: " + JSON.stringify(r.body));
  K.schluesselHolen = async () => null; r = await aufruf({ bild: BILD }); assert.ok(!r.body.ok && /Schlüssel/.test(r.body.fehler), "ohne Schluessel ehrlich");
  K.schluesselHolen = async () => "k"; groq = "aus"; r = await aufruf({ bild: BILD }); assert.ok(!r.body.ok && /nicht lesen/.test(r.body.fehler), "Groq down: freundliche Meldung");
  assert.ok(/NICHT die Anschrift von Betreuer, Berater/.test(require("fs").readFileSync(require("path").join(__dirname, "../api/_foto.js"), "utf8")), "Absender-Anschrift nie vom Betreuer");
  console.log("foto: alle Pruefungen gruen");
})().catch(e => { console.error(e); process.exit(1); });
{ const H = require("../api/_foto.js").HINWEIS; assert.ok(/termin_neu/.test(H.rechnung) && /frist true/.test(H.rechnung) && /frist true/.test(H.brief) && !/Erinnerung merken/.test(H.brief), "Foto: Frist als Termin"); }
{ const H = require("../api/_foto.js").HINWEIS; assert.ok(/Rechtsbehelfsbelehrung/.test(H.brief) && /Rechtsbehelfsbelehrung/.test(H.rechnung) && /noch nicht schreiben/.test(H.brief), "Foto: Behoerdenbrief erklaeren"); }
