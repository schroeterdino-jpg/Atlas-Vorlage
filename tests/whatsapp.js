"use strict";
process.env.VERCEL_PROJECT_PRODUCTION_URL = "atlas-beispiel.vercel.app"; // Test laeuft als Altbestand-Kopie (Profil des Erfinders)
// WhatsApp lesen und antworten: ohne App, ohne Zugriff, Lesen mit Filter, Senden nur nach Bestaetigung und nur auf offenen Chat.
const assert = require("assert");
const W = require("../api/_werkzeuge.js");
(async () => {
  const jetzt = Date.now();
  const ctx = { app: true, whatsapp: { zugriff: true, liste: [
    { von: "Matzi", text: "Kommst du heute?", zeit: jetzt - 5 * 60000, gruppe: false },
    { von: "Familie", text: "Anna: Essen um 18 Uhr", zeit: jetzt - 60 * 60000, gruppe: true }] } };
  let e = await W.ausfuehren("whatsapp", { aktion: "lesen" }, { app: false });
  assert.ok(!e.ok && /nur in der Atlas-App/.test(e.hinweis));
  e = await W.ausfuehren("whatsapp", { aktion: "lesen" }, { app: true, whatsapp: { zugriff: false, liste: [] } });
  assert.ok(e.kein_zugriff);
  e = await W.ausfuehren("whatsapp", { aktion: "lesen" }, ctx);
  assert.strictEqual(e.anzahl, 2); assert.strictEqual(e.nachrichten[0].vor_minuten, 5);
  e = await W.ausfuehren("whatsapp", { aktion: "lesen", von: "matzi" }, ctx);
  assert.strictEqual(e.anzahl, 1); assert.strictEqual(e.nachrichten[0].von, "Matzi");
  e = await W.ausfuehren("whatsapp", { aktion: "lesen", von: "Peter" }, ctx);
  assert.strictEqual(e.anzahl, 0);
  // Senden: erst nachfragen, nichts an die App
  e = await W.ausfuehren("whatsapp", { aktion: "senden", von: "Matzi", text: "komme gleich" }, ctx);
  assert.ok(e.bestaetigung_noetig && !e.fuerApp && e.an === "Matzi");
  e = await W.ausfuehren("whatsapp", { aktion: "senden", von: "Matzi", text: "komme gleich", bestaetigt: true }, ctx);
  assert.ok(e.ok); assert.deepStrictEqual(e.fuerApp, { aktion: "wa_senden", an: "Matzi", text: "komme gleich" });
  // kein offener Chat -> ehrlich, nichts gesendet
  e = await W.ausfuehren("whatsapp", { aktion: "senden", von: "Peter", text: "hi", bestaetigt: true }, ctx);
  assert.ok(!e.ok && !e.fuerApp);
  e = await W.ausfuehren("whatsapp", { aktion: "senden", von: "Matzi", bestaetigt: true }, ctx);
  assert.ok(!e.ok && !e.fuerApp);
  console.log("whatsapp ok");
})().catch(e => { console.error(e); process.exit(1); });
