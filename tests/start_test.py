import json, threading, http.server, socketserver, functools, sys
from playwright.sync_api import sync_playwright
H=functools.partial(http.server.SimpleHTTPRequestHandler,directory="/home/claude/atlas")
class Q(H.func):
    def log_message(self,*a): pass
socketserver.TCPServer.allow_reuse_address=True
srv=socketserver.TCPServer(("127.0.0.1",8765),functools.partial(Q,directory="/home/claude/atlas"));threading.Thread(target=srv.serve_forever,daemon=True).start()
START={"ok":True,"einkauf":{"offen":2,"eintraege":[{"id":"a1","text":"Milch","erledigt":False},{"id":"a2","text":"Brot","erledigt":False},{"id":"a3","text":"Eier","erledigt":True}],"erledigt":1,"mehr":0},"mitnehmen":{"offen":0,"eintraege":[],"mehr":0},"termine":{"anzahl":2,"zeilen":["14:00 Zahnarzt","19:30 Elternabend"]},"wetter":{"temperatur":6,"text":"bewölkt","schirm":True,"regen_ab":"15:00","warnung":False},"sprit":{"diesel":{"preis":"2,220"},"e10":{"preis":"2,050"},"e5":{"preis":"2,150"}},"tanken":{"name":"AVIA","entfernung":"2,3 km","preis":"2,220"},"notizen":{"anzahl":3,"zeilen":["Geschenk","WLAN"]}}
gesendet=[];listenaktionen=[];startaufrufe=[0];fotos=[];fotodaten=[]
with sync_playwright() as p:
    b=p.chromium.launch(executable_path="/usr/bin/google-chrome",args=["--no-sandbox"]);pg=b.new_page(viewport={"width":390,"height":800},device_scale_factor=2)
    errs=[];pg.on("pageerror",lambda e:errs.append(str(e)))
    def route(r):
        n=r.request.url.split("/api/")[-1]
        if n=="start" and "aktion" in (r.request.post_data or ""):
            a=json.loads(r.request.post_data);listenaktionen.append(a)
            e=[{"id":"a1","text":"Milch","erledigt":a.get("erledigt",False)},{"id":"a2","text":"Brot","erledigt":False},{"id":"a3","text":"Eier","erledigt":True},{"id":"n9","text":a.get("text","Kaffee"),"erledigt":False}]
            if a["aktion"]=="aufraeumen": e=[x for x in e if not x["erledigt"]]
            r.fulfill(status=200,content_type="application/json",body=json.dumps({"ok":True,"daten":{"offen":sum(1 for x in e if not x["erledigt"]),"eintraege":e,"erledigt":sum(1 for x in e if x["erledigt"]),"mehr":0}}))
        elif n=="start": startaufrufe[0]+=1; r.fulfill(status=200,content_type="application/json",body=json.dumps(START))
        elif n=="denken":
            gesendet.append(json.loads(r.request.post_data)["text"])
            if "Kündigung" in gesendet[-1]: r.fulfill(status=200,content_type="application/json",body=json.dumps({"ok":True,"antwort":"Der Brief liegt offen.","sprache":"de","werkzeuge":[{"name":"kuendigung","ok":True,"erg":{"ok":True,"anbieter":"Vodafone","zeitpunkt":"naechstmoeglich","brief":"Sam Mustermann\nMusterweg 13\n12345 Musterstadt\n\nVodafone\n[Anschrift des Anbieters bitte ergänzen]\n\nKündigung\n\nSehr geehrte Damen und Herren,\n\nhiermit kündige ich den Vertrag.\n\nMit freundlichen Grüßen\nSam Mustermann","luecken":["Anschrift des Anbieters"]}}]}));return
            r.fulfill(status=200,content_type="application/json",body=json.dumps({"ok":True,"antwort":"Heute hast du zwei Termine.","sprache":"de","werkzeuge":[]}))
        elif n=="foto": fotos.append(json.loads(r.request.post_data)["bild"]);fotodaten.append(json.loads(r.request.post_data)); r.fulfill(status=200,content_type="application/json",body=json.dumps({"ok":True,"art":"schild_text","beschreibung":"Schild"}))
        elif n=="sprechen": r.fulfill(status=500,body="x")
        else: r.fulfill(status=200,content_type="application/json",body="{}")
    FAKE="window.pdfjsLib={GlobalWorkerOptions:{},getDocument:function(){return {promise:Promise.resolve({numPages:2,getPage:function(n){return Promise.resolve({getTextContent:function(){return Promise.resolve({items:[{str:'Kundennummer 4711 Seite '+n,hasEOL:true}]})},getViewport:function(o){return {width:100*o.scale,height:140*o.scale}},render:function(){return {promise:Promise.resolve()}}})}})}}};"
    pg.route("https://cdn.jsdelivr.net/**",lambda r:r.fulfill(status=200,content_type="application/javascript",body=FAKE))
    pg.route("**/api/*",route)
    pg.goto("http://127.0.0.1:8765/index.html");pg.wait_for_timeout(2500)
    pg.screenshot(path="/tmp/atlas_start_idle.png")
    txt=pg.inner_text("#k-termine")+pg.inner_text("#k-tanken")
    assert "2 Termine" in txt and "2,220" in txt and "AVIA" in txt and "3 Notizen" in pg.inner_text("#k-notizen"), txt
    # Antwort wird in Stuecke geteilt: erstes kurz (Stimme startet frueher), Zahlen wie 1.449 bleiben heil
    st=pg.evaluate("()=>window.__stuecke('Das iPhone kostet ab 1.449 Euro. Das Pro Max startet bei 1.599 Euro, das ist deutlich mehr als beim Vorgänger. Ich würde vorher vergleichen, zum Beispiel z. B. bei Idealo und beim Händler um die Ecke, weil sich die Preise oft ändern und es Rabatte gibt, die man nur im Laden bekommt.')")
    assert st[0]=="Das iPhone kostet ab 1.449 Euro." and len(st)>=2 and " ".join(st).count("1.449")==1,st
    assert pg.evaluate("()=>window.__stuecke('Alles klar.')")==["Alles klar."]
    assert pg.evaluate("()=>window.__stuecke('')")==[""]
    # langer Satz mit Aufzaehlung: Stuecke werden groesser, nichts geht verloren, "1." ist kein Satzende
    T="Morgen, am Dienstag, hat Iris laut Stundenplan: 1. Förder-D von 7:30 bis 8:15, 2. Mathe von 8:25 bis 9:05, 3. Lesezeit von 9:30 bis 10:10, 4. Deutsch von 10:30 bis 11:10, 5. Kunst von 11:25 bis 12:05 und 6. Kunst von 12:15 bis 12:55."
    st=pg.evaluate("(t)=>window.__stuecke(t)",T)
    assert st[0]=="Morgen, am Dienstag," and 3<=len(st)<=4 and " ".join(st)==T and len(st[0])<len(st[1])<len(st[2]),st
    # Einkaufs-Kachel: klein auf der Startseite, Antippen oeffnet Vollbild (Abhaken, Hinzufuegen, Abgehakte entfernen)
    assert "2 OFFEN" in pg.inner_text("#k-einkauf").upper(), pg.inner_text("#k-einkauf")
    assert pg.is_hidden("#k-mitnehmen"), "Mitnehmen ohne Eintraege bleibt unsichtbar"
    assert pg.is_hidden("#listebox"), "Vollbild ist zu"
    pg.click("#k-einkauf");pg.wait_for_timeout(400)
    assert pg.is_visible("#listebox") and gesendet==[],("Kachel oeffnet Vollbild und fragt Atlas nicht",gesendet)
    assert pg.locator("#lliste .ek").count()==3 and "2 offen" in pg.inner_text("#lzahl"), pg.inner_text("#listebox")
    pg.click("#lliste .ek >> nth=0");pg.wait_for_timeout(600)
    assert listenaktionen[-1]=={"aktion":"umschalten","liste":"einkauf","id":"a1","erledigt":True},listenaktionen
    pg.fill("#lneu","Kaffee");pg.press("#lneu","Enter");pg.wait_for_timeout(600)
    assert listenaktionen[-1]["aktion"]=="hinzu" and listenaktionen[-1]["text"]=="Kaffee",listenaktionen
    assert "Kaffee" in pg.inner_text("#lliste"),pg.inner_text("#lliste")
    assert "(1)" in pg.inner_text("#lraus"),pg.inner_text("#lraus")
    pg.screenshot(path="/tmp/atlas_einkauf_echt.png")
    pg.click("#lraus");pg.wait_for_timeout(600)
    assert listenaktionen[-1]=={"aktion":"aufraeumen","liste":"einkauf"},listenaktionen
    pg.click("#lzu");pg.wait_for_timeout(400)
    assert pg.is_hidden("#listebox") and "Kaffee" in pg.inner_text("#k-einkauf"),pg.inner_text("#k-einkauf")
    # Nichts ueberlappt, auch auf kurzem Bildschirm (Browser mit Adressleiste)
    for hoehe in (655,800,560):
        pg.set_viewport_size({"width":390,"height":hoehe});pg.wait_for_timeout(900)
        r=pg.evaluate("""()=>{const b=e=>document.querySelector(e).getBoundingClientRect();const s=b('#start'),f=b('#eingabe'),k=b('#kopf');return {startUnten:s.bottom,eingabeOben:f.top,startOben:s.top,kopfUnten:k.bottom}}""")
        assert r["startUnten"]<=r["eingabeOben"]+0.5,("Kacheln ueberlappen Eingabe",hoehe,r)
        assert r["startOben"]>=r["kopfUnten"]+60,("Kacheln zu weit oben",hoehe,r)
        pg.screenshot(path=f"/tmp/atlas_start_{hoehe}.png")
    pg.set_viewport_size({"width":390,"height":800});pg.wait_for_timeout(700)
    # Kachel antippen
    pg.click("#k-termine");pg.wait_for_timeout(1500)
    assert gesendet==["Welche Termine habe ich heute?"],gesendet
    assert pg.evaluate("document.body.classList.contains('im-gespraech')"),"Kacheln ausgeblendet im Gespraech"
    pg.screenshot(path="/tmp/atlas_start_antwort.png")
    # Tippen
    pg.click("#werk");pg.wait_for_timeout(400)
    assert not pg.evaluate("document.body.classList.contains('im-gespraech')"),"Antippen der Antwort bringt Startbild zurueck"
    # Nach einer Antwort werden die Kacheln beim Zurueck neu geladen (z. B. Notiz geloescht)
    pg.wait_for_timeout(4500)
    assert startaufrufe[0]>=2,("Kacheln laden nach der Antwort neu",startaufrufe)
    pg.fill("#eintext","Wann geht die Sonne unter");pg.press("#eintext","Enter");pg.wait_for_timeout(1500)
    assert gesendet[-1]=="Wann geht die Sonne unter",gesendet
    assert pg.input_value("#eintext")=="","Feld geleert"
    # Foto-Knopf: Bild wird verkleinert hochgeladen, danach fragt Atlas von selbst
    import base64
    png=base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==")
    assert pg.is_visible("#fotoknopf"),"Foto-Knopf sichtbar"
    assert not pg.is_visible("#fotowahl"),"Auswahl zu"
    pg.evaluate("window.AtlasAnim&&AtlasAnim.stop&&AtlasAnim.stop()");pg.click("#werk");pg.wait_for_timeout(500)
    pg.click("#fotoknopf");pg.wait_for_timeout(300)
    assert pg.is_visible("#fw-kamera") and pg.is_visible("#fw-galerie"),"zwei Moeglichkeiten"
    pg.screenshot(path="/tmp/atlas_foto_wahl.png")
    r=pg.evaluate("""()=>{const b=e=>document.querySelector(e).getBoundingClientRect();const w=b('#fotowahl'),k=b('#fw-kamera'),g=b('#fw-galerie'),f=b('#eingabe');return {wbreit:w.width,kh:k.height,kbr:getComputedStyle(document.querySelector('#fw-kamera')).borderRadius,unten:w.bottom,fo:f.top,ueber:k.bottom>g.top+1}}""")
    assert r["wbreit"]>150 and r["kh"]<60 and r["kbr"]!="50%" and r["unten"]<=r["fo"]+1 and not r["ueber"],("Auswahl sieht kaputt aus",r)
    pg.click("#h1,#kopf") if False else pg.mouse.click(200,100);pg.wait_for_timeout(300)
    assert not pg.is_visible("#fotowahl"),"Tippen daneben schliesst"
    assert pg.get_attribute("#fotokamera","capture")=="environment" and pg.get_attribute("#fotodatei","capture") is None,"Kamera-Eingang mit capture, Galerie ohne"
    pg.set_input_files("#fotodatei",{"name":"s.png","mimeType":"image/png","buffer":png});pg.wait_for_timeout(2500)
    assert len(fotos)==1 and fotos[0].startswith("data:image/jpeg;base64,"),("Foto hochgeladen",len(fotos))
    assert gesendet[-1]=="Ich habe ein Foto gemacht.",gesendet
    pg.set_input_files("#fotokamera",{"name":"k.png","mimeType":"image/png","buffer":png});pg.wait_for_timeout(2500)
    assert len(fotos)==2,("Kamera-Foto hochgeladen",len(fotos))
    # PDF aus den Dateien: erste Seite als Bild, Text der Seiten mitgeschickt
    n0=len(fotos)
    pg.set_input_files("#fotodatei",{"name":"abrechnung.pdf","mimeType":"application/pdf","buffer":b"%PDF-1.4 test"});pg.wait_for_timeout(3000)
    assert len(fotos)==n0+1 and "Kundennummer 4711 Seite 1" in fotodaten[-1].get("text","") and "Seite 2" in fotodaten[-1]["text"] and fotodaten[-1]["bild"].startswith("data:image/jpeg"),("PDF hochgeladen",fotodaten[-1].get("text"))
    assert "pdf" in pg.get_attribute("#fotodatei","accept"),"PDF im Dateiauswahl-Filter"
    # Kuendigung: Brief oeffnet sich, ist aenderbar, hat Kopieren und PDF
    pg.fill("#eintext","Schreib mir eine Kündigung für Vodafone");pg.press("#eintext","Enter");pg.wait_for_timeout(2500)
    assert pg.evaluate("document.getElementById('briefbox').className")=="offen","Brief offen"
    assert "Vodafone" in pg.input_value("#brieftext") and pg.is_visible("#b-kopieren") and pg.is_visible("#b-pdf") and pg.is_visible("#b-zu")
    pg.fill("#brieftext",pg.input_value("#brieftext")+"\nZusatz");pg.screenshot(path="/tmp/atlas_brief.png")
    pg.click("#b-zu");pg.wait_for_timeout(300);assert pg.evaluate("document.getElementById('briefbox').className")=="","Brief zu"
    assert not errs,errs
    print("start_test ok");b.close()
