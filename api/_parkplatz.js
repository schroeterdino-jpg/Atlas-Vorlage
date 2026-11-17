"use strict";
// Parkplatz: die Atlas-App meldet, wo das Auto stand, als das Auto-Bluetooth getrennt wurde. "Wo steht mein Auto?" liest es wieder.
const K = require("./_keys.js");
const F = require("./_fahrt.js");
const TZ = "Europe/Berlin";
async function laden() { try { const r = await K.redis(["HGET", "atlas:plan", "parkplatz"]); return r ? JSON.parse(r) : null; } catch (e) { return null; } }
async function speichern(lat, lon, quelle, zeitMs) {
  lat = Number(lat); lon = Number(lon);
  if (!isFinite(lat) || !isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return { ok: false, hinweis: "Standort ungültig." };
  let o = { strasse: "", ort: "" }; try { const key = await K.schluesselHolen("maps").catch(() => null); o = await F.ortZuPunkt([lat, lon], key); } catch (e) {}
  const p = { lat, lon, zeit: new Date(isFinite(zeitMs) && zeitMs > 0 ? zeitMs : Date.now()).toISOString(), strasse: o.strasse || "", ort: o.ort || "", quelle: quelle === "bluetooth" ? "bluetooth" : "hand" };
  await K.redis(["HSET", "atlas:plan", "parkplatz", JSON.stringify(p)]);
  return { ok: true, parkplatz: p };
}
function vor(p) { const m = Math.max(0, Math.round((Date.now() - Date.parse(p.zeit)) / 60000)); return m < 60 ? m + " Minuten" : m < 1440 ? Math.floor(m / 60) + " Std " + (m % 60) + " Min" : Math.floor(m / 1440) + " Tage"; }
function lesbar(p) { return [p.strasse, p.ort].filter(Boolean).join(", ") || "(Adresse unbekannt)"; }
async function parkplatz(a, ctx) {
  const aktion = String(a.aktion || "wo");
  if (aktion === "merken") {
    const st = ctx && ctx.standort; if (!st) return { ok: false, hinweis: "Der Handy-Standort fehlt gerade. Ehrlich sagen, dass Atlas den Standort nicht hat, und bitten, die Standortfreigabe zu prüfen." };
    const r = await speichern(st.lat, st.lon, "hand"); if (!r.ok) return r;
    return { ok: true, gemerkt: lesbar(r.parkplatz), hinweis: "Sage kurz, dass das Auto hier gemerkt ist: " + lesbar(r.parkplatz) + "." };
  }
  if (aktion === "vergessen") { await K.redis(["HDEL", "atlas:plan", "parkplatz"]); return { ok: true, hinweis: "Sage kurz, dass der Parkplatz gelöscht ist." }; }
  const p = await laden();
  if (!p) return { ok: true, unbekannt: true, hinweis: "Es ist noch kein Parkplatz gespeichert. Sage das ehrlich. Er wird automatisch gespeichert, wenn das Auto-Bluetooth getrennt wird (das muss Sam in der Kachel PARKPLATZ einrichten), oder Sam sagt 'ich parke hier'." };
  const out = { ok: true, wo: lesbar(p), vor: vor(p), quelle: p.quelle === "bluetooth" ? "automatisch beim Trennen des Auto-Bluetooth" : "von Hand gemerkt", karte: undefined };
  const st = ctx && ctx.standort; if (st) out.entfernung_km = Math.round(F.km2([st.lat, st.lon], [p.lat, p.lon]) * 10) / 10;
  out.hinweis = "Sage, wo das Auto steht (" + out.wo + "), seit wann (vor " + out.vor + ")" + (out.entfernung_km != null ? " und wie weit es entfernt ist (" + out.entfernung_km + " km Luftlinie)" : "") + ". Bei 'führe mich hin' das Werkzeug navigation mit ziel 'auto' und modus zu_fuss aufrufen.";
  return out;
}
module.exports = { parkplatz, speichern, laden, lesbar };
