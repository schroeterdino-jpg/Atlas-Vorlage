"use strict";
// "Früher losfahren": kurz vor der Abfahrt prüft die App den Verkehr. Nur wenn die Fahrt zur Arbeit spürbar länger dauert
// (oder Stau/Sperrung auf der Strecke ist), kommt eine Benachrichtigung. Sonst bleibt es still.
const text = out => {
  if (!out || !out.fahrt || out.fahrt.art !== "arbeit") return { senden: false };
  const f = out.fahrt, plus = f.normal ? f.minuten - f.normal : 0, sperr = out.autobahn_sperrung;
  if (plus < 5 && !f.stau && !sperr) return { senden: false };
  const frueher = Math.max(5, Math.ceil(plus / 5) * 5), teile = [];
  if (plus >= 5) teile.push("Die Fahrt dauert etwa " + f.minuten + " Minuten, " + plus + " mehr als sonst.");
  if (f.stau) teile.push("Stau: " + f.stau + ".");
  if (sperr) teile.push("Sperrung auf der Autobahn: " + sperr + ".");
  teile.push("Fahr lieber " + frueher + " Minuten früher los.");
  return { senden: true, titel: "Früher losfahren", text: teile.join(" ") };
};
module.exports = { text };
