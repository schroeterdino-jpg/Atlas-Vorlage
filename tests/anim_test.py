import asyncio, json
from playwright.async_api import async_playwright
CASES = {
 "kal_neu": [{"name":"termin_neu","ok":True,"args":{"aktion":"anlegen"},"erg":{"ok":True,"angelegt":{"titel":"Reifenwechsel","beginn":"2026-11-20T14:00","ende":"2026-11-20T15:30","ganztag":False}}}],
 "urlaub": [{"name":"urlaub","ok":True,"args":{"aktion":"eintragen","von":"2026-12-15","bis":"2027-01-09","ohne_wochenende":True,"titel":"Administrationstraining"},"erg":{"ok":True}}],
 "termine": [{"name":"termine","ok":True,"args":{},"erg":{"ok":True,"termine":[{"titel":"A","beginn":"2026-11-16T09:00","ende":"2026-11-16T10:00","ganztag":False},{"titel":"B","beginn":"2026-11-20","ende":"2026-11-23","ganztag":True}]}}],
 "einkauf": [{"name":"einkauf","ok":True,"args":{"aktion":"hinzufuegen"},"erg":{"ok":True,"hinzugefuegt":["Milch","Brot","Eier"]}}],
 "abhaken": [{"name":"einkauf","ok":True,"args":{"aktion":"abhaken"},"erg":{"ok":True,"erledigt":["Brot"]}}],
 "erinnerung": [{"name":"erinnerung","ok":True,"args":{"aktion":"anlegen"},"erg":{"ok":True,"angelegt":{"text":"Zahnarzt anrufen","zeit":"2026-11-16T15:00"}}}],
 "schicht": [{"name":"schicht","ok":True,"args":{"aktion":"abfragen"},"erg":{"ok":True,"zusammenfassung":["Montag, 16.11. bis Freitag, 20.11.: Frühschicht"],"tage":[{"datum":"2026-11-16","wochentag":"Montag","art":"Frühschicht","zeiten":{"abfahrt":"04:30","beginn":"05:10","ende":"14:37"}}]*5+[{"datum":"x","wochentag":"Samstag","art":"frei (Wochenende)"},{"datum":"y","wochentag":"Sonntag","art":"frei (Wochenende)"}]}}],
 "merken": [{"name":"gedaechtnis","ok":True,"args":{"aktion":"merken"},"erg":{"ok":True}}],
 "wetter": [{"name":"wetter","ok":True,"args":{},"erg":{"ok":True,"ort":"Musterstadt","aktuell":{"temperatur":7.4,"wetter":"Regen","wind_kmh":22},"stunden":[{"regen_prozent":80}],"empfehlung":{"schirm":True},"warnungen":[{"titel":"Amtliche WARNUNG vor STURMBÖEN"}]}}],
 "fahrt": [{"name":"verkehr","ok":True,"args":{},"erg":{"ok":True,"fahrzeit_min":25,"normal_min":15,"verzoegerung_min":10,"km":12.3,"live_verkehr":True}}],
 "naehe": [{"name":"in_der_naehe","ok":True,"args":{"art":"Tankstelle"},"erg":{"ok":True,"orte":[{"name":"Nah-Tanke","entfernung":"850 m","offen":True,"schliesst":"22:00"},{"name":"Fern-Tanke","entfernung":"2,4 km","offen":False}]}}],
 "tanken": [{"name":"in_der_naehe","ok":True,"args":{"art":"Tankstelle","auf_dem_weg_nach":"arbeit"},"erg":{"ok":True,"auf_dem_weg":True,"kraftstoff":"diesel","fahrzeit_min":31,"km":12.3,"orte":[{"name":"ARAL","lat":53.5057,"lon":10.4815,"preise":{"diesel":"2,31","e10":"2,40"}}],"karte":{"von":"heim","nach":"arbeit","punkte":[[53.5035,10.48,0],[53.5057,10.4815,0],[53.52,10.5,0],[53.55,10.55,0]]}}}],
 "geburtstag": [{"name":"geburtstag","ok":True,"args":{"aktion":"zeigen"},"erg":{"ok":True,"geburtstage":[{"name":"Finny","datum":"3. März","in_tagen":3,"heute":False,"wird_alt":11},{"name":"Leon","datum":"20. Dezember","in_tagen":34,"heute":False}]}}],
 "feiertage": [{"name":"feiertage","ok":True,"args":{"art":"beides"},"erg":{"ok":True,"eintraege":[{"art":"Feiertag","name":"1. Weihnachtstag","datum":"2026-12-25","in_tagen":39},{"art":"Ferien","name":"Weihnachtsferien","datum":"2026-12-21","bis":"2027-01-06","in_tagen":35}]}}],
 "kontakte": [{"name":"kontakte","ok":True,"args":{"aktion":"zeigen"},"erg":{"ok":True,"anzahl":3,"kontakte":[{"name":"Mama","telefon":"01711234567","adresse":"Hauptstr. 1"},{"name":"Matzi","telefon":"01729998877"},{"name":"Zahnarzt","adresse":"Markt 2"}]}}],
 "foto": [{"name":"foto","ok":True,"args":{},"erg":{"ok":True,"art":"schild_text","beschreibung":"Ein Hinweisschild auf Polnisch","text":"UWAGA\nWej\u015bcie wzbronione","sprache":"pl"}}],
 "kuendigung": [{"name":"kuendigung","ok":True,"args":{},"erg":{"ok":True,"anbieter":"Vodafone","zeitpunkt":"naechstmoeglich","brief":"x","luecken":["Anschrift des Anbieters"]}}],
 "websuche": [{"name":"websuche","ok":True,"args":{"frage":"Wie teuer ist das iPhone 18 Pro?"},"erg":{"ok":True,"frage":"Wie teuer ist das iPhone 18 Pro?","ergebnis":"Laut apple.com kostet das iPhone 18 Pro ab 1.449 € (256 GB). Das Pro Max startet bei 1.599 €."}}],
 "mail": [{"name":"mail","ok":True,"args":{},"erg":{"ok":True,"anzahl":3,"ungelesen_im_posteingang":3,"mails":[{"von":"Telekom Deutschland","betreff":"Ihre Rechnung März","ungelesen":True},{"von":"Sparkasse","betreff":"Kontoauszug"},{"von":"Mama","betreff":"Sonntag Kaffee?","ungelesen":True}]}}],
 "finder": [{"name":"termin_finder","ok":True,"args":{},"erg":{"ok":True,"dauer_minuten":60,"tage":[{"datum":"2026-11-17","tag":"Di","frei":[{"von":"15:10","bis":"20:00","minuten":290}]},{"datum":"2026-11-18","tag":"Mi","frei":[{"von":"08:00","bis":"12:00","minuten":240}]}]}}],
 "briefing": [{"name":"ueberblick","ok":True,"args":{"briefing":True},"erg":{"ok":True,"tag":"heute","schicht":{"art":"Frühschicht","abfahrt":"4:30"},"fahrt":{"art":"arbeit","minuten":30,"normal":18,"stau":"A24 bei Horn, 2 km","empfehlung":"Achtung: früher los"},"termine":[],"wetter":{"jetzt":4,"text":"Regenschauer"},"erinnerungen":[{"text":"Wäsche rausholen","zeit":"10:00"}],"nachricht":"Bahn-Streik legt Verkehr lahm"}}],
 "ueberblick": [{"name":"ueberblick","ok":True,"args":{},"erg":{"ok":True,"tag":"heute","schicht":{"art":"Spätschicht","abfahrt":"12:45"},"termine":[{"titel":"Zahnarzt","zeit":"14:00"}],"wetter":{"schirm":True,"regen_ab":"15:00"},"erinnerungen":[{"text":"Mama anrufen","zeit":"18:00"}],"geburtstage":[{"name":"Finny","in_tagen":2}]}}],
 "notiz": [{"name":"notiz","ok":True,"args":{"aktion":"zeigen"},"erg":{"ok":True,"notizen":[{"titel":"Geschenk","text":"Für Leon ein Lego-Set","angelegt":"2026-11-16T09:50"},{"text":"WLAN-Passwort Gästenetz: blau42","angelegt":"2026-11-15T20:10"}]}}],
 "sonne": [{"name":"sonne_mond","ok":True,"args":{},"erg":{"ok":True,"datum":"2026-11-16","sonne":{"aufgang":"07:44","untergang":"16:23","tageslaenge":"8 Std 39 Min"},"mond":{"phase":"zunehmende Sichel","beleuchtung_prozent":32,"zunehmend":True,"aufgang":"13:05","untergang":"21:17","naechster_vollmond":"Dienstag, 24. November"}}}],
 "karte": [{"name":"verkehr","ok":True,"args":{},"erg":{"ok":True,"fahrzeit_min":31,"normal_min":15,"verzoegerung_min":16,"km":12.3,"live_verkehr":True,"karte":{"von":"heim","nach":"Mama","punkte":[[53.5035, 10.48, 0], [53.505700000000004, 10.4815, 0], [53.5079, 10.485, 0], [53.5101, 10.4905, 0], [53.5123, 10.491999999999999, 0], [53.514500000000005, 10.4955, 1], [53.5167, 10.501000000000001, 1], [53.5189, 10.5025, 1], [53.521100000000004, 10.506, 2], [53.5233, 10.5115, 2], [53.5255, 10.513, 2], [53.5277, 10.5165, 2], [53.529900000000005, 10.522, 1], [53.5321, 10.5235, 1], [53.5343, 10.527, 0], [53.536500000000004, 10.5325, 0], [53.538700000000006, 10.533999999999999, 0], [53.5409, 10.5375, 0], [53.5431, 10.543000000000001, 0], [53.545300000000005, 10.5445, 0]]}}}],
 "nachrichten": [{"name":"nachrichten","ok":True,"args":{"ebene":"region"},"erg":{"ok":True,"heimat":"Musterstadt","ebenen":{"welt":[{"titel":"Gipfel beendet","ort":"Genf, Schweiz","lat":46.2,"lon":6.1}],"deutschland":[],"region":[{"titel":"Sturmflutwarnung aufgehoben","ort":"Husum","lat":54.5,"lon":9.05},{"titel":"Zweite Meldung aus dem Norden","ort":""}],"ort":[]}}}],
 "sonst": [{"name":"uhrzeit","ok":True,"args":{},"erg":{"ok":True}}],
}
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        pg = await b.new_page(viewport={"width":390,"height":800}, device_scale_factor=1)
        errs=[]; pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("console", lambda m: errs.append(m.text) if m.type=="error" else None)
        await pg.goto("file:///home/claude/atlas/index.html"); await pg.wait_for_timeout(500)
        for name,ms in [("kal_neu",4300),("urlaub",5200),("termine",4300),("einkauf",4500),("abhaken",3600),("erinnerung",5000),("schicht",5600),("merken",4300),("wetter",5600),("naehe",4500),("websuche",7800),("nachrichten",5600),("tanken",5600),("sonne",6500),("geburtstag",4500),("feiertage",4500),("ueberblick",5000),("briefing",5500),("finder",4500),("mail",4500),("kuendigung",4500),("foto",4500),("kontakte",4500),("notiz",4500),("karte",5600),("fahrt",4600),("sonst",900)]:
            await pg.evaluate("l=>AtlasAnim.play(l)", CASES[name]); await pg.wait_for_timeout(ms); await pg.screenshot(path=f"/tmp/a_{name}.png")
        # Lange Antwort: Panel darf nicht ueber das Antwortfeld ragen
        await pg.evaluate("document.body.classList.remove('werk-leer');document.body.classList.add('im-gespraech')")
        await pg.evaluate("document.getElementById('werktext').textContent='Der Verkehr zur Mutter ist leicht erhöht. Es gibt einen starken Stau von 1,9 km auf der A 24 bei Horn in Richtung Hamburg und einen zähflüssigen Abschnitt von 0,3 km auf der Sievekingsallee bei Hamm, ebenfalls Richtung Hamburg. Die Fahrzeit beträgt etwa 45 Minuten.'")
        await pg.set_viewport_size({"width":390,"height":640})
        await pg.evaluate("l=>AtlasAnim.play(l)", CASES["karte"]); await pg.wait_for_timeout(3500)
        luecke = await pg.evaluate("document.getElementById('werk').getBoundingClientRect().top - document.getElementById('apanel').getBoundingClientRect().bottom")
        print("Abstand Panel/Antwortfeld:", luecke); assert luecke >= -2, "Panel ragt ins Antwortfeld"
        await pg.evaluate('AtlasAnim.stop()'); await pg.wait_for_timeout(700); await pg.set_viewport_size({"width":390,"height":800})
        # Abbruch
        await pg.evaluate("l=>AtlasAnim.play(l)", CASES["urlaub"]); await pg.wait_for_timeout(500); await pg.evaluate('AtlasAnim.stop()'); await pg.wait_for_timeout(700)
        print("nach Abbruch sichtbar:", await pg.evaluate("document.getElementById('anim').className"))
        await pg.evaluate("localStorage.setItem('atlas_anim','0')"); await pg.evaluate("l=>AtlasAnim.play(l)", CASES["urlaub"]); await pg.wait_for_timeout(300)
        print("aus:", await pg.evaluate("document.getElementById('anim').className"))
        print("fehler:", errs); await b.close()
asyncio.run(main())
