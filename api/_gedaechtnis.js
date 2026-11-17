"use strict";
// Langzeitgedaechtnis: Upstash Vector (eingebaute Einbettung, jede Sprache). Die 128 alten Eintraege liegen im Standardbereich und sind sofort da.
const K = require("./_keys.js");

async function verbindung() {
  const url = String((await K.schluesselHolen("vektorurl")) || "").replace(/\/+$/, "");
  const token = await K.schluesselHolen("vektortoken");
  if (!url || !token) return null;
  return { url, h: { Authorization: "Bearer " + token, "Content-Type": "application/json" } };
}
async function post(v, pfad, body) {
  const r = await fetch(v.url + pfad, { method: "POST", headers: v.h, body: JSON.stringify(body), signal: AbortSignal.timeout(8000) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error("Gedächtnis: " + (d.error || r.status));
  return d.result;
}
async function suchen(frage, n, minScore) {
  const v = await verbindung(); if (!v) return [];
  const res = await post(v, "/query-data", { data: String(frage).slice(0, 500), topK: n || 5, includeMetadata: true, includeData: true });
  return (res || []).filter(x => x.score >= (minScore || 0)).map(x => ({ id: x.id, text: x.data, score: x.score, datum: (x.metadata || {}).datum || "" }));
}
async function merken(text, metadata) {
  const v = await verbindung(); if (!v) throw new Error("Gedächtnis: Vektor-Schlüssel fehlen (Einrichtung)");
  const id = "a_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
  await post(v, "/upsert-data", { id, data: String(text).trim().slice(0, 2000), metadata: Object.assign({ datum: new Date().toISOString(), typ: "atlas" }, metadata || {}) });
  return id;
}
async function vergessen(ids) {
  const v = await verbindung(); if (!v) throw new Error("Gedächtnis: Vektor-Schlüssel fehlen (Einrichtung)");
  await post(v, "/delete", ids.map(String).slice(0, 20));
}
module.exports = { suchen, merken, vergessen };
