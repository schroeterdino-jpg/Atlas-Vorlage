"use strict";
// WhatsApp-Vertretung: die Android-App schickt eine eingehende Nachricht, Atlas liefert den Antworttext.
// Regeln: Atlas gibt sich als Assistent zu erkennen, macht keine Zusagen, nennt keine privaten Daten.
const K = require("./_keys.js");
const Pv = require("./_profil.js");
const { tor } = require("./_tor.js");
const P = require("./_plan.js");
const Kal = require("./_kalender.js");

function systemText(erste, stand) {
  return [
    "Du bist Atlas, der digitale Assistent von Sam Mustermann. Sam ist gerade nicht erreichbar und hat dich gebeten, auf seine WhatsApp-Nachrichten zu antworten.",
    erste ? "Das ist deine erste Antwort an diese Person: Stelle dich in einem kurzen Satz vor (zum Beispiel: Hier ist Atlas, Sams digitaler Assistent. Sam ist gerade nicht erreichbar)." : "Die Person kennt dich schon. Keine neue Vorstellung, antworte direkt.",
    "Antworte kurz (höchstens 2-3 Sätze), freundlich, in der Sprache der Nachricht, so wie man in WhatsApp schreibt. Kein Markdown, keine Emojis-Flut.",
    "Du darfst NICHT: Termine oder Dinge zusagen oder absagen, Geld, Adressen, Passwörter, Kontodaten oder andere private Angaben nennen, Sams Gesundheit oder Familie besprechen, Versprechen im Namen von Sam machen.",
    "Bei Wichtigem oder Dringendem: sage, dass du Sam Bescheid gibst, sobald er wieder am Handy ist. Wenn jemand fragt, ob du Sam bist: sage ehrlich, dass du sein Assistent bist.",
    stand ? "Sams Lage: " + stand : "",
    "Schreibe nur den Antworttext, sonst nichts."
  ].filter(Boolean).join("\n");
}
async function lage() {
  try {
    const t = await P.tagInfo(Kal.heute()); if (!t || !t.zeiten) return "";
    const jetzt = new Date().toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" });
    const jm = P.minuten(jetzt.padStart(5, "0")), z = t.zeiten;
    if (jm >= P.minuten(z.abfahrt) && jm < P.minuten(z.ende)) return "Sam ist auf der Arbeit (" + t.art + ", Feierabend gegen " + z.ende + " Uhr). In seinen Pausen schaut er manchmal aufs Handy.";
    return "";
  } catch (e) { return ""; }
}
module.exports = async function handler(req, res) {
  const b = await tor(req, res); if (!b) return; const PR = await Pv.laden();
  try {
    if (b.aktion === "protokoll") { const l = await K.redis(["LRANGE", "atlas:vertretung:log", 0, 29]); return res.status(200).json({ ok: true, log: (l || []).map(x => { try { return JSON.parse(x); } catch (e) { return null; } }).filter(Boolean) }); }
    const key = await K.schluesselHolen("groq");
    if (!key) return res.status(200).json({ ok: false, fehler: "Groq-Schlüssel fehlt" });
    const von = String(b.von || "").slice(0, 60), text = String(b.text || "").trim().slice(0, 1000);
    if (!von || !text) return res.status(400).json({ ok: false, fehler: "Name oder Text fehlt" });
    const verlauf = (Array.isArray(b.verlauf) ? b.verlauf : []).slice(-6).map(m => ({ role: m.ich ? "assistant" : "user", content: String(m.text || "").slice(0, 500) }));
    const messages = [{ role: "system", content: Pv.ersetze(systemText(!!b.erste, await lage()), PR) }].concat(verlauf, [{ role: "user", content: von + ": " + text }]);
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", { method: "POST", headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" }, body: JSON.stringify({ model: "openai/gpt-oss-20b", messages, temperature: 0.4, max_tokens: 300, reasoning_effort: "low" }), signal: AbortSignal.timeout(20000) });
    if (!r.ok) return res.status(200).json({ ok: false, fehler: "KI " + r.status });
    const j = await r.json(), antwort = String(j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content || "").trim().slice(0, 600);
    if (!antwort) return res.status(200).json({ ok: false, fehler: "Leere Antwort" });
    try { await K.redis(["LPUSH", "atlas:vertretung:log", JSON.stringify({ zeit: new Date().toISOString(), von, text: text.slice(0, 200), antwort })]); await K.redis(["LTRIM", "atlas:vertretung:log", 0, 49]); } catch (e) {}
    res.status(200).json({ ok: true, antwort });
  } catch (e) { res.status(200).json({ ok: false, fehler: String(e.message || e).slice(0, 200) }); }
};
