"use strict";
// Sprache zu Text (Groq Whisper, erkennt die Sprache selbst).
const K = require("./_keys.js");
const { tor } = require("./_tor.js");
const Wo = require("./_woerter.js");

module.exports = async function handler(req, res) {
  const b = await tor(req, res); if (!b) return;
  try {
    const key = await K.schluesselHolen("groq");
    if (!key) return res.status(200).json({ ok: false, fehler: "Groq-Schlüssel fehlt (Einrichtung)" });
    if (!b.audio) return res.status(400).json({ ok: false, fehler: "Keine Aufnahme" });
    const buf = Buffer.from(String(b.audio), "base64");
    if (buf.length < 800) return res.status(200).json({ ok: true, text: "", sprache: "" });
    const mime = String(b.mime || "audio/webm").split(";")[0];
    const ext = mime.includes("mp4") ? "mp4" : mime.includes("ogg") ? "ogg" : mime.includes("wav") ? "wav" : "webm";
    const hinweis = await Wo.prompt().catch(() => "Gespräch mit dem Assistenten Atlas. Der Nutzer spricht meist Deutsch.");
    const lesen = async sprache => {
      const fd = new FormData();
      fd.append("file", new Blob([buf], { type: mime }), "aufnahme." + ext);
      fd.append("model", "whisper-large-v3");
      fd.append("response_format", "verbose_json");
      fd.append("temperature", "0");
      fd.append("prompt", hinweis);
      if (sprache) fd.append("language", sprache);
      const r = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", { method: "POST", headers: { Authorization: "Bearer " + key }, body: fd, signal: AbortSignal.timeout(20000) });
      if (!r.ok) throw new Error("Fehler " + r.status);
      const j = await r.json();
      const seg = Array.isArray(j.segments) ? j.segments : [];
      const lp = seg.length ? seg.reduce((a, x) => a + (typeof x.avg_logprob === "number" ? x.avg_logprob : -1), 0) / seg.length : -1;
      return { text: String(j.text || "").trim(), sprache: String(j.language || "").toLowerCase(), lp };
    };
    let erg = await lesen("");
    const deutsch = x => x === "german" || x === "de";
    // Unsichere Fremdsprache: noch einmal als Deutsch lesen und die sicherere Lesart nehmen.
    if (erg.text && !deutsch(erg.sprache) && erg.lp < -0.45) {
      try { const de = await lesen("de"); if (de.text && de.lp > erg.lp) erg = { text: de.text, sprache: "german", lp: de.lp }; } catch (e) {}
    }
    return res.status(200).json({ ok: true, text: await Wo.korrigieren(erg.text).catch(() => erg.text), sprache: erg.sprache });
  } catch (e) { return res.status(200).json({ ok: false, fehler: "Spracherkennung: " + String(e.message || e) }); }
};
