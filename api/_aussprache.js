"use strict";
// Macht Text fuers Vorlesen aussprechbar: Uhrzeiten wie "7:30–8:15" werden zu "7 Uhr 30 bis 8 Uhr 15".
// Die Anzeige auf dem Bildschirm bleibt unveraendert, nur die Stimme bekommt den umgewandelten Text.
const Z = "([01]?\\d|2[0-3]):([0-5]\\d)(?![\\d:])(?:\\s*Uhr)?";
const VOR = "(?<![\\d:.,])";
function einzeln(h, m) { return Number(m) === 0 ? Number(h) + " Uhr" : Number(h) + " Uhr " + Number(m); }
function fuerStimme(text) {
  const von = new RegExp(VOR + Z + "\\s*[–—-]\\s*" + Z, "g");
  return String(text || "")
    .replace(von, (_, h1, m1, h2, m2) => einzeln(h1, m1) + " bis " + einzeln(h2, m2))
    .replace(new RegExp(VOR + Z, "g"), (_, h, m) => einzeln(h, m));
}
module.exports = { fuerStimme };
