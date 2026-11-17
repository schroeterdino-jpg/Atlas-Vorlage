"use strict";
// WhatsApp lesen und selbst antworten. Die Nachrichten bleiben auf dem Handy; die App schickt bei jeder Frage die letzten mit
// (ctx.whatsapp = { zugriff, liste: [{ von, text, zeit, gruppe }] }). Gesendet wird erst nach Sams Ja, und nur als Antwort
// auf einen Chat, dessen Benachrichtigung noch offen ist (so arbeitet Android).
const norm = s => String(s || "").toLowerCase().replace(/[^a-z0-9äöüß ]/g, "").trim();
const passt = (von, such) => { const a = norm(von), b = norm(such); return !!a && !!b && (a === b || a.includes(b) || b.includes(a)); };

function liste(ctx) {
  const w = ctx && ctx.whatsapp;
  if (!w) return null;
  const jetzt = Date.now();
  return { zugriff: w.zugriff !== false, liste: (Array.isArray(w.liste) ? w.liste : []).filter(x => x && x.von && x.text).map(x => ({ von: String(x.von), text: String(x.text).slice(0, 300), gruppe: !!x.gruppe, vor_minuten: Math.max(0, Math.round((jetzt - (+x.zeit || jetzt)) / 60000)) })) };
}

async function whatsapp(a, ctx) {
  const d = liste(ctx), aktion = a.aktion === "senden" ? "senden" : "lesen";
  if (!d) return { ok: false, hinweis: "WhatsApp lesen und antworten geht nur in der Atlas-App auf dem Handy. Sage das kurz und ehrlich." };
  if (!d.zugriff) return { ok: false, kein_zugriff: true, hinweis: "Atlas hat noch keinen Zugriff auf die Benachrichtigungen. Sam soll in der Kachel WHATSAPP den Zugriff erlauben. Sage das in einem Satz." };
  const such = String(a.von || a.an || "").trim();
  if (aktion === "lesen") {
    const t = (such ? d.liste.filter(x => passt(x.von, such)) : d.liste).slice(0, 8);
    if (!t.length) return { ok: true, anzahl: 0, hinweis: (such ? "Von '" + such + "' ist" : "Es ist") + " keine WhatsApp-Nachricht der letzten 24 Stunden da, die Atlas sehen konnte. Atlas sieht nur Nachrichten, die als Benachrichtigung ankamen. Sage das kurz." };
    return { ok: true, anzahl: t.length, nachrichten: t, hinweis: "Lies die Nachrichten kurz vor: wer, was, grob wann (vor_minuten). Gruppen: sage den Gruppennamen. Biete an, dass Sam antworten kann ('Antworte ...'). Erfinde nichts dazu." };
  }
  const text = String(a.text || "").trim();
  if (!such) return { ok: false, hinweis: "An wen soll die Nachricht gehen? Nachfragen." };
  if (!text) return { ok: false, hinweis: "Was soll in der Nachricht stehen? Nachfragen." };
  const ziel = d.liste.find(x => passt(x.von, such));
  if (!ziel) return { ok: false, hinweis: "Antworten geht nur auf einen Chat, in dem gerade eine Nachricht als Benachrichtigung offen ist (Android erlaubt nichts anderes). Von '" + such + "' ist keine da. Sage das ehrlich und kurz; Sam kann dann selbst in WhatsApp schreiben." };
  if (!a.bestaetigt) return { ok: false, bestaetigung_noetig: true, an: ziel.von, text, hinweis: "NICHT senden. Lies Sam vor: 'An " + ziel.von + ": " + text.slice(0, 200) + ". Soll ich das so senden?' Erst nach seinem Ja das Werkzeug noch einmal mit bestaetigt true und gleichem Text aufrufen." };
  return { ok: true, gesendet_an: ziel.von, text, fuerApp: { aktion: "wa_senden", an: ziel.von, text }, hinweis: "Sage kurz, dass die Nachricht an " + ziel.von + " abgeschickt wird. Atlas kann nicht nachprüfen, ob WhatsApp sie wirklich zugestellt hat." };
}
module.exports = { whatsapp, passt };
