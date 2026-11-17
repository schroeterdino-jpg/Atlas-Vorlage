"use strict";
// Prueft die Update-Meldung: neuere APK im eigenen Projekt, oeffentlich und privat (mit GitHub-Zugang).
const assert = require("assert");
process.env.ATLAS_SECRET = "geheim-geheim-geheim"; process.env.KV_REST_API_URL = "https://db.test"; process.env.KV_REST_API_TOKEN = "t";
delete process.env.GITHUB_TOKEN; process.env.VERCEL_GIT_REPO_OWNER = "anna"; process.env.VERCEL_GIT_REPO_SLUG = "Atlas";
const K = require("./../api/_keys.js"); const store = {}; const aufrufe = [];
global.fetch = async (url, o) => {
  url = String(url);
  if (url.startsWith("https://db.test")) { const c = JSON.parse(o.body); let r = null; if (c[0] === "HSET") { store[c[2]] = c[3]; r = 1; } else if (c[0] === "HGET") r = store[c[2]] || null; else if (c[0] === "HKEYS") r = Object.keys(store); return { json: async () => ({ result: r }) }; }
  aufrufe.push({ url, auth: o && o.headers && o.headers.Authorization });
  if (url.endsWith("/releases/latest")) { if (!store.github_priv_ok && global.__privat && !(o.headers.Authorization)) return { ok: false, status: 404 }; return { ok: true, status: 200, json: async () => ({ tag_name: "atlas-60", assets: [{ id: 7, name: "Atlas.apk", browser_download_url: "https://github.com/anna/Atlas/releases/download/atlas-60/Atlas.apk" }] }) }; }
  if (url.includes("/releases/assets/7")) return { ok: false, status: 302, headers: { get: () => "https://signiert.example/Atlas.apk?sig=1" } };
  return { ok: false, status: 500 };
};
const api = require("../api/update.js");
const run = body => new Promise(r => { const res = { setHeader() {}, status() { return this; }, json: j => r(j) }; api({ method: "POST", headers: {}, body }, res); });
(async () => {
  const pw = "geheim-geheim-geheim";
  let j = await run({ pw, code: 55 }); assert.ok(j.ok && j.neu && j.nummer === 60 && /github\.com\/anna\/Atlas/.test(j.url), "oeffentlich: direkter Link");
  j = await run({ pw, code: 60 }); assert.ok(j.ok && !j.neu, "gleiche Version: nichts Neues");
  global.__privat = true; j = await run({ pw, code: 55 }); assert.ok(j.ok && !j.neu && /privat/.test(j.grund), "privat ohne Zugang: ehrlicher Grund");
  await K.schluesselSpeichern("github", "github_pat_abcdefgh"); store.github_priv_ok = false;
  j = await run({ pw, code: 55 }); assert.ok(j.ok && j.neu && /signiert/.test(j.url), "privat mit Zugang: kurzlebiger Link"); assert.ok(aufrufe.some(a => a.auth === "Bearer github_pat_abcdefgh"));
  delete process.env.VERCEL_GIT_REPO_OWNER; j = await run({ pw, code: 1 }); assert.ok(j.ok && !j.neu, "ohne Projektangabe: still");
  console.log("update: alle Pruefungen gruen");
})().catch(e => { console.error(e); process.exit(1); });
