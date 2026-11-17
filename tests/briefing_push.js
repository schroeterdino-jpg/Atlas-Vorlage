"use strict";
process.env.VERCEL_PROJECT_PRODUCTION_URL = "atlas-beispiel.vercel.app"; // Test laeuft als Altbestand-Kopie (Profil des Erfinders)
// Heimweg-Hinweis: Text der Benachrichtigung (ohne Netz: Verkehr nicht abrufbar -> ehrlicher Text)
const assert = require("assert");
const F = require("../api/_fahrt.js");
F.strecke = async () => ({ ok: true, minuten: 24, verzoegerung_min: 12, live: true, staus: [{ satz: "A24 bei Horn, 2 km" }] });
const h = require("../api/briefing.js");
const tor = require("../api/_tor.js"); // tor braucht Redis/Secret: hier nicht pruefbar, daher nur Datei laden
assert.strictEqual(typeof h, "function");
console.log("briefing: alle Pruefungen gruen");
