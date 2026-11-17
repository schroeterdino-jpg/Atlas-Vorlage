"use strict";
const crypto = require("crypto");

const SCHLUESSEL = {
  groq: { name: "Groq (KI)", env: "GROQ_API_KEY", hilfe: "console.groq.com, API Keys. Gratis-Tarif reicht zum Start." },
  fish: { name: "Fish Audio (Stimme)", env: "FISH_AUDIO_API_KEY", hilfe: "fish.audio, API. Kostenloses Modell nutzbar." },
  fishvoice: { name: "Fish Audio Stimmen-ID (Atlas-Stimme)", env: "FISH_AUDIO_VOICE_ID", hilfe: "Die ID der Stimme bei fish.audio (aus dem Link der Stimme). Leer = Standardstimme." },
  serper: { name: "Serper (Websuche, Preise)", env: "SERPER_API_KEY", hilfe: "serper.dev, kostenloser Start." },
  github: { name: "GitHub-Zugang (Update-Meldung)", env: "GITHUB_TOKEN", hilfe: "Nur nötig, wenn dein GitHub-Projekt privat ist. github.com/settings/personal-access-tokens, Fine-grained token, nur dieses Projekt, Berechtigung Contents: Read-only." },
  tomtom: { name: "TomTom (Verkehr, Karten)", env: "TOMTOM_API_KEY", hilfe: "developer.tomtom.com, kostenlos." },
  tankerkoenig: { name: "Tankerkönig (Spritpreise)", env: "TANKERKOENIG_API_KEY", hilfe: "creativecommons.tankerkoenig.de, kostenlos." },
  tmdb: { name: "TMDB (Filme)", env: "TMDB_API_KEY", hilfe: "themoviedb.org, kostenlos." },
  youtube: { name: "YouTube (Live-Kameras)", env: "YOUTUBE_API_KEY", hilfe: "Google Cloud Console, YouTube Data API." },
  maps: { name: "Google Maps (Orte, Fahrzeit)", env: "GOOGLE_MAPS_API_KEY", hilfe: "Google Cloud Console, Anmeldedaten, Maps Platform API Key." },
  vektorurl: { name: "Vektorgedächtnis: URL (Upstash Vector)", env: "UPSTASH_VECTOR_REST_URL", hilfe: "console.upstash.com, Vector-Datenbank, Reiter REST API, UPSTASH_VECTOR_REST_URL." },
  vektortoken: { name: "Vektorgedächtnis: Token (Upstash Vector)", env: "UPSTASH_VECTOR_REST_TOKEN", hilfe: "Gleiche Stelle, UPSTASH_VECTOR_REST_TOKEN." },
  googleid: { name: "Google Kalender: Client-ID", env: "GOOGLE_CLIENT_ID", hilfe: "Google Cloud Console, Anmeldedaten, OAuth-Client Webclient 1." },
  googlesecret: { name: "Google Kalender: Client-Secret", env: "GOOGLE_CLIENT_SECRET", hilfe: "Gleiche Stelle wie die Client-ID." },
  dhl: { name: "DHL (Paketverfolgung)", env: "DHL_API_KEY", hilfe: "developer.dhl.com, Shipment Tracking. Optional." }
};

function redisInfo() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}
async function redis(cmd) {
  const r = redisInfo();
  if (!r) throw new Error("Datenbank nicht verbunden");
  const res = await fetch(r.url, { method: "POST", headers: { Authorization: "Bearer " + r.token, "Content-Type": "application/json" }, body: JSON.stringify(cmd) });
  const j = await res.json();
  if (j.error) throw new Error("Datenbank: " + j.error);
  return j.result;
}
function aesKey() {
  const s = String(process.env.ATLAS_SECRET || "").trim();
  if (!s || s.length < 8) throw new Error("ATLAS_SECRET fehlt oder ist zu kurz");
  return crypto.scryptSync(s, "atlas-schluessel-v1", 32);
}
function verschluesseln(text) {
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv("aes-256-gcm", aesKey(), iv);
  const enc = Buffer.concat([c.update(text, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map(b => b.toString("base64")).join(".");
}
function entschluesseln(paket) {
  const [iv, tag, enc] = paket.split(".").map(s => Buffer.from(s, "base64"));
  const d = crypto.createDecipheriv("aes-256-gcm", aesKey(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
}
function passwortOk(pw) {
  const s = String(process.env.ATLAS_SECRET || "").trim();
  if (!s || typeof pw !== "string") return false;
  pw = pw.trim();
  const a = crypto.createHash("sha256").update(pw).digest(), b = crypto.createHash("sha256").update(s).digest();
  return crypto.timingSafeEqual(a, b);
}
async function schluesselSpeichern(id, wert) { await redis(["HSET", "atlas:keys", id, verschluesseln(wert)]); }
async function schluesselLoeschen(id) { await redis(["HDEL", "atlas:keys", id]); }
async function schluesselHolen(id) {
  try { const p = await redis(["HGET", "atlas:keys", id]); if (p) return entschluesseln(p); } catch (e) {}
  const d = SCHLUESSEL[id]; return d && process.env[d.env] ? process.env[d.env] : null;
}
// Dauer-Anmeldung: ein signierter Cookie statt das Passwort im Browser zu speichern. Aendert sich ATLAS_SECRET, werden alle Cookies ungueltig.
const SITZUNG_TAGE = 180;
function sitzungMac(exp) { return crypto.createHmac("sha256", "atlas-sitzung-v1:" + String(process.env.ATLAS_SECRET || "")).update(String(exp)).digest("hex"); }
function sitzungToken() { const exp = Date.now() + SITZUNG_TAGE * 86400000; return exp + "." + sitzungMac(exp); }
function sitzungCookie(token) {
  return "atlas_s=" + (token || sitzungToken()) + "; Max-Age=" + SITZUNG_TAGE * 86400 + "; Path=/; HttpOnly; Secure; SameSite=Strict";
}
function sitzungLoeschCookie() { return "atlas_s=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Strict"; }
// Zweiter Weg neben dem Cookie: derselbe signierte Token im Header x-atlas-s (der Browser merkt ihn sich auch dann, wenn er Cookies wegwirft).
function sitzungOk(cookieKopf, token) {
  if (!String(process.env.ATLAS_SECRET || "").trim()) return false;
  const m = String(cookieKopf || "").match(/(?:^|;\s*)atlas_s=(\d+)\.([a-f0-9]{64})(?:;|$)/) || String(token || "").match(/^(\d+)\.([a-f0-9]{64})$/); if (!m) return false;
  if (Number(m[1]) < Date.now()) return false;
  const a = Buffer.from(m[2]), b = Buffer.from(sitzungMac(m[1]));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
module.exports = { sitzungToken, sitzungCookie, sitzungLoeschCookie, sitzungOk, SCHLUESSEL, redis, redisInfo, passwortOk, schluesselSpeichern, schluesselLoeschen, schluesselHolen };
