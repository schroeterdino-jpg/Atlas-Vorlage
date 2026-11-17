// Einrichtungsassistent: fragt beim ersten Start nach Name, Wohnort, Arbeit, Zugaengen (Schluessel) und Berechtigungen.
// Wird automatisch geoeffnet, wenn das Profil noch nicht eingerichtet ist, oder ueber index.html#einrichten.
(function () {
  var api = window.AtlasApi; if (!api) return;
  var DATEN = { name: "", nachname: "", ort: "", heim: "", arbeit: "" };
  var ZUGAENGE = [
    { id: "groq", name: "Groq (die KI)", pflicht: true, kosten: "gratis", wo: "console.groq.com, dort API Keys", text: "Ohne diesen Schlüssel kann Atlas nicht denken. Der Gratis-Tarif reicht." },
    { id: "fish", name: "Fish Audio (schöne Stimme)", kosten: "gratis-Modell, sonst kostenpflichtig", wo: "fish.audio, dort API Keys", text: "Ohne Schlüssel spricht Atlas mit der Stimme deines Handys. Sie klingt etwas roboterhafter, kostet aber nichts." },
    { id: "maps", name: "Google Maps (Orte, Fahrzeit)", kosten: "Gratis-Guthaben, Konto mit Zahlungsmittel nötig", wo: "console.cloud.google.com, Maps Platform, API-Schlüssel", text: "Für Adressen, Navigation und Fahrzeit." },
    { id: "github", name: "GitHub-Zugang (Update-Meldung)", kosten: "gratis", wo: "github.com/settings/personal-access-tokens, nur lesen", text: "Nur nötig, wenn dein GitHub-Projekt privat ist. Dann findet Atlas neue App-Versionen." },
    { id: "tomtom", name: "TomTom (Verkehr)", kosten: "gratis", wo: "developer.tomtom.com", text: "Für Staus und die Verkehrslage." },
    { id: "tankerkoenig", name: "Tankerkönig (Spritpreise)", kosten: "gratis", wo: "creativecommons.tankerkoenig.de", text: "Für Tankstellen und Preise in der Nähe." },
    { id: "serper", name: "Serper (Websuche)", kosten: "Gratis-Start, danach kostenpflichtig", wo: "serper.dev", text: "Für Fragen, die eine Suche im Internet brauchen." },
    { id: "googleid", name: "Google Kalender: Client-ID", kosten: "gratis", wo: "console.cloud.google.com, Anmeldedaten, OAuth-Client", text: "Für Kalender und Mails. Danach auf der Einrichtungsseite (Zahnrad) auf „Mit Google verbinden“ tippen." },
    { id: "googlesecret", name: "Google Kalender: Client-Secret", kosten: "gratis", wo: "gleiche Stelle wie die Client-ID", text: "Gehört zur Client-ID." },
    { id: "vektorurl", name: "Gedächtnis: URL (Upstash Vector)", kosten: "gratis", wo: "console.upstash.com, Vector, REST API", text: "Damit Atlas sich Dinge dauerhaft merkt." },
    { id: "vektortoken", name: "Gedächtnis: Token (Upstash Vector)", kosten: "gratis", wo: "gleiche Stelle wie die URL", text: "Gehört zur URL." }
  ];
  var gesetzt = {}, schritt = 0, box = null;
  var ST = "#wiz{position:fixed;inset:0;z-index:50;background:#030610;color:#d7f8ff;overflow:auto;padding:calc(env(safe-area-inset-top) + 18px) 18px 28px;font-family:system-ui,sans-serif}" +
    "#wiz .in{max-width:460px;margin:0 auto}#wiz h1{font-size:22px;font-weight:500;margin:18px 0 6px;text-align:center}#wiz p{color:#8fb3c4;font-size:14px;line-height:1.5;margin:0 0 14px}" +
    "#wiz .bar{display:flex;gap:6px}#wiz .bar i{flex:1;height:4px;border-radius:2px;background:#16303f}#wiz .bar i.an{background:#28dcff}" +
    "#wiz label{display:block;font-size:12px;color:#6a95a8;margin:12px 0 4px}#wiz input{width:100%;padding:12px;border-radius:10px;border:1px solid #234660;background:#08192a;color:#e6fcff;font-size:16px}" +
    "#wiz button{padding:13px;border-radius:10px;border:1px solid #234660;background:transparent;color:#9fd0e0;font-size:15px}#wiz button.p{background:#28dcff;border-color:#28dcff;color:#03222c;font-weight:600}" +
    "#wiz .zu{display:flex;gap:10px;margin-top:22px}#wiz .zu button{flex:1}#wiz .zu button.p{flex:2}" +
    "#wiz .k{background:#08192a;border:1px solid #16303f;border-radius:12px;padding:12px;margin:10px 0}#wiz .k b{font-weight:500;color:#e6fcff;font-size:15px}#wiz .k small{display:block;color:#6a95a8;font-size:12px;margin-top:3px;line-height:1.4}" +
    "#wiz .tag{display:inline-block;font-size:11px;padding:2px 8px;border-radius:8px;margin-left:6px;background:#0d3a2c;color:#6be4a8}#wiz .tag.pf{background:#3a2a0d;color:#ffcf6b}#wiz .ok{color:#6be4a8;font-size:13px}#wiz .fe{color:#ff8a8a;font-size:13px}" +
    "#wiz .row{display:flex;gap:8px;margin-top:8px}#wiz .row input{flex:1}#wiz .row button{padding:10px 14px}#wiz .st{font-size:13px;margin-top:8px;min-height:18px;color:#8fb3c4}" +
    "#wiz summary{cursor:pointer;color:#9fd0e0;margin:16px 0 4px;font-size:14px}";
  function el(h) { var d = document.createElement("div"); d.innerHTML = h; return d.firstChild; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function bar() { var h = '<div class="bar">'; for (var i = 0; i < 6; i++) h += '<i class="' + (i <= schritt ? "an" : "") + '"></i>'; return h + "</div>"; }
  function knoepfe(zurueck, weiter) { return '<div class="zu">' + (zurueck ? '<button id="wz">Zurück</button>' : "") + '<button class="p" id="ww">' + (weiter || "Weiter") + "</button></div>"; }
  function lies(id) { var e = box.querySelector("#" + id); return e ? e.value.trim() : ""; }
  function zeigeFehler(t) { var e = box.querySelector("#wf"); if (e) { e.className = "st fe"; e.textContent = t; } }
  function speicherProfil(fertig) { return api("profil", { aktion: "speichern", fertig: !!fertig, profil: { name: DATEN.name, nachname: DATEN.nachname, ort: DATEN.ort, heim: DATEN.heim, arbeit: DATEN.arbeit } }); }
  function adresse(art, text) { if (!text) return Promise.resolve({ ok: true }); return api("setup", { aktion: "adresseSetzen", ort: art, adresse: text }); }

  function zeichne() {
    var h = '<div class="in">' + bar();
    if (schritt === 0) h += "<h1>Willkommen bei Atlas</h1><p>Ich brauche ein paar Angaben, damit Atlas zu dir passt. Das dauert wenige Minuten.</p><label>Vorname</label><input id='f1' value='" + esc(DATEN.name) + "' autocomplete='off'><label>Nachname (kann leer bleiben)</label><input id='f2' value='" + esc(DATEN.nachname) + "' autocomplete='off'><div class='st' id='wf'></div>" + knoepfe(false);
    else if (schritt === 1) h += "<h1>Wo wohnst du?</h1><p>Für Wetter, Nachrichten aus deiner Nähe und die Fahrzeit nach Hause.</p><label>Ort</label><input id='f1' value='" + esc(DATEN.ort) + "' placeholder='zum Beispiel Kiel'><label>Straße, Hausnummer, PLZ und Ort (kann leer bleiben)</label><input id='f2' value='" + esc(DATEN.heim) + "' placeholder='Hafenstraße 1, 24103 Kiel'><div class='st' id='wf'></div>" + knoepfe(true);
    else if (schritt === 2) h += "<h1>Fährst du zur Arbeit?</h1><p>Dann nenne die Adresse. Atlas rechnet dir die Abfahrt aus. Wenn nicht, lass das Feld leer.</p><label>Adresse der Arbeit</label><input id='f1' value='" + esc(DATEN.arbeit) + "' placeholder='Straße, Hausnummer, PLZ und Ort'><p style='margin-top:12px'>Schicht und Zeiten stellst du später per Sprache ein, zum Beispiel „Ich habe diese Woche Frühschicht“.</p><div class='st' id='wf'></div>" + knoepfe(true);
    else if (schritt === 3) {
      h += "<h1>Zugänge</h1><p>Atlas nutzt Dienste im Internet. Jeder braucht einen eigenen Schlüssel. Nur Groq ist Pflicht, alles andere kannst du später nachholen.</p>";
      var opt = "";
      ZUGAENGE.forEach(function (z) {
        var k = '<div class="k" data-id="' + z.id + '"><b>' + esc(z.name) + '</b><span class="tag' + (z.pflicht ? " pf" : "") + '">' + (z.pflicht ? "Pflicht" : "optional") + "</span><small>" + esc(z.text) + "<br>Kosten: " + esc(z.kosten) + "<br>Wo: " + esc(z.wo) + "</small>" +
          '<div class="row"><input type="password" autocomplete="off" placeholder="' + (gesetzt[z.id] ? "eingetragen (…" + esc(gesetzt[z.id]) + ")" : "Schlüssel einfügen") + '"><button>Speichern</button></div><div class="st"></div></div>';
        if (z.pflicht) h += k; else opt += k;
      });
      h += "<details><summary>Weitere Zugänge (optional)</summary>" + opt + "</details><div class='st' id='wf'></div>" + knoepfe(true);
    } else if (schritt === 4) h += "<h1>Was darf Atlas?</h1><p>Mikrofon, damit du sprechen kannst. Standort für „in der Nähe“ und das Wetter unterwegs.</p><div class='k'><b>Mikrofon</b><div class='row'><button id='pm'>Erlauben</button></div><div class='st' id='sm'></div></div><div class='k'><b>Standort</b><div class='row'><button id='ps'>Erlauben</button></div><div class='st' id='ss'></div></div><p>Hey Atlas, WhatsApp und Parkplatz schaltest du später über ihre Kacheln auf dem Startbildschirm ein.</p><div class='st' id='wf'></div>" + knoepfe(true);
    else h += "<h1>Fertig</h1><p>Atlas ist eingerichtet. Sag zum Beispiel „Wie wird das Wetter?“ oder tippe auf den Kreis und sprich.</p><div class='st' id='wf'></div>" + knoepfe(false, "Los geht’s");
    box.innerHTML = ST_TAG + h + "</div>"; bind();
  }
  var ST_TAG = "<style>" + ST + "</style>";
  function bind() {
    var z = box.querySelector("#wz"), w = box.querySelector("#ww");
    if (z) z.onclick = function () { schritt--; zeichne(); };
    if (schritt === 3) box.querySelectorAll(".k[data-id]").forEach(function (k) {
      var b = k.querySelector("button"), inp = k.querySelector("input"), st = k.querySelector(".st");
      b.onclick = function () {
        var v = inp.value.trim(); if (!v) { st.className = "st fe"; st.textContent = "Erst den Schlüssel einfügen"; return; }
        st.className = "st"; st.textContent = "Speichere und teste …";
        api("setup", { aktion: "speichern", id: k.getAttribute("data-id"), wert: v }).then(function (r) {
          if (!r.ok) { st.className = "st fe"; st.textContent = r.fehler || "Das hat nicht geklappt"; return; }
          gesetzt[k.getAttribute("data-id")] = r.letzte; zeigeFehler(""); inp.value = ""; inp.placeholder = "eingetragen (…" + r.letzte + ")";
          var t = r.test || {}; st.className = "st " + (t.ok ? "ok" : "fe"); st.textContent = (t.ok ? "✓ " : "Gespeichert, aber: ") + (t.text || (t.ok ? "funktioniert" : "Test ohne Ergebnis"));
        }).catch(function () { st.className = "st fe"; st.textContent = "Keine Verbindung"; });
      };
    });
    if (schritt === 4) {
      box.querySelector("#pm").onclick = function () { var s = box.querySelector("#sm"); if (!navigator.mediaDevices) { s.textContent = "Geht hier nicht"; return; } navigator.mediaDevices.getUserMedia({ audio: true }).then(function (m) { m.getTracks().forEach(function (t) { t.stop(); }); s.className = "st ok"; s.textContent = "✓ erlaubt"; }).catch(function () { s.className = "st fe"; s.textContent = "Nicht erlaubt. Das kannst du in den Handy-Einstellungen ändern."; }); };
      box.querySelector("#ps").onclick = function () { var s = box.querySelector("#ss"); if (!navigator.geolocation) { s.textContent = "Geht hier nicht"; return; } navigator.geolocation.getCurrentPosition(function () { s.className = "st ok"; s.textContent = "✓ erlaubt"; }, function () { s.className = "st fe"; s.textContent = "Nicht erlaubt. Das kannst du in den Handy-Einstellungen ändern."; }, { timeout: 15000 }); };
    }
    w.onclick = weiter;
  }
  function weiter() {
    var w = box.querySelector("#ww");
    if (schritt === 0) { DATEN.name = lies("f1"); DATEN.nachname = lies("f2"); if (!DATEN.name) return zeigeFehler("Wie soll Atlas dich nennen?"); schritt = 1; return zeichne(); }
    if (schritt === 1) {
      DATEN.ort = lies("f1"); DATEN.heim = lies("f2"); if (!DATEN.ort) return zeigeFehler("Der Wohnort fehlt.");
      w.disabled = true; zeigeFehler("");
      return speicherProfil(false).then(function (r) { if (!r.ok) throw new Error(r.fehler || "Speichern ging nicht"); return adresse("heim", DATEN.heim); }).then(function (r) {
        if (!r.ok) { w.disabled = false; return zeigeFehler("Die Adresse habe ich nicht gefunden: " + (r.fehler || "bitte genauer schreiben, oder das Feld leer lassen")); }
        schritt = 2; zeichne();
      }).catch(function (e) { w.disabled = false; zeigeFehler(e.message || "Keine Verbindung"); });
    }
    if (schritt === 2) {
      DATEN.arbeit = lies("f1"); w.disabled = true;
      return speicherProfil(false).then(function () { return adresse("arbeit", DATEN.arbeit); }).then(function (r) {
        if (!r.ok) { w.disabled = false; return zeigeFehler("Die Adresse habe ich nicht gefunden: " + (r.fehler || "bitte genauer schreiben, oder das Feld leer lassen")); }
        schritt = 3; zeichne();
      }).catch(function () { w.disabled = false; zeigeFehler("Keine Verbindung"); });
    }
    if (schritt === 3) {
      if (!gesetzt.groq) { w.disabled = true; return api("setup", { aktion: "status" }).then(function (r) { w.disabled = false; var g = ((r && r.liste) || []).filter(function (x) { return x.id === "groq" && x.gesetzt; })[0]; if (!g) return zeigeFehler("Ohne den Groq-Schlüssel kann Atlas nicht antworten. Bitte trage ihn oben ein."); gesetzt.groq = g.letzte; schritt = 4; zeichne(); }).catch(function () { w.disabled = false; zeigeFehler("Keine Verbindung"); }); }
      schritt = 4; return zeichne();
    }
    if (schritt === 4) { schritt = 5; return zeichne(); }
    w.disabled = true;
    speicherProfil(true).then(function (r) { if (!r.ok) { w.disabled = false; return zeigeFehler(r.fehler || "Speichern ging nicht"); } try { location.hash = ""; } catch (e) { } location.reload(); }).catch(function () { w.disabled = false; zeigeFehler("Keine Verbindung"); });
  }
  function oeffnen() {
    if (box) return;
    box = el('<div id="wiz"></div>'); document.body.appendChild(box);
    api("setup", { aktion: "status" }).then(function (r) { ((r && r.liste) || []).forEach(function (x) { if (x.gesetzt) gesetzt[x.id] = x.letzte; }); }).catch(function () { })
      .then(function () { return api("profil", { aktion: "lesen" }); }).then(function (r) { var p = r && r.profil; if (p) { DATEN.name = p.name || ""; DATEN.nachname = p.nachname || ""; DATEN.ort = p.ort || ""; DATEN.heim = p.heim || ""; DATEN.arbeit = p.arbeit || ""; } }).catch(function () { })
      .then(zeichne);
  }
  window.AtlasWizard = { oeffnen: oeffnen };
  function pruefen() {
    if (/einrichten/.test(location.hash)) return oeffnen();
    api("profil", { aktion: "lesen" }).then(function (r) { if (r && r.ok && r.profil) { window.AtlasProfil = r.profil; if (!r.profil.eingerichtet) oeffnen(); } }).catch(function () { });
  }
  setTimeout(pruefen, 600);
})();
