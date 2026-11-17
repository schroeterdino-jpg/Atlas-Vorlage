"use strict";
// Kontakte: Name + Telefonnummer + Adresse in einem Eintrag. Teilt sich den Speicher mit "meine_orte" (atlas:plan, Feld orte),
// damit Fahrzeit und Abfahrt mit dem Namen weiter funktionieren. Anrufen/WhatsApp kommt erst mit der Android-App.
const K = require("./_keys.js");
const F = require("./_fahrt.js");

// Nummer ordentlich ablegen: Ziffern, +, Leerzeichen; mindestens 5 Ziffern
function nummer(t) { const s = String(t || "").replace(/[^\d+]/g, ""); const z = s.replace(/\D/g, ""); if (z.length < 5 || z.length > 16) return null; return s.replace(/^00/, "+").replace(/(?!^)\+/g, ""); }
const speichern = liste => K.redis(["HSET", "atlas:plan", "orte", JSON.stringify(liste)]);
const zeile = o => ({ name: o.name, telefon: o.telefon || undefined, adresse: o.adresse || undefined });

async function kontakte(a) {
  const liste = await F.ortListe(), aktion = a.aktion || "zeigen";
  if (aktion === "zeigen") {
    const such = String(a.name || a.suche || "").trim();
    if (!such) { const alle = Object.values(liste).map(zeile); return { ok: true, anzahl: alle.length, kontakte: alle, hinweis: alle.length ? "Nur Namen vorlesen, Nummern und Adressen nur auf Nachfrage." : "Noch keine Kontakte gespeichert. Ehrlich sagen." }; }
    const k = F.ortKey(such), o = F.ortFinden(liste, such) || Object.values(liste).find(x => F.ortKey(x.name).includes(k) || k.includes(F.ortKey(x.name)));
    if (!o) return { ok: false, hinweis: "Einen Kontakt '" + such + "' habe ich nicht. Ehrlich sagen und fragen, ob er gespeichert werden soll.", gespeichert: Object.values(liste).map(x => x.name) };
    return { ok: true, kontakt: zeile(o), hinweis: o.telefon ? "Nummer Ziffer für Ziffer in Dreiergruppen vorlesen. Anrufen und WhatsApp gibt es noch nicht (kommt mit der Android-App): ehrlich sagen." : "Keine Nummer gespeichert: ehrlich sagen und fragen, ob sie dazu soll." };
  }
  const name = String(a.name || "").trim(), k = F.ortKey(name);
  if (!k) return { ok: false, hinweis: "Wie heißt der Kontakt? Nachfragen." };
  if (k === "heim" || k === "arbeit") return { ok: false, hinweis: "Heim und Arbeit sind keine Kontakte; die Adresse ändert man über meine_orte." };
  const ex = F.ortFinden(liste, name) && F.ortKey(F.ortFinden(liste, name).name) === k ? F.ortFinden(liste, name) : liste[k];
  if (aktion === "loeschen") {
    if (!ex) return { ok: false, hinweis: "Einen Kontakt '" + name + "' habe ich nicht.", gespeichert: Object.values(liste).map(x => x.name) };
    if (!a.bestaetigt) return { ok: false, bestaetigung_noetig: true, kontakt: zeile(ex), hinweis: "Sam fragen, ob '" + ex.name + "' ganz gelöscht werden soll (mit Nummer und Adresse). Erst nach Ja mit bestaetigt:true erneut aufrufen." };
    delete liste[F.ortKey(ex.name)]; await speichern(liste); return { ok: true, geloescht: ex.name };
  }
  if (aktion !== "setzen") return { ok: false, hinweis: "Unbekannte Aktion. Möglich: zeigen, setzen, loeschen." };
  const tel = a.telefon === undefined || a.telefon === "" ? null : nummer(a.telefon);
  if (a.telefon && !tel) return { ok: false, hinweis: "Die Telefonnummer sieht nicht richtig aus. Sam bitten, sie noch einmal zu nennen (am besten ins Eingabefeld zu tippen)." };
  const adr = a.adresse ? String(a.adresse).trim() : "";
  if (!tel && !adr) return { ok: false, hinweis: "Es fehlt die Nummer oder die Adresse für '" + name + "'. Nachfragen." };
  if (adr) { // Adresse mit Ort wie bei meine_orte prüfen
    if (adr.length < 5) return { ok: false, hinweis: "Wie lautet die Adresse von '" + name + "' (Straße, Hausnummer, Ort)?" };
    const key = await K.schluesselHolen("maps").catch(() => null); let p;
    try { p = await F.geocode(adr, key); } catch (e) { return { ok: false, technisch: true, hinweis: "Adresssuche gerade nicht erreichbar: " + String(e.message || e) }; }
    if (!p) return { ok: false, hinweis: "Die Adresse '" + adr + "' habe ich nicht gefunden. Nach der genauen Adresse mit Ort fragen." };
    a._gefunden = p.name;
  }
  const aendert = !!(ex && ((tel && ex.telefon && ex.telefon !== tel) || (adr && ex.adresse && ex.adresse !== adr)));
  if (!a.bestaetigt && (adr || aendert)) return { ok: false, bestaetigung_noetig: true, neu: { name, telefon: tel || undefined, adresse: adr || undefined }, gefunden: a._gefunden, alt: ex ? zeile(ex) : null, hinweis: "Sam vorlesen, was gespeichert wird" + (adr ? " (gefundene Adresse nennen)" : "") + (aendert ? " und dass der alte Eintrag überschrieben wird" : "") + ", und fragen, ob das stimmt. Erst nach Ja mit bestaetigt:true erneut aufrufen." };
  const neu = Object.assign({}, ex || {}, { name: ex ? ex.name : name.slice(0, 60) }); if (tel) neu.telefon = tel; if (adr) neu.adresse = adr;
  liste[F.ortKey(neu.name)] = neu; await speichern(liste);
  return { ok: true, gespeichert: zeile(neu), hinweis: "Gespeichert." + (neu.adresse ? " Fahrzeit und Abfahrt gehen jetzt mit dem Namen." : "") };
}
module.exports = { kontakte, nummer };
