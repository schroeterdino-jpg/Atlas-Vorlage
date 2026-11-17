import json, threading, http.server, socketserver, functools
from playwright.sync_api import sync_playwright
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*a): pass
socketserver.TCPServer.allow_reuse_address=True
srv=socketserver.TCPServer(("127.0.0.1",8767),functools.partial(Q,directory=__import__("os").path.dirname(__import__("os").path.dirname(__import__("os").path.abspath(__file__)))));threading.Thread(target=srv.serve_forever,daemon=True).start()
def lauf(code,tag):
    with sync_playwright() as p:
        b=p.chromium.launch(executable_path="/usr/bin/google-chrome",args=["--no-sandbox"]);pg=b.new_page(viewport={"width":390,"height":800})
        errs=[];pg.on("pageerror",lambda e:errs.append(str(e)));geoeffnet=[]
        pg.expose_function("meldeOeffnen",lambda u:geoeffnet.append(u))
        pg.add_init_script("window.AtlasApp={version:function(){return JSON.stringify({code:%d,repo:'o/Atlas'})},oeffnen:function(u){meldeOeffnen(u)}};"%code)
        def route(r):
            n=r.request.url.split("/api/")[-1]
            if n=="update": body={"ok":True,"neu":tag!="atlas-%d"%code,"nummer":int(tag.split("-")[1]),"url":"https://github.com/o/Atlas/releases/download/%s/Atlas.apk"%tag}
            else: body={"ok":True,"profil":{"eingerichtet":True}}
            r.fulfill(status=200,content_type="application/json",body=json.dumps(body))
        pg.route("**/api/*",route)
        pg.goto("http://127.0.0.1:8767/index.html");pg.wait_for_timeout(1500)
        sichtbar=pg.is_visible("#upd")
        if sichtbar: pg.click("#updgo")
        assert errs==[],errs
        b.close();return sichtbar,geoeffnet
s,g=lauf(53,"atlas-54");assert s and g==["https://github.com/o/Atlas/releases/download/atlas-54/Atlas.apk"],(s,g)
s,g=lauf(54,"atlas-54");assert not s,"gleiche Version: keine Meldung"
print("update: alle Pruefungen gruen")
