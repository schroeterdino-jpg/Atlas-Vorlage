"use strict";
process.env.VERCEL_PROJECT_PRODUCTION_URL = "atlas-beispiel.vercel.app"; // Test laeuft als Altbestand-Kopie (Profil des Erfinders)
const A = require("../api/_autobahn.js"); let f = 0; const ok = (c, m) => { if (!c) { console.log("FEHLER", m); f++; } };
const n = A.normal({ coordinate: { lat: "53.5", long: "10.0" }, title: "A7 Sperrung", subtitle: "Hamburg", description: ["a", "b"], isBlocked: "true" }, "A7", "closure");
ok(n && n.lat === 53.5 && n.gesperrt && n.text === "a b", "normal");
ok(A.normal({}, "A7", "closure") === null && A.normal({ coordinate: { lat: "x" } }, "A7", "closure") === null, "kaputt");
const linie = [[53.0, 10.0], [54.0, 10.0]];
ok(A.abstand([53.5, 10.01], linie) < 1.5 && A.abstand([53.5, 10.2], linie) > 10, "abstand");
ok(A.zeile({ ok: true, sperrungen: [], warnungen: [], baustellen: [] }).includes("keine Meldungen"), "zeile leer");
ok(A.zeile({ ok: true, sperrungen: [{ strasse: "A7", ort: "Elbtunnel" }], warnungen: [], baustellen: [] }).includes("1 Sperrung"), "zeile");
ok(A.zeile({ ok: false }) === "", "zeile fehler");
console.log(f ? "FEHLER " + f : "autobahn ok"); process.exit(f ? 1 : 0);
