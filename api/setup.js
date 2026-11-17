"use strict";
const K = require("./_keys");
const Gg = require("./_google.js");
const Fa = require("./_fahrt.js");
const Wo = require("./_woerter.js");

async function testen(id, wert) {
  const t = async (url, opt) => { try { return await fetch(url, Object.assign({ signal: AbortSignal.timeout(8000) }, opt)); } catch (e) { return { ok: false, status: 0, json: async () => null }; } };
  let r;
  switch (id) {
    case "groq": r = await t("https://api.groq.com/openai/v1/models", { headers: { Authorization: "Bearer " + wert } }); break;
    case "fish": {
      const call = m => t("https://api.fish.audio/v1/tts", { method: "POST", headers: { Authorization: "Bearer " + wert, "Content-Type": "application/json", model: m }, body: JSON.stringify({ text: "Hallo", format: "mp3" }) });
      r = await call("s2.1-pro-free");
      if (!r.ok && r.status >= 400 && r.status < 500 && r.status !== 429) r = await call("s2-pro");
      break;
    }
    case "fishvoice": {
      const fk = await K.schluesselHolen("fish");
      if (!fk) return { ok: false, text: "Erst den Fish-Schlüssel eintragen" };
      const id = String(wert).replace(/[^a-zA-Z0-9_-]/g, "");
      const call = m => t("https://api.fish.audio/v1/tts", { method: "POST", headers: { Authorization: "Bearer " + fk, "Content-Type": "application/json", model: m }, body: JSON.stringify({ text: "Hallo", format: "mp3", reference_id: id }) });
      r = await call("s2.1-pro-free");
      if (!r.ok && r.status !== 404 && r.status !== 422 && r.status !== 400 && r.status !== 429) r = await call("s2-pro");
      if (r.status === 402) return { ok: false, text: "Fish verlangt Guthaben für diese Stimme (Fehler 402). Vermutlich ist die Stimme nicht kostenlos nutzbar." };
      if (r.ok) return { ok: true, text: "Stimme gefunden und funktioniert" };
      if (r.status === 404 || r.status === 422 || r.status === 400) return { ok: false, text: "Diese Stimmen-ID kennt Fish nicht" };
      break;
    }
    case "serper": r = await t("https://google.serper.dev/search", { method: "POST", headers: { "X-API-KEY": wert, "Content-Type": "application/json" }, body: JSON.stringify({ q: "test", num: 1 }) }); break;
    case "tankerkoenig": {
      const tr = await t("https://creativecommons.tankerkoenig.de/json/list.php?lat=53.5&lng=10&rad=3&sort=dist&type=diesel&apikey=" + encodeURIComponent(wert));
      let j = null; try { j = await tr.json(); } catch (e) {}
      if (j && j.ok === true) return { ok: true, text: "Funktioniert" };
      if (j && j.ok === false) return { ok: false, text: "Tankerkönig: " + String(j.message || "Schlüssel abgelehnt").slice(0, 120) };
      return { ok: false, text: "Fehler " + tr.status };
    }
    case "tomtom": r = await t("https://api.tomtom.com/search/2/geocode/Hamburg.json?key=" + encodeURIComponent(wert)); break;
    case "tmdb": r = await t("https://api.themoviedb.org/3/configuration?api_key=" + encodeURIComponent(wert)); break;
    case "youtube": r = await t("https://www.googleapis.com/youtube/v3/videoCategories?part=snippet&regionCode=DE&key=" + encodeURIComponent(wert)); break;
    case "maps": {
      const mr = await t("https://places.googleapis.com/v1/places:searchText", { method: "POST", headers: { "X-Goog-Api-Key": wert, "X-Goog-FieldMask": "places.displayName", "Content-Type": "application/json" }, body: JSON.stringify({ textQuery: "Hamburg Hauptbahnhof", pageSize: 1 }) });
      if (mr.ok) return { ok: true, text: "Funktioniert (Orte-Suche)" };
      let j = null; try { j = await mr.json(); } catch (e) {}
      const m = j && j.error && j.error.message ? String(j.error.message).slice(0, 140) : "Fehler " + mr.status;
      return { ok: false, text: "Google Maps: " + m };
    }
    case "vektorurl": {
      if (!/^https:\/\/[a-z0-9.-]+$/i.test(String(wert).trim())) return { ok: false, text: "Die URL muss mit https:// beginnen, ohne Schrägstrich am Ende" };
      r = await t(String(wert).trim() + "/info");
      if (r.status === 401 || r.status === 403 || r.ok) return { ok: true, text: "Adresse erreichbar. Mit dem Token gleich testen" };
      return { ok: false, text: r.status === 0 ? "Adresse nicht erreichbar. Bitte genau von Upstash kopieren (https://…upstash.io)" : "Adresse nicht erreichbar (Fehler " + r.status + ")" };
    }
    case "vektortoken": {
      const vu = await K.schluesselHolen("vektorurl");
      if (!vu) return { ok: false, text: "Erst die Vektor-URL eintragen" };
      r = await t(String(vu).trim() + "/range", { method: "POST", headers: { Authorization: "Bearer " + wert, "Content-Type": "application/json" }, body: JSON.stringify({ cursor: "0", limit: 1 }) });
      if (r.ok) {
        // Schreibrechte pruefen (loescht eine nicht vorhandene Test-ID, aendert nichts): ein Nur-Lesen-Token besteht den Lesetest, kann aber nichts speichern.
        const w = await t(String(vu).trim() + "/delete", { method: "POST", headers: { Authorization: "Bearer " + wert, "Content-Type": "application/json" }, body: JSON.stringify(["atlas-schreibtest"]) });
        if (w.status === 401 || w.status === 403) return { ok: false, text: "Lesen geht, aber Schreiben nicht: das ist der Nur-Lesen-Token. Bitte den normalen UPSTASH_VECTOR_REST_TOKEN nehmen (Haken bei Read-Only Token weg)" };
        return { ok: true, text: "Funktioniert (Lesen und Schreiben)" };
      }
      let d = ""; try { d = String(await r.text()).slice(0, 120); } catch (e) {}
      return { ok: false, text: "Upstash antwortet " + r.status + ": " + d + " | Token endet auf …" + String(wert).slice(-4) + " | URL: " + String(vu).trim().slice(8, 28) + "…" };
    }
    case "googleid": return /\.apps\.googleusercontent\.com$/.test(String(wert).trim()) ? { ok: true, text: "Sieht richtig aus (Format geprüft)" } : { ok: false, text: "Die Client-ID endet normalerweise auf .apps.googleusercontent.com" };
    case "dhl": {
      r = await t("https://api-eu.dhl.com/track/shipments?trackingNumber=00340434292135100186", { headers: { "DHL-API-Key": wert } });
      if (r.ok || r.status === 404) return { ok: true, text: "Funktioniert" };
      break;
    }
    default: return { ok: null, text: "Gespeichert (dafür gibt es noch keinen Test)" };
  }
  if (r.ok) return { ok: true, text: "Funktioniert" };
  if (r.status === 0) return { ok: false, text: "Keine Verbindung zu diesem Dienst. Stimmt die Adresse (URL)?" };
  if (r.status === 401 || r.status === 403) return { ok: false, text: "Schlüssel falsch oder ohne Berechtigung" };
  return { ok: false, text: "Fehler " + r.status };
}

function ipKey(req) { return "atlas:try:" + String(req.headers["x-forwarded-for"] || "x").split(",")[0].trim(); }
async function gesperrt(req) { return Number(await K.redis(["GET", ipKey(req)]) || 0) >= 10; }
async function fehlversuch(req) { const k = ipKey(req); const n = await K.redis(["INCR", k]); if (n === 1) await K.redis(["EXPIRE", k, 600]); }

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ fehler: "Nur POST" });
  const b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  try {
    if (!process.env.ATLAS_SECRET) return res.status(200).json({ ok: false, schritt: "secret", fehler: "ATLAS_SECRET fehlt in Vercel" });
    if (!K.redisInfo()) return res.status(200).json({ ok: false, schritt: "datenbank", fehler: "Datenbank nicht verbunden" });
    if (await gesperrt(req)) return res.status(429).json({ ok: false, fehler: "Zu viele falsche Passwörter, bitte 10 Minuten warten" });
    if (!K.sitzungOk(req.headers.cookie, req.headers["x-atlas-s"]) && !K.passwortOk(b.passwort)) { if (b.passwort) await fehlversuch(req); return res.status(401).json({ ok: false, fehler: "Passwort falsch" }); }
    if (b.aktion === "status") {
      const gesetzt = await K.redis(["HKEYS", "atlas:keys"]);
      const liste = [];
      for (const id of Object.keys(K.SCHLUESSEL)) {
        let letzte = null;
        if (gesetzt.includes(id)) { const w = await K.schluesselHolen(id); letzte = w ? w.slice(-4) : null; }
        liste.push({ id, name: K.SCHLUESSEL[id].name, hilfe: K.SCHLUESSEL[id].hilfe, gesetzt: !!letzte, letzte });
      }
      let google = false; try { google = await Gg.verbunden(); } catch (e) {}
      return res.status(200).json({ ok: true, liste, google });
    }
    if (b.aktion === "adressen") return res.status(200).json(await Fa.orte({ aktion: "zeigen" }));
    if (b.aktion === "ortSetzen" || b.aktion === "ortLoeschen") {
      const r = await Fa.orte({ aktion: b.aktion === "ortSetzen" ? "setzen" : "loeschen", name: b.name, adresse: b.adresse, bestaetigt: true });
      return res.status(200).json(r.ok ? r : { ok: false, fehler: r.hinweis });
    }
    if (b.aktion === "adresseSetzen") {
      const r = await Fa.adressen({ aktion: "setzen", ort: b.ort, adresse: b.adresse, bestaetigt: true });
      return res.status(200).json(r.ok ? r : { ok: false, fehler: r.hinweis });
    }
    if (b.aktion === "woerter") { const w = await Wo.laden(); return res.status(200).json({ ok: true, hinweise: w.hinweise.join("\n"), korrekturen: Object.keys(w.korrekturen).map(f => f + " = " + w.korrekturen[f]).join("\n") }); }
    if (b.aktion === "woerterSpeichern") { const w = await Wo.speichern(b.hinweise, b.korrekturen); return res.status(200).json({ ok: true, anzahl_hinweise: w.hinweise.length, anzahl_korrekturen: Object.keys(w.korrekturen).length }); }
    if (b.aktion === "googlelink") {
      try {
        const state = require("crypto").randomBytes(16).toString("hex"), redirect = "https://" + String(req.headers.host || "").split(",")[0] + "/api/google-callback";
        await K.redis(["SET", "atlas:gstate:" + state, redirect, "EX", 600]);
        return res.status(200).json({ ok: true, adresse: await Gg.anmeldeAdresse(redirect, state), redirect });
      } catch (e) { return res.status(200).json({ ok: false, fehler: String(e.message || e) }); }
    }
    if (b.aktion === "googletest") {
      try { const r = await require("./_kalender.js").termine({}); return res.status(200).json({ ok: true, test: r.ok ? { ok: true, text: "Funktioniert (" + r.anzahl + " Termine heute)" } : { ok: false, text: r.hinweis } }); } catch (e) { return res.status(200).json({ ok: true, test: { ok: false, text: String(e.message || e) } }); }
    }
    if (!K.SCHLUESSEL[b.id]) return res.status(400).json({ ok: false, fehler: "Unbekannter Schlüssel" });
    if (b.aktion === "speichern") {
      // Auch eine ganze eingefuegte .env-Zeile oder mehrere Zeilen: es zaehlt der Teil nach dem letzten "NAME=".
      const roh = String(b.wert || ""); let w = roh; let m, re = /(^|[\s"'])[A-Z][A-Z0-9_]{3,}\s*=\s*/g, ende = -1;
      while ((m = re.exec(roh))) ende = m.index + m[0].length;
      if (ende >= 0) w = roh.slice(ende);
      w = w.replace(/["'\s]/g, "");
      if (w.length < (b.id === "fishvoice" ? 6 : 8)) return res.status(400).json({ ok: false, fehler: "Schlüssel zu kurz" });
      await K.schluesselSpeichern(b.id, w);
      const e = await testen(b.id, w);
      return res.status(200).json({ ok: true, gespeichert: true, test: e, letzte: w.slice(-4) });
    }
    if (b.aktion === "testen") {
      const w = await K.schluesselHolen(b.id);
      if (!w) return res.status(200).json({ ok: true, test: { ok: false, text: "Noch kein Schlüssel eingetragen" } });
      return res.status(200).json({ ok: true, test: await testen(b.id, w) });
    }
    if (b.aktion === "loeschen") { await K.schluesselLoeschen(b.id); return res.status(200).json({ ok: true }); }
    return res.status(400).json({ ok: false, fehler: "Unbekannte Aktion" });
  } catch (e) {
    return res.status(200).json({ ok: false, fehler: String(e.message || e) });
  }
};
