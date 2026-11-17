"use strict";
// Update-Meldung: sagt der App, ob im eigenen GitHub-Projekt eine neuere APK liegt. Das Projekt kennt Vercel selbst (VERCEL_GIT_REPO_*).
// Ist das Projekt privat, wird der optionale GitHub-Zugang (nur lesen) benutzt; der Download-Link ist dann ein kurzlebiger Link von GitHub.
const K = require("./_keys.js");
const { tor } = require("./_tor.js");
const gh = async (url, token, extra) => fetch(url, Object.assign({ headers: Object.assign({ Accept: "application/vnd.github+json", "User-Agent": "atlas" }, token ? { Authorization: "Bearer " + token } : {}), signal: AbortSignal.timeout(9000) }, extra));
module.exports = async function handler(req, res) {
  const b = await tor(req, res); if (!b) return;
  try {
    const o = process.env.VERCEL_GIT_REPO_OWNER, r = process.env.VERCEL_GIT_REPO_SLUG;
    if (!o || !r) return res.status(200).json({ ok: true, neu: false, grund: "Projekt unbekannt" });
    const token = await K.schluesselHolen("github").catch(() => null);
    const rel = await gh("https://api.github.com/repos/" + o + "/" + r + "/releases/latest", token);
    if (!rel.ok) return res.status(200).json({ ok: true, neu: false, grund: rel.status === 404 && !token ? "Projekt privat: GitHub-Zugang fehlt" : "GitHub antwortet " + rel.status });
    const j = await rel.json(), n = +String(j.tag_name || "").replace(/\D/g, ""), a = (j.assets || []).filter(x => /\.apk$/i.test(x.name))[0];
    const code = +b.code || 0;
    if (!n || !a || n <= code) return res.status(200).json({ ok: true, neu: false, aktuell: code, neueste: n || null });
    let url = a.browser_download_url;
    if (token) { // privates Projekt: GitHub gibt einen kurzlebigen Download-Link heraus
      const d = await gh("https://api.github.com/repos/" + o + "/" + r + "/releases/assets/" + a.id, token, { redirect: "manual" });
      url = d.headers.get("location") || ""; if (!url) return res.status(200).json({ ok: true, neu: false, grund: "Download-Link nicht erhalten" });
    }
    res.status(200).json({ ok: true, neu: true, nummer: n, url });
  } catch (e) { res.status(200).json({ ok: false, fehler: String(e.message || e).slice(0, 200) }); }
};
