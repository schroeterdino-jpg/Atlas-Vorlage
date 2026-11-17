"use strict";
// Verstehen und Antworten (Groq). Atlas bekommt den Satz so, wie er gesagt wurde, plus den bisherigen Verlauf.
const K = require("./_keys.js");
const { tor } = require("./_tor.js");
const Pd = require("./_profil.js");
const W = require("./_werkzeuge.js");
const G = require("./_gedaechtnis.js");
const L = require("./_listen.js");

function jetzt() {
  try { return new Date().toLocaleString("de-DE", { timeZone: "Europe/Berlin", dateStyle: "full", timeStyle: "short" }); } catch (e) { return new Date().toISOString(); }
}
function systemText(sprache) {
  return [
    "Du bist Atlas, der persönliche Sprachassistent von Sam. Sam spricht ganz normal mit dir, in jeder Formulierung und in jeder Sprache.",
    "Verstehe immer, was gemeint ist, auch bei Umgangssprache, Tippfehlern, Spracherkennungsfehlern oder halben Sätzen. Verlange nie feste Formulierungen.",
    "Antworte in der Sprache, in der Sam gerade spricht" + (sprache ? " (erkannt: " + sprache + ")" : "") + ", außer er verlangt ausdrücklich eine andere Sprache.",
    "Beginne jede Antwort mit dem Sprachcode deiner Antwort in eckigen Klammern, zum Beispiel [de], [en], [tr], [fr], [es], [ar]. Danach der gesprochene Text. Der Code wird nicht vorgelesen.",
    "Deine Antwort wird laut vorgelesen: kurz, natürlich, gesprochene Sprache, kein Markdown, keine Listen, keine Sternchen, keine Emojis, keine URLs vorlesen.",
    "Wenn dir etwas fehlt oder du unsicher bist, was gemeint ist, frage in einem kurzen Satz nach. Sage nie einfach 'das kann ich nicht', sondern was dir dafür noch fehlt.",
    "Du hast Werkzeuge für Sams Alltag. Wenn eine Bitte oder Frage zu einem Werkzeug passt, benutze es, egal wie Sam es formuliert (Umgangssprache, Kurzform, andere Sprache). Frage nie nach einer festen Formulierung.",
    "Wissensfragen, Smalltalk und Unsinn beantwortest du direkt ohne Werkzeug. Bei einem Wort wie 'und morgen?' oder 'nein, übermorgen' nutze den bisherigen Verlauf.",
    "Löschen, Senden, Anrufen und Ändern: erst kurz bestätigen lassen (bestätigt nur auf true setzen, wenn Sam es ausdrücklich bestätigt hat). Wenn ein Werkzeug 'noch nicht gebaut' meldet, sage das ehrlich in einem Satz.",
    "Sagt Sam, dass er an bestimmten Tagen oder in einem Zeitraum etwas hat (Training, Lehrgang, Schulung, Urlaub, Termin, Schicht frei), ist das Kalender, Urlaub oder Schicht und NIEMALS das Gedächtnis. Das Gedächtnis ist nur für Dauerhaftes (Personen, Vorlieben, Fakten). Sage nie 'eingetragen' oder 'vermerkt', wenn kein Werkzeug es wirklich getan hat.",
    "Erfinde keine Daten (Termine, Preise, Wetter, Nachrichten). Wenn du etwas nicht weißt, sage es ehrlich. Funktionen wie Kalender, Erinnerungen, Wetter kommen schrittweise dazu.",
    "Aktuelle Zeit in Deutschland: " + jetzt() + "."
  ].join("\n");
}

// Daten fuer die Animation in der App: klein halten (Listen gekuerzt, Texte gekuerzt)
function kleiner(v, tiefe) {
  tiefe = tiefe || 0; if (tiefe > 4) return undefined;
  if (v && typeof v === "object" && !Array.isArray(v) && Array.isArray(v.punkte) && v.punkte.length > 40) return v; // Kartenlinie nicht kuerzen
  if (typeof v === "string") return v.slice(0, 120);
  if (Array.isArray(v)) return v.slice(0, 40).map(x => kleiner(x, tiefe + 1));
  if (v && typeof v === "object") { const o = {}; for (const k of Object.keys(v)) { if (k === "hinweis") continue; o[k] = (k === "brief" || k === "ergebnis" || k === "bild" || k === "kurz") && typeof v[k] === "string" ? v[k].slice(0, k === "brief" ? 5000 : k === "kurz" ? 260 : 400) : kleiner(v[k], tiefe + 1); } return o; }
  return v;
}

module.exports = async function handler(req, res) {
  const b = await tor(req, res); if (!b) return;
  try {
    const key = await K.schluesselHolen("groq");
    if (!key) return res.status(200).json({ ok: false, fehler: "Groq-Schlüssel fehlt (Einrichtung)" });
    const text = String(b.text || "").trim().slice(0, 2000);
    if (!text) return res.status(400).json({ ok: false, fehler: "Kein Text" });
    const verlauf = (Array.isArray(b.verlauf) ? b.verlauf : []).slice(-12).map(m => ({ role: m.rolle === "atlas" ? "assistant" : "user", content: String(m.text || "").slice(0, 1500) }));
    const PRD = await Pd.laden(); const toolsKi = JSON.parse(Pd.ersetze(JSON.stringify(W.fuerKi()), PRD));
    let wissen = "", faellig = [];
    await Promise.all([ // Gedaechtnis und faellige Erinnerungen gleichzeitig holen
      G.suchen(text, 4, 0.5).then(t => { if (t.length) wissen = "\nBekannte Erinnerungen über Sam (nutze sie nur, wenn sie zur Frage passen, erfinde nichts dazu):\n" + t.map(x => "- " + x.text).join("\n"); }).catch(() => {}),
      L.faellige().then(f => { faellig = f; }).catch(() => {})]);
    const messages = [{ role: "system", content: Pd.ersetze(systemText(String(b.sprache || "").slice(0, 20)) + wissen, PRD) }].concat(verlauf, [{ role: "user", content: text }]);
    const st = b.standort || {}, standort = isFinite(st.lat) && isFinite(st.lon) && Math.abs(st.lat) <= 90 && Math.abs(st.lon) <= 180 ? { lat: +st.lat, lon: +st.lon } : null;
    const benutzt = []; let antwort = "", code = "";
    for (let runde = 0; runde < 4; runde++) {
      const anfrage = (extra) => fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST", headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
        body: JSON.stringify(Object.assign({ model: "openai/gpt-oss-120b", messages, tools: toolsKi, tool_choice: "auto", temperature: 0.3, max_tokens: 900, reasoning_effort: "low" }, extra || {})),
        signal: AbortSignal.timeout(25000)
      });
      let r = await anfrage();
      if (r.status === 400 || r.status === 429 || r.status >= 500) r = await anfrage(); // Funktionsaufruf der KI misslungen oder kurz ueberlastet: einmal neu versuchen
      let j = null;
      if (r.status === 400) { // KI hat den Werkzeugaufruf kaputt geschrieben ("Parsing failed"): noch einmal gründlicher denken, sonst den Aufruf aus dem Fehlertext retten
        let fehlerJ = null; try { fehlerJ = await r.json(); } catch (e) {}
        const r3 = await anfrage({ reasoning_effort: "medium", temperature: 0 });
        if (r3.ok) r = r3;
        else {
          const fg = fehlerJ && fehlerJ.error && String(fehlerJ.error.failed_generation || ""), mm = fg && fg.match(/to=functions\.([a-zA-Z0-9_]+)[\s\S]*?(\{[\s\S]*\})/);
          let args = null; if (mm) { try { args = JSON.parse(mm[2]); } catch (e) {} }
          if (mm && args && W.hat(mm[1])) j = { choices: [{ message: { tool_calls: [{ id: "fg" + runde, function: { name: mm[1], arguments: JSON.stringify(args) } }] } }] };
          else r = r3;
        }
      }
      if (!j) {
        if (!r.ok) { let d = ""; try { d = String((await r.json()).error.message || "").slice(0, 160); } catch (e) {} return res.status(200).json({ ok: false, fehler: "KI: Fehler " + r.status + (d ? " (" + d + ")" : "") }); }
        j = await r.json();
      }
      const m = j.choices && j.choices[0] && j.choices[0].message || {};
      if (Array.isArray(m.tool_calls) && m.tool_calls.length) {
        messages.push({ role: "assistant", content: "", tool_calls: m.tool_calls });
        const verschieden = new Set(m.tool_calls.map(t => t.function.name)).size === m.tool_calls.length; // gleiche Werkzeuge nacheinander (sonst überschreiben sie sich), verschiedene gleichzeitig
        const lauf = async tc => {
          let args = {}; try { args = JSON.parse(tc.function.arguments || "{}"); } catch (e) {}
          delete args.jetzt; // die Uhrzeit kommt immer vom Server, nie von der KI (sonst rät sie sie falsch)
          if (tc.function.name === "ueberblick") args.briefing = /guten (morgen|tag|abend)|\bmoin\b|briefing/i.test(text); // Briefing-Animation sicher auslösen
          const erg = await W.ausfuehren(tc.function.name, args, { standort: standort, app: b.app === true, whatsapp: b.whatsapp && typeof b.whatsapp === "object" ? b.whatsapp : null });
          return { tc, args, erg };
        };
        const ergs = []; if (verschieden) ergs.push(...await Promise.all(m.tool_calls.map(lauf))); else for (const tc of m.tool_calls) ergs.push(await lauf(tc));
        for (const { tc, args, erg } of ergs) {
          benutzt.push(erg.ok ? { name: tc.function.name, ok: true, args: kleiner(args), erg: kleiner(erg) } : (erg.technisch ? { name: tc.function.name, ok: false, fehler: String(erg.hinweis || "").slice(0, 300) } : { name: tc.function.name, ok: false }));
          messages.push({ role: "tool", tool_call_id: tc.id, content: Pd.ersetze(JSON.stringify(erg, (k, v) => k === "karte" || k === "bild" || k === "kurz" || k === "lat" || k === "lon" ? undefined : v), PRD) }); // Kartenlinie nur fuer die Animation, nicht fuer die KI
        }
        continue;
      }
      antwort = String(m.content || "").trim();
      break;
    }
    // Die KI setzt vor die eigentliche Antwort manchmal Denkreste. Es zaehlt alles nach dem letzten Sprachcode.
    const codes = [...antwort.matchAll(/\[([a-zA-Z]{2,3}(?:-[a-zA-Z]{2,4})?)\]\s*/g)];
    if (codes.length) { const l = codes[codes.length - 1]; code = l[1].toLowerCase(); antwort = antwort.slice(l.index + l[0].length).trim(); }
    antwort = antwort.replace(/[*_`#]+/g, "").replace(/\s{2,}/g, " ").trim(); // Markdown-Zeichen wuerden mitgesprochen
    if (!antwort) return res.status(200).json({ ok: false, fehler: "KI hat nichts geantwortet" });
    if (faellig.length) {
      const vor = "Erinnerung: " + faellig.map(x => x.text).join(". ") + ". ";
      try { await L.alsGemeldet(faellig.map(x => x.id)); antwort = vor + antwort; } catch (e) {}
    }
    return res.status(200).json({ ok: true, antwort, sprache: code, werkzeuge: benutzt });
  } catch (e) { return res.status(200).json({ ok: false, fehler: "KI: " + String(e.message || e) }); }
};
