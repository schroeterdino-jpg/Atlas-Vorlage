import json, threading, http.server, socketserver, functools
from playwright.sync_api import sync_playwright
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*a): pass
socketserver.TCPServer.allow_reuse_address=True
srv=socketserver.TCPServer(("127.0.0.1",8766),functools.partial(Q,directory=__import__("os").path.dirname(__import__("os").path.dirname(__import__("os").path.abspath(__file__)))));threading.Thread(target=srv.serve_forever,daemon=True).start()
aufrufe=[]
with sync_playwright() as p:
    b=p.chromium.launch(executable_path="/usr/bin/google-chrome",args=["--no-sandbox"]);pg=b.new_page(viewport={"width":390,"height":800})
    errs=[];pg.on("pageerror",lambda e:errs.append(str(e)))
    def route(r):
        n=r.request.url.split("/api/")[-1]; d=json.loads(r.request.post_data or "{}"); aufrufe.append((n,d.get("aktion"),d.get("fertig")))
        if n=="profil": body={"ok":True,"profil":{"name":"","eingerichtet":False}}
        elif n=="setup" and d.get("aktion")=="status": body={"ok":True,"liste":[{"id":"groq","gesetzt":False}]}
        elif n=="setup" and d.get("aktion")=="speichern": body={"ok":True,"letzte":"abcd","test":{"ok":True,"text":"Schlüssel funktioniert"}}
        else: body={"ok":True}
        r.fulfill(status=200,content_type="application/json",body=json.dumps(body))
    pg.route("**/api/*",route)
    pg.goto("http://127.0.0.1:8766/index.html");pg.wait_for_selector("#wiz h1",timeout=5000)
    assert "Willkommen" in pg.inner_text("#wiz h1")
    pg.click("#ww");assert "Wie soll" in pg.inner_text("#wf"),"Name Pflicht"
    pg.fill("#f1","Anna");pg.click("#ww");pg.wait_for_selector("text=Wo wohnst du")
    pg.fill("#f1","Kiel");pg.fill("#f2","Hafenstraße 1, 24103 Kiel");pg.click("#ww");pg.wait_for_selector("text=Fährst du")
    pg.click("#ww");pg.wait_for_selector("text=Zugänge")
    pg.click("#ww");pg.wait_for_selector("#wf:has-text(\"Groq\")",timeout=3000)
    pg.fill(".k[data-id=groq] input","gsk_testtesttest");pg.click(".k[data-id=groq] button");pg.wait_for_selector("text=Schlüssel funktioniert")
    pg.screenshot(path="/tmp/wiz_zugaenge.png",full_page=False)
    pg.click("#ww");pg.wait_for_selector("text=Was darf Atlas");pg.click("#ww");pg.wait_for_selector("text=Los geht")
    assert ("setup","adresseSetzen",None) in aufrufe and ("profil","speichern",False) in aufrufe
    assert errs==[],errs
    print("wizard: alle Pruefungen gruen")
