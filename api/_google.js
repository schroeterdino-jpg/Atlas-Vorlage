"use strict";
// Google-Kalender: Anmeldung (OAuth) und Zugriff. Der Refresh-Token liegt verschluesselt in der Datenbank (Schluessel "googletoken").
const K = require("./_keys.js");
const SCOPE = "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/gmail.readonly"; // Kalender + Mails nur lesen
let cache = { token: "", bis: 0 };

async function clientDaten() {
  const id = await K.schluesselHolen("googleid"), secret = await K.schluesselHolen("googlesecret");
  if (!id || !secret) throw new Error("Google Client-ID oder Client-Secret fehlen (Einrichtung)");
  return { id, secret };
}
async function anmeldeAdresse(redirect, state) {
  const c = await clientDaten();
  return "https://accounts.google.com/o/oauth2/v2/auth?" + new URLSearchParams({ client_id: c.id, redirect_uri: redirect, response_type: "code", scope: SCOPE, access_type: "offline", prompt: "consent", state }).toString();
}
async function tokenPost(params) {
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(params).toString(), signal: AbortSignal.timeout(10000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error("Google: " + (j.error_description || j.error || r.status));
  return j;
}
async function code_tauschen(code, redirect) {
  const c = await clientDaten();
  const j = await tokenPost({ code, client_id: c.id, client_secret: c.secret, redirect_uri: redirect, grant_type: "authorization_code" });
  if (!j.refresh_token) throw new Error("Google hat keinen Dauer-Zugang geschickt. Bitte unter myaccount.google.com/permissions den alten Zugriff von Atlas entfernen und neu verbinden.");
  await K.schluesselSpeichern("googletoken", j.refresh_token);
}
async function verbunden() { return !!(await K.schluesselHolen("googletoken")); }
async function zugangsToken() {
  if (cache.token && Date.now() < cache.bis) return cache.token;
  const rt = await K.schluesselHolen("googletoken"); if (!rt) return null;
  const c = await clientDaten();
  const j = await tokenPost({ refresh_token: rt, client_id: c.id, client_secret: c.secret, grant_type: "refresh_token" });
  cache = { token: j.access_token, bis: Date.now() + (Number(j.expires_in || 3600) - 120) * 1000 };
  return cache.token;
}
// Antwort bei fehlender Verbindung: kein technischer Fehler, sondern ein Hinweis
const NICHT_VERBUNDEN = { ok: false, hinweis: "Google Kalender ist noch nicht verbunden. Sage Sam: In der Einrichtung auf 'Mit Google verbinden' tippen." };
async function api(pfad, opt) {
  const t = await zugangsToken(); if (!t) return null;
  const r = await fetch("https://www.googleapis.com/calendar/v3" + pfad, Object.assign({ signal: AbortSignal.timeout(10000) }, opt, { headers: Object.assign({ Authorization: "Bearer " + t, "Content-Type": "application/json" }, opt && opt.headers) }));
  if (r.status === 204) return {};
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error("Google Kalender: " + ((j.error && j.error.message) || r.status));
  return j;
}
// Gmail (nur lesen). Fehlt die Berechtigung (alte Verbindung nur mit Kalender), kommt e.scope = true.
async function gmail(pfad) {
  const t = await zugangsToken(); if (!t) return null;
  const r = await fetch("https://gmail.googleapis.com/gmail/v1" + pfad, { signal: AbortSignal.timeout(10000), headers: { Authorization: "Bearer " + t } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error("Gmail: " + ((j.error && j.error.message) || r.status)); e.scope = r.status === 403 || r.status === 401; e.status = r.status; throw e; }
  return j;
}
module.exports = { anmeldeAdresse, code_tauschen, verbunden, api, gmail, NICHT_VERBUNDEN };
