"use strict";
// Text zu Sprache (Fish Audio, mit der eigenen Stimme; spricht in jeder Sprache).
const K = require("./_keys.js");
const { tor } = require("./_tor.js");
const { fuerStimme } = require("./_aussprache.js");

module.exports = async function handler(req, res) {
  const t0 = Date.now(); const b = await tor(req, res); if (!b) return;
  try {
    const [key, voiceRoh] = await Promise.all([K.schluesselHolen("fish"), K.schluesselHolen("fishvoice")]);
    if (!key) return res.status(200).json({ ok: false, fehler: "Fish-Schlüssel fehlt (Einrichtung)" });
    const text = fuerStimme(String(b.text || "").trim().slice(0, 1500));
    if (!text) return res.status(400).json({ ok: false, fehler: "Kein Text" });
    const voice = String(voiceRoh || "").replace(/[^a-zA-Z0-9_-]/g, "");
    // latency balanced: schneller, kaum hoerbar schlechter
    const body = { text, format: "mp3", latency: "balanced" }; if (voice) body.reference_id = voice;
    const call = m => fetch("https://api.fish.audio/v1/tts", { method: "POST", headers: { Authorization: "Bearer " + key, "Content-Type": "application/json", model: m }, body: JSON.stringify(body), signal: AbortSignal.timeout(25000) });
    const tf = Date.now();
    let r = await call("s2.1-pro-free");
    if (!r.ok && r.status !== 401 && r.status !== 403) r = await call("s2-pro");
    if (!r.ok) return res.status(200).json({ ok: false, fehler: "Stimme: Fehler " + r.status });
    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("X-Server-Ms", String(Date.now() - t0)); res.setHeader("X-Fish-Ms", String(Date.now() - tf));
    return res.status(200).send(buf);
  } catch (e) { return res.status(200).json({ ok: false, fehler: "Stimme: " + String(e.message || e) }); }
};
