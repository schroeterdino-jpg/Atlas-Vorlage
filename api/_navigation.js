"use strict";
// Navigation: Atlas sucht das Ziel (Heim, Arbeit, gespeicherte Orte, Kontakte mit Adresse, sonst Freitext fuer Google Maps)
// und die Atlas-App startet Google Maps mit der Routenfuehrung. Atlas selbst kann nicht pruefen, ob Maps es uebernommen hat.
const F = require("./_fahrt.js");
const Ab = require("./_autobahn.js");
const Pk = require("./_parkplatz.js");
const frist = (p, ms) => Promise.race([p, new Promise(r => setTimeout(() => r(null), ms))]).catch(() => null);
const MODI = { auto: "driving", zu_fuss: "walking", rad: "bicycling", oepnv: "transit" };

async function navigation(a, ctx) {
  const roh = String(a.ziel || "").trim().slice(0, 200);
  if (!roh) return { ok: false, hinweis: "Es fehlt, wohin Sam navigieren will. Nachfragen." };
  const k = F.ortKey(roh); let adresse = roh, name = roh;
  if (/^(heim|nach hause|zuhause|zu hause|haus)$/.test(k)) { adresse = (await F.adressenListe()).heim; name = "nach Hause"; }
  else if (/^(arbeit|zur arbeit|firma|work)$/.test(k)) { adresse = (await F.adressenListe()).arbeit; name = "zur Arbeit"; }
  else if (/^(mein auto|auto|parkplatz|mein parkplatz|zum auto|zu meinem auto)$/.test(k)) { const p = await Pk.laden(); if (!p) return { ok: false, hinweis: "Es ist noch kein Parkplatz gespeichert. Ehrlich sagen." }; adresse = p.lat + "," + p.lon; name = "zum Auto"; if (!a.modus) a = Object.assign({}, a, { modus: "zu_fuss" }); }
  else { const o = F.ortFinden(await F.ortListe(), roh); if (o && o.adresse) { adresse = o.adresse; name = o.name || roh; } }
  const modus = MODI[a.modus] ? a.modus : "auto";
  const url = "https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(adresse) + "&travelmode=" + MODI[modus];
  const out = { ok: true, ziel: name, adresse, modus, fuerApp: { aktion: "navigation", ziel: adresse, modus, url } };
  const st = ctx && ctx.standort;
  out.verkehr_geprueft = false;
  if (st && modus === "auto") { const f = await frist(F.strecke(st.lat + "," + st.lon, adresse), 8000); if (f && f.ok) { out.verkehr_geprueft = !!f.live; out.fahrzeit_min = f.minuten; out.verzoegerung_min = f.verzoegerung_min; out.km = Math.round(f.km); out.lage = f.verzoegerung_min < 5 ? "frei" : f.verzoegerung_min < 15 ? "leicht erhöht" : "dicht"; if (f.staus && f.staus.length) out.staus = f.staus.slice(0, 3); const ab = await frist(Ab.aufStrecke(f.karte && f.karte.punkte), 9000); if (ab && ab.ok) { out.autobahn = { sperrungen: ab.sperrungen, warnungen: ab.warnungen, baustellen: ab.baustellen.length, vollstaendig: ab.vollstaendig }; } } }
  else if (!st && modus === "auto") out.standort_fehlt = true;
  out.hinweis = "Die Atlas-App startet jetzt Google Maps mit der Navigation zu '" + name + "'. Sage kurz, dass die Navigation startet, und IMMER wie der Verkehr auf der Strecke ist: " + (out.fahrzeit_min ? "Fahrzeit etwa " + out.fahrzeit_min + " Minuten, Verkehrslage '" + out.lage + "'" + (out.verzoegerung_min >= 5 ? " (" + out.verzoegerung_min + " Minuten länger als sonst)" : "") + (out.staus ? ", Staustellen nennen (staus)" : (out.verkehr_geprueft ? ", keine Staus gemeldet" : ", Live-Verkehr war nicht verfügbar: das ehrlich sagen")) + "." : out.standort_fehlt ? "Der Standort fehlte, deshalb konnte der Verkehr nicht geprüft werden: das ehrlich sagen, Maps zeigt ihn selbst." : "Der Verkehr konnte nicht geprüft werden: ehrlich sagen, Maps zeigt ihn selbst.") + " Autobahn-Sperrungen stehen in autobahn (sperrungen zuerst nennen, sonst kurz 'keine Sperrung auf Autobahnen gemeldet'; fehlt autobahn, ehrlich sagen, dass sie nicht geprüft wurden; Landstraßen werden nicht geprüft). Baustellen: Anzahl in autobahn.baustellen, sonst zeigt Maps sie. Atlas kann nicht prüfen, ob Maps es übernommen hat: nicht behaupten, dass es läuft. Bei einem Ort nur mit Namen sagen, dass Maps das Ziel selbst sucht.";
  return out;
}
module.exports = { navigation };
