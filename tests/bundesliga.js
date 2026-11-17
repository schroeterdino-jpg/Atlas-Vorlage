"use strict";
process.env.VERCEL_PROJECT_PRODUCTION_URL = "atlas-beispiel.vercel.app"; // Test laeuft als Altbestand-Kopie (Profil des Erfinders)
const assert = require("assert");
const jetzt = Date.now(), iso = ms => new Date(ms).toISOString();
const M = [
  { team1: { teamName: "FC Bayern München" }, team2: { teamName: "Hamburger SV" }, matchIsFinished: true, matchDateTimeUTC: iso(jetzt - 86400000), matchResults: [{ resultTypeID: 1, pointsTeam1: 1, pointsTeam2: 0 }, { resultTypeID: 2, pointsTeam1: 3, pointsTeam2: 1 }], group: { groupName: "11. Spieltag" } },
  { team1: { teamName: "Werder Bremen" }, team2: { teamName: "VfB Stuttgart" }, matchIsFinished: false, matchDateTimeUTC: iso(jetzt - 3600000), matchResults: [], goals: [{ scoreTeam1: 1, scoreTeam2: 0 }], group: { groupName: "11. Spieltag" } },
  { team1: { teamName: "RB Leipzig" }, team2: { teamName: "FC St. Pauli" }, matchIsFinished: false, matchDateTimeUTC: iso(jetzt + 86400000), matchResults: [], group: { groupName: "11. Spieltag" } }];
const TAB = [{ teamName: "FC Bayern München", points: 30, goals: 40, opponentGoals: 8, matches: 10 }, { teamName: "Hamburger SV", points: 12, goals: 12, opponentGoals: 15, matches: 10 }];
let geholt = [];
global.fetch = async url => { geholt.push(String(url)); if (/getmatchdata/.test(url)) return { ok: true, json: async () => M }; if (/getbltable/.test(url)) return { ok: true, json: async () => TAB }; return { ok: false, status: 404 }; };
const W = require("../api/_werkzeuge.js");
(async () => {
  let e = await W.ausfuehren("bundesliga", {});
  assert.ok(e.ok && e.spieltag === "11. Spieltag" && e.spiele.length === 3, JSON.stringify(e));
  assert.deepStrictEqual([e.spiele[0].stand, e.spiele[0].ergebnis], ["beendet", "3:1"]);
  assert.deepStrictEqual([e.spiele[1].stand, e.spiele[1].ergebnis], ["läuft", "1:0"]);
  assert.strictEqual(e.spiele[2].stand, "kommt"); assert.ok(e.spiele[2].anstoss);
  assert.ok(/getmatchdata\/bl1$/.test(geholt[0]));
  e = await W.ausfuehren("bundesliga", { team: "HSV" }); assert.ok(e.ok && e.spiele[0].gast === "Hamburger SV", "HSV wird erkannt");
  e = await W.ausfuehren("bundesliga", { team: "Dortmund" }); assert.ok(!e.ok, "spielt nicht: ehrlich melden");
  e = await W.ausfuehren("bundesliga", { team: "Hamburger" }); assert.ok(e.ok && e.spiele.length === 1 && e.spiele[0].ergebnis === "3:1");
  e = await W.ausfuehren("bundesliga", { aktion: "tabelle", liga: "2" }); assert.ok(e.ok && e.tabelle[1].platz === 2 && /getbltable\/bl2\/20\d\d$/.test(geholt[geholt.length - 1]));
  global.fetch = async () => { throw new Error("offline"); };
  e = await W.ausfuehren("bundesliga", {}); assert.ok(!e.ok && e.technisch);
  console.log("bundesliga: alle Pruefungen gruen");
})().catch(x => { console.error(x); process.exit(1); });
