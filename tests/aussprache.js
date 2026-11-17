"use strict";
process.env.VERCEL_PROJECT_PRODUCTION_URL = "atlas-beispiel.vercel.app"; // Test laeuft als Altbestand-Kopie (Profil des Erfinders)
const assert = require("assert");
const { fuerStimme: f } = require("../api/_aussprache.js");
assert.strictEqual(f("Mathe (8:25–9:05)"), "Mathe (8 Uhr 25 bis 9 Uhr 5)");
assert.strictEqual(f("Förder-D 7:30 - 8:15 Uhr"), "Förder-D 7 Uhr 30 bis 8 Uhr 15");
assert.strictEqual(f("um 9:00 Uhr und 22:12"), "um 9 Uhr und 22 Uhr 12");
assert.strictEqual(f("Stand 3:1, 1.234,50 € am 17.11."), "Stand 3:1, 1.234,50 € am 17.11.");
assert.strictEqual(f("Förder-D"), "Förder-D");
console.log("aussprache ok");
