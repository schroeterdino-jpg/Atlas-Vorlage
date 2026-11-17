"use strict";
// Autobahn-Meldungen (Sperrungen, Warnungen, Baustellen) der Autobahn GmbH, offene Schnittstelle ohne Schluessel.
// Gilt nur fuer Autobahnen. Die Antwortform ist defensiv gelesen, weil sie von hier nicht live pruefbar war.
const K = require("./_keys.js");
const BASIS = "https://verkehr.autobahn.de/o/autobahn/";
const STRASSEN = ["A1", "A7", "A19", "A20", "A21", "A23", "A24", "A25", "A39", "A210", "A215", "A250", "A255", "A261", "A352", "A370"];
const ARTEN = { closure: "Sperrung", warning: "Warnung", roadworks: "Baustelle" };
const rad = x => x * Math.PI / 180;
function frist(p, ms) { return Promise.race([p, new Promise(r => setTimeout(() => r(null), ms))]).catch(() => null); }

async function holen(strasse, art) {
  const ck = "atlas:autobahn:" + strasse + ":" + art;
  try { const c = await K.redis(["GET", ck]); if (c) return JSON.parse(c); } catch (e) {}
  const r = await frist(fetch(BASIS + encodeURIComponent(strasse) + "/services/" + art, { headers: { accept: "application/json" } }), 7000);
  if (!r || !r.ok) return null;
  let j; try { j = await r.json(); } catch (e) { return null; }
  const liste = Array.isArray(j && j[art]) ? j[art] : [];
  const out = liste.map(m => normal(m, strasse, art)).filter(Boolean);
  try { await K.redis(["SET", ck, JSON.stringify(out), "EX", "300"]); } catch (e) {}
  return out;
}
function normal(m, strasse, art) {
  const c = m && m.coordinate; if (!c) return null;
  const lat = parseFloat(c.lat), lon = parseFloat(c.long != null ? c.long : c.lon);
  if (!isFinite(lat) || !isFinite(lon)) return null;
  const text = Array.isArray(m.description) ? m.description.filter(Boolean).join(" ") : String(m.description || "");
  return { strasse, art, lat, lon, titel: String(m.title || "").slice(0, 140), ort: String(m.subtitle || "").slice(0, 140), text: text.slice(0, 300), gesperrt: m.isBlocked === true || m.isBlocked === "true", seit: m.startTimestamp || null };
}
// Abstand in km von Punkt p zu Linienzug (flache Naeherung, reicht fuer wenige km)
function abstand(p, linie) {
  const k = Math.cos(rad(p[0])), px = p[1] * k, py = p[0]; let best = Infinity;
  for (let i = 0; i < linie.length; i++) {
    const ax = linie[i][1] * k, ay = linie[i][0], bx = (linie[i + 1] || linie[i])[1] * k, by = (linie[i + 1] || linie[i])[0];
    const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy, t = l ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l)) : 0;
    const d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy)) * 111.2; if (d < best) best = d;
  }
  return best;
}
async function alle(strassen, arten) {
  const jobs = []; (strassen || STRASSEN).forEach(s => (arten || Object.keys(ARTEN)).forEach(a => jobs.push(holen(s, a))));
  const res = await Promise.all(jobs); const ok = res.filter(x => x !== null).length;
  return { meldungen: [].concat.apply([], res.filter(Boolean)), abgefragt: res.length, erreicht: ok };
}
// Meldungen nahe einer Strecke (punkte = [[lat, lon, ...], ...])
async function aufStrecke(punkte, km) {
  if (!Array.isArray(punkte) || punkte.length < 2) return { ok: false, hinweis: "Keine Strecke zum Prüfen." };
  const a = await alle(); const grenze = km || 2;
  const treffer = a.meldungen.map(m => ({ m, d: abstand([m.lat, m.lon], punkte) })).filter(x => x.d <= grenze).sort((x, y) => (y.m.gesperrt - x.m.gesperrt) || (x.m.art === "closure" ? -1 : 1) - (y.m.art === "closure" ? -1 : 1));
  if (!a.erreicht) return { ok: false, hinweis: "Die Autobahn-Meldungen waren gerade nicht abrufbar." };
  return { ok: true, vollstaendig: a.erreicht === a.abgefragt, sperrungen: treffer.filter(x => x.m.art === "closure" || x.m.gesperrt).map(x => kurz(x.m)), warnungen: treffer.filter(x => x.m.art === "warning" && !x.m.gesperrt).map(x => kurz(x.m)), baustellen: treffer.filter(x => x.m.art === "roadworks" && !x.m.gesperrt).map(x => kurz(x.m)) };
}
function kurz(m) { return { strasse: m.strasse, art: ARTEN[m.art], titel: m.titel, ort: m.ort, text: m.text.slice(0, 160) }; }
// Eine Zeile fuer Push und Animation
function zeile(r) {
  if (!r || !r.ok) return "";
  const s = r.sperrungen.length, w = r.warnungen.length, b = r.baustellen.length;
  if (!s && !w && !b) return "Autobahn: keine Meldungen auf der Strecke";
  const t = []; if (s) t.push(s + " Sperrung" + (s > 1 ? "en" : "")); if (w) t.push(w + " Warnung" + (w > 1 ? "en" : "")); if (b) t.push(b + " Baustelle" + (b > 1 ? "n" : ""));
  const erst = (r.sperrungen[0] || r.warnungen[0] || r.baustellen[0]); return "Autobahn: " + t.join(", ") + " · " + erst.strasse + " " + (erst.ort || erst.titel).slice(0, 80);
}

async function werkzeug(a) {
  const F = require("./_fahrt.js");
  if (a.von && a.nach) {
    const f = await F.strecke(a.von, a.nach); if (!f.ok) return f;
    const r = await aufStrecke(f.karte && f.karte.punkte);
    return Object.assign({ von: f.von, nach: f.nach, hinweis: "Nur Autobahnen werden geprüft, keine Landstraßen. Sperrungen zuerst nennen. Wenn vollstaendig false ist, sagen, dass nicht alle Autobahnen abrufbar waren." }, r);
  }
  const s = String(a.autobahn || "").toUpperCase().replace(/\s+/g, "").replace(/^(AUTOBAHN)/, "");
  if (!/^A\d{1,3}$/.test(s)) return { ok: false, hinweis: "Es fehlt die Autobahn (zum Beispiel A7) oder Start und Ziel. Nachfragen." };
  const x = await alle([s]); if (!x.erreicht) return { ok: false, hinweis: "Die Meldungen für " + s + " waren gerade nicht abrufbar." };
  const sp = x.meldungen.filter(m => m.art === "closure" || m.gesperrt);
  return { ok: true, autobahn: s, sperrungen: sp.slice(0, 10).map(kurz), warnungen: x.meldungen.filter(m => m.art === "warning" && !m.gesperrt).slice(0, 8).map(kurz), baustellen_anzahl: x.meldungen.filter(m => m.art === "roadworks").length, hinweis: "Sperrungen zuerst nennen, dann Warnungen. Baustellen nur die Anzahl, Details auf Nachfrage." };
}
module.exports = { aufStrecke, zeile, werkzeug, abstand, normal, STRASSEN };
