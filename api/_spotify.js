"use strict";
// Spotify per Sprache: die App am Handy steuert die Spotify-App (Medientasten, Suche starten). Ohne Premium und ohne Anmeldung bei Spotify.
const AKTIONEN = ["abspielen", "pause", "weiter", "naechstes", "vorheriges", "lauter", "leiser"];
const ART = ["kuenstler", "lied", "album", "playlist"];
async function spotify(a, ctx) {
  if (!ctx || !ctx.app) return { ok: false, hinweis: "Spotify steuern geht nur in der Atlas-App auf dem Handy. Sage das kurz und ehrlich." };
  const aktion = AKTIONEN.includes(a.aktion) ? a.aktion : (a.suche ? "abspielen" : "weiter");
  if (aktion === "abspielen") {
    const suche = String(a.suche || "").trim().slice(0, 120);
    if (!suche) return { ok: false, hinweis: "Was soll gespielt werden (Künstler, Lied oder Playlist)? Nachfragen." };
    return { ok: true, aktion, suche, fuerApp: { aktion, suche, art: ART.includes(a.art) ? a.art : "" }, hinweis: "Sage kurz, dass du '" + suche + "' in Spotify startest. Atlas kann nicht prüfen, ob Spotify genau das Gewünschte spielt; ohne Premium kann Spotify auch gemischt abspielen." };
  }
  const wort = { pause: "Pause", weiter: "Weiter", naechstes: "Nächstes Lied", vorheriges: "Vorheriges Lied", lauter: "Lauter", leiser: "Leiser" }[aktion];
  return { ok: true, aktion, fuerApp: { aktion }, hinweis: "Bestätige mit einem ganz kurzen Wort, zum Beispiel '" + wort + ".' Kein langer Satz." };
}
module.exports = { spotify, AKTIONEN };
