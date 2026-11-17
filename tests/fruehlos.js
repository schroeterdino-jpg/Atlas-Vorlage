"use strict";
process.env.VERCEL_PROJECT_PRODUCTION_URL = "atlas-beispiel.vercel.app"; // Test laeuft als Altbestand-Kopie (Profil des Erfinders)
const assert = require("assert"), Fr = require("../api/_fruehlos.js");
assert.strictEqual(Fr.text(null).senden, false);
assert.strictEqual(Fr.text({ fahrt: { art: "arbeit", minuten: 22, normal: 20 } }).senden, false, "frei -> still");
assert.strictEqual(Fr.text({ fahrt: { art: "heim", minuten: 50, normal: 20 } }).senden, false, "nur Hinweg");
let t = Fr.text({ fahrt: { art: "arbeit", minuten: 32, normal: 20 } });
assert.ok(t.senden && /12 mehr/.test(t.text) && /15 Minuten früher/.test(t.text), t.text);
t = Fr.text({ fahrt: { art: "arbeit", minuten: 21, normal: 20, stau: "A24 bei Horn" } });
assert.ok(t.senden && /Stau: A24 bei Horn/.test(t.text) && /5 Minuten früher/.test(t.text), t.text);
t = Fr.text({ fahrt: { art: "arbeit", minuten: 20, normal: 20 }, autobahn_sperrung: "A1 gesperrt" });
assert.ok(t.senden && /Sperrung/.test(t.text));
console.log("fruehlos: alle Pruefungen gruen");
