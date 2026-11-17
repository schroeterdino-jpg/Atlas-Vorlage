/* Atlas: Funktions-Animationen. Wenn Atlas ein Werkzeug benutzt hat, zeigt diese Datei dazu ein 3D-Fenster mit den echten Daten.
   Aufruf: AtlasAnim.play(werkzeuge) mit der Liste aus der Antwort von /api/denken. AtlasAnim.stop() bricht ab. Aus: localStorage atlas_anim = "0". */
(function () {
  "use strict";
  var S = window.devicePixelRatio || 1, tok = 0, root = null, cv, x, W, H, laeuft = false;
  var strahl = [], ringe = [], funk = [], orb = { x: .5, y: 0, k: 0 }, regen = [], regenAn = 0, regenSchnee = false;
  for (var ri = 0; ri < 200; ri++) regen.push({ x: Math.random(), y: Math.random(), v: .012 + Math.random() * .02, l: .02 + Math.random() * .03 });
  var MON = ["JAN", "FEB", "MÄR", "APR", "MAI", "JUN", "JUL", "AUG", "SEP", "OKT", "NOV", "DEZ"];

  function an() { try { return localStorage.getItem("atlas_anim") !== "0"; } catch (e) { return true; } }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function utc(iso) { var p = String(iso).slice(0, 10).split("-"); return Date.UTC(+p[0], +p[1] - 1, +p[2]); }
  function iso(t) { return new Date(t).toISOString().slice(0, 10); }
  function wt(t) { return (new Date(t).getUTCDay() + 6) % 7; }

  var CSS = "#kopf,#fuss{z-index:4}#anim{position:fixed;inset:0;z-index:3;pointer-events:none;opacity:0;transition:opacity .5s;background:radial-gradient(ellipse at 50% 35%,rgba(3,6,16,.93),rgba(3,6,16,.97))}#anim.an{opacity:1}" +
    "#anim canvas{position:absolute;inset:0;width:100%;height:100%}" +
    "#acam{position:absolute;top:calc(env(safe-area-inset-top) + 150px);left:50%;width:min(350px,calc(100vw - 28px));margin-left:calc(min(350px,calc(100vw - 28px)) / -2);perspective:1100px}" +
    "#apanel{position:relative;min-height:300px;transform:rotateX(70deg) rotateY(-25deg) translateZ(-300px) scale(.4);opacity:0;border-radius:16px;padding:16px 14px;background:linear-gradient(160deg,rgba(10,50,74,.55),rgba(3,12,22,.88));border:1px solid rgba(34,195,234,.8);box-shadow:0 0 40px rgba(34,195,234,.45),inset 0 0 40px rgba(34,195,234,.15);transition:transform 1.5s cubic-bezier(.16,.9,.2,1),opacity 1s,box-shadow .6s,border-color .6s}" +
    "#apanel.an{transform:rotateX(12deg);opacity:1;animation:afl 6s ease-in-out infinite 1.5s}#apanel.fertig{border-color:#7dffb0;box-shadow:0 0 70px rgba(125,255,176,.5),inset 0 0 50px rgba(125,255,176,.18)}#apanel.weg{border-color:#ff6a5a;box-shadow:0 0 60px rgba(255,106,90,.5)}" +
    "@keyframes afl{50%{transform:rotateX(8deg) rotateY(3deg) translateY(-6px)}}" +
    ".abr{position:absolute;width:18px;height:18px;border:2px solid #ffab3d;filter:drop-shadow(0 0 6px #ffab3d)}.abr.a{left:-4px;top:-4px;border-right:0;border-bottom:0}.abr.b{right:-4px;top:-4px;border-left:0;border-bottom:0}.abr.c{left:-4px;bottom:-4px;border-right:0;border-top:0}.abr.d{right:-4px;bottom:-4px;border-left:0;border-top:0}" +
    ".akopf{display:flex;justify-content:space-between;gap:8px;font-size:10px;white-space:nowrap;letter-spacing:.18em;color:#22c3ea;margin-bottom:12px;text-shadow:0 0 8px #22c3ea}.akopf b{color:#ffab3d;text-shadow:0 0 8px #ffab3d;overflow:hidden;text-overflow:ellipsis}" +
    ".agrid{display:grid;grid-template-columns:repeat(7,1fr);gap:5px}.awt{font-size:10px;text-align:center;color:#6fb8d0;letter-spacing:.1em}" +
    ".ad{position:relative;aspect-ratio:1;border:1px solid rgba(34,195,234,.3);border-radius:6px;padding:3px 4px;font-size:10px;color:#8ccbe0;opacity:0;transform:translateZ(-60px) scale(.5);transition:opacity .4s,transform .5s cubic-bezier(.2,1.4,.4,1),background .15s,border-color .3s,box-shadow .6s,color .3s}.ad.on{opacity:1;transform:none}.ad.we{opacity:.4}" +
    ".ad.blitz{background:#fff;box-shadow:0 0 28px #fff;color:#000;transform:translateZ(30px) scale(1.12)}.ad.hit{background:rgba(255,171,61,.3);border-color:#ffab3d;box-shadow:0 0 18px rgba(255,171,61,.8);color:#fff;transform:none}" +
    ".ad.hit:after{content:'';position:absolute;left:3px;right:3px;bottom:4px;height:3px;border-radius:2px;background:#ffab3d;box-shadow:0 0 8px #ffab3d}.ad.lese{background:rgba(34,195,234,.28);border-color:#22c3ea;box-shadow:0 0 16px rgba(34,195,234,.7);color:#fff}" +
    ".ad.gruen{background:rgba(125,255,176,.22);border-color:#7dffb0;box-shadow:0 0 18px rgba(125,255,176,.7)}.ad.gruen:after{background:#7dffb0;box-shadow:0 0 8px #7dffb0}.ad.rot{background:rgba(255,106,90,.25);border-color:#ff6a5a;box-shadow:0 0 18px rgba(255,106,90,.7);color:#fff}" +
    "#nvoll{position:fixed;inset:0;z-index:30;background:#030610;opacity:0;transition:opacity .6s;overflow:hidden;color:#e6fcff;font-family:inherit}#nvoll.an{opacity:1}#nmap{position:absolute;inset:0}#nmap .maplibregl-canvas{filter:sepia(1) hue-rotate(160deg) saturate(2.4) brightness(1.3) contrast(1.05)}#nmap .maplibregl-ctrl-attrib{font-size:9px;opacity:.5;margin-bottom:96px}#nmap .maplibregl-ctrl-attrib a{color:#8ccbe0}" +
    "#nvoll:before{content:'';position:absolute;inset:0;z-index:2;pointer-events:none;background:linear-gradient(180deg,rgba(3,6,16,.85) 0,rgba(3,6,16,0) 22%,rgba(3,6,16,0) 55%,rgba(3,6,16,.92) 100%)}" +
    "#nkopf{position:absolute;z-index:3;left:18px;right:64px;top:calc(env(safe-area-inset-top) + 16px);display:flex;justify-content:space-between;font-size:12px;letter-spacing:.2em;color:#22c3ea;text-shadow:0 0 10px #22c3ea}#nkopf b{color:#ffab3d}#nx{position:absolute;z-index:4;right:14px;top:calc(env(safe-area-inset-top) + 8px);width:44px;height:44px;border:0;background:none;color:#8ccbe0;font-size:24px}" +
    "#ncard{position:absolute;z-index:3;left:14px;right:14px;bottom:calc(env(safe-area-inset-bottom) + 28px);border:1.5px solid rgba(34,195,234,.7);border-radius:16px;overflow:hidden;background:rgba(6,22,36,.9);box-shadow:0 0 30px rgba(34,195,234,.35);transform:translateY(40px);opacity:0;transition:transform .6s cubic-bezier(.16,.9,.2,1),opacity .5s}#ncard.an{transform:none;opacity:1}#ncard img{display:block;width:100%;height:170px;object-fit:cover;background:#0b2a3a}#ncard img.weg{display:none}#ncard .nt{padding:12px 14px 14px}#ncard small{display:block;color:#ffab3d;font-size:11px;letter-spacing:.18em;margin-bottom:6px}#ncard p{margin:0;font-size:18px;line-height:1.3;font-weight:600;color:#fff}#ncard .nk{margin-top:8px;max-height:30vh;overflow:auto;font-size:14px;line-height:1.4;color:#bfe9f5}#ncard.halt{border-color:#ffab3d;box-shadow:0 0 30px rgba(255,171,61,.45)}#nhint{position:absolute;z-index:3;left:0;right:0;bottom:calc(env(safe-area-inset-bottom) + 3px);text-align:center;font-size:9px;letter-spacing:.2em;color:#5fa8c0}#nlade{position:absolute;z-index:3;left:0;right:0;top:44%;text-align:center;font-size:13px;letter-spacing:.28em;color:#22c3ea;text-shadow:0 0 12px #22c3ea}" +
    "#nbar{position:absolute;z-index:3;left:14px;right:14px;bottom:calc(env(safe-area-inset-bottom) + 14px);height:5px;border-radius:3px;background:#0b2a3a;overflow:hidden}#nbar u{display:block;height:100%;width:0;background:linear-gradient(90deg,#22c3ea,#ffab3d);box-shadow:0 0 10px #22c3ea;transition:width .8s}" +
    ".nmk{width:16px;height:16px;border-radius:50%;background:#ffab3d;box-shadow:0 0 14px #ffab3d;position:relative}.nmk:after{content:'';position:absolute;inset:-9px;border-radius:50%;border:2px solid #ffab3d;animation:nping 1.6s ease-out infinite}@keyframes nping{from{transform:scale(.4);opacity:1}to{transform:scale(1.8);opacity:0}}" +
    ".wglobe{width:62%;margin:0 auto;display:block;filter:drop-shadow(0 0 14px rgba(34,195,234,.5))}.wq{text-align:center;font-size:16px;margin:6px 0 10px;color:#fff}.wbar{height:6px;border-radius:3px;background:#0b2a3a;overflow:hidden}.wbar u{display:block;height:100%;width:6%;background:linear-gradient(90deg,#22c3ea,#ffab3d);box-shadow:0 0 10px #22c3ea;transition:width .7s ease}.wbar.ok u{background:#7dffb0;box-shadow:0 0 12px #7dffb0}.wst{display:block;text-align:center;margin-top:9px;font-size:10px;letter-spacing:.2em;color:#6aa9bd}.wres{opacity:0;transform:translateY(8px);transition:opacity .6s,transform .6s;margin-top:12px;padding:10px 12px;border:1px solid rgba(125,255,176,.5);border-radius:10px;background:rgba(125,255,176,.08);font-size:16px;line-height:1.35;color:#eafff3;max-height:150px;overflow:hidden}.wres.on{opacity:1;transform:none}" +
    "#anim.sonne{background:linear-gradient(#030610 0%,#0a1630 36%,#3a1d4e 60%,#c4552f 84%,#ff9a4a 100%)!important}#anim.sonne:before{content:'';position:absolute;left:50%;top:calc(env(safe-area-inset-top) - 80px);width:440px;height:440px;margin-left:-220px;border-radius:50%;background:radial-gradient(circle,rgba(255,215,130,.95) 0 20%,rgba(255,150,60,.55) 38%,transparent 70%);opacity:0;transform:translateY(260px) scale(.6);animation:aso 3.4s cubic-bezier(.2,.8,.2,1) forwards}@keyframes aso{to{opacity:1;transform:none}}#anim.sonne:after{content:'';position:absolute;left:0;right:0;bottom:0;height:90px;background:#030610;border-top:2px solid #ff9a4a;box-shadow:0 -10px 40px #ff7a3c}#anim.sonne #apanel{min-height:0}" +
    ".arow{display:flex;align-items:center;gap:12px;padding:11px 12px;margin-bottom:8px;border:1px solid rgba(34,195,234,.35);border-radius:10px;font-size:17px;opacity:0;transform:translateX(-30px) translateZ(-40px);transition:all .45s cubic-bezier(.2,1.3,.4,1)}.arow.on{opacity:1;transform:none}" +
    ".arow.kp{padding:8px 12px;margin-bottom:6px;font-size:16px}.arow.kp span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.arow.kp em{flex:none;padding-left:8px}" +
    ".arow .bx{flex:none;width:20px;height:20px;border:2px solid #22c3ea;border-radius:5px;display:grid;place-items:center;font-size:14px;color:transparent}.arow em{margin-left:auto;font-style:normal;color:#ffab3d;font-size:13px}.arow.blitz{background:#fff;color:#000;box-shadow:0 0 30px #fff}" +
    ".arow.done{border-color:#7dffb0;background:rgba(125,255,176,.12);box-shadow:0 0 18px rgba(125,255,176,.5)}.arow.done .bx{background:#7dffb0;border-color:#7dffb0;color:#001}.arow.done span{text-decoration:line-through;color:#8ccbe0}" +
    ".atage{display:grid;grid-template-columns:repeat(7,1fr);gap:6px;margin-bottom:16px}.atag{height:92px;border-radius:8px;border:1px solid rgba(34,195,234,.3);display:flex;flex-direction:column;justify-content:flex-end;align-items:center;padding:4px 0;font-size:10px;color:#8ccbe0;position:relative;overflow:hidden}" +
    ".atag i{position:absolute;left:0;right:0;bottom:0;height:0;background:linear-gradient(0deg,#1b8fd0,#22c3ea);box-shadow:0 0 20px #22c3ea;transition:height .7s cubic-bezier(.2,1,.3,1)}.atag.frueh i{background:linear-gradient(0deg,#d98a1f,#ffab3d);box-shadow:0 0 20px #ffab3d}.atag.sonst i{background:linear-gradient(0deg,#2fb57a,#7dffb0);box-shadow:0 0 20px #7dffb0}.atag.on i{height:78%}.atag span{position:relative;z-index:2;font-weight:700;color:#fff}.atag.frei{opacity:.45}" +
    ".azeit{display:flex;justify-content:space-between;font-size:12px;color:#8ccbe0;letter-spacing:.1em}.azeit b{display:block;font-size:20px;color:#fff;letter-spacing:0}.alinie{height:4px;border-radius:2px;background:linear-gradient(90deg,#ffab3d,#22c3ea);width:0;transition:width 1.6s cubic-bezier(.3,.8,.3,1);box-shadow:0 0 14px #22c3ea;margin-top:10px}" +
    ".awx{text-align:center;padding-top:4px}.atemp{font-size:78px;font-weight:200;line-height:1;text-shadow:0 0 30px #22c3ea}.awolke{position:relative;height:90px;margin:0 auto 4px;width:200px;opacity:0;transform:translateY(-30px);transition:all 1s}.awolke.on{opacity:1;transform:none;animation:awsch 5s ease-in-out infinite}@keyframes awsch{50%{transform:translateX(10px)}}.awolke b{position:absolute;border-radius:50%;background:radial-gradient(circle at 35% 30%,#bfe9ff,#4f8fb0 70%);filter:blur(1px);box-shadow:0 0 30px rgba(34,195,234,.5)}.awolke b.sonne{background:radial-gradient(circle,#fff6c8,#ffab3d 60%,transparent 72%);box-shadow:0 0 60px rgba(255,171,61,.8);filter:none}.awd{font-size:13px;color:#8ccbe0;margin-top:10px;letter-spacing:.08em}.awdd{font-size:14px;margin-top:6px;color:#ffab3d}.awarn{margin-top:10px;padding:8px 10px;border:1px solid #ff6a5a;border-radius:8px;color:#ffb1a8;font-size:13px;box-shadow:0 0 18px rgba(255,106,90,.5)}.auhr{display:block;margin:6px auto 0}.aunt{text-align:center;font-size:19px;margin-top:6px;min-height:26px}.anetz{display:block;margin:0 auto}" +
    ".asl{opacity:0;transition:opacity .7s}.asl.on{opacity:1}.amo{display:flex;align-items:center;gap:16px;margin-top:6px;border-top:1px solid rgba(34,195,234,.3);padding-top:12px;opacity:0;transform:translateY(12px);transition:opacity .8s,transform .8s}.amo.on{opacity:1;transform:none}.amo b{display:block;font-size:17px;font-weight:500}.amo small{display:block;font-size:12px;color:#8ccbe0;margin-top:4px}.amo small.v{color:#ffab3d}" +
    "#anim canvas.akarte{position:relative;inset:auto;width:310px;height:190px;display:block;margin:0 auto 6px;border-radius:12px;border:1px solid rgba(34,195,234,.4);box-shadow:0 0 26px rgba(34,195,234,.28)}";

  var BCSS = "#bvoll{position:fixed;inset:0;z-index:30;background:radial-gradient(120% 70% at 50% -10%,#0d3a5a 0,#050c1c 55%,#02050d 100%);opacity:0;transition:opacity .5s;color:#e6fcff;font-family:inherit;display:flex;flex-direction:column;padding:calc(env(safe-area-inset-top) + 14px) 12px calc(env(safe-area-inset-bottom) + 12px);overflow:hidden}#bvoll.an{opacity:1}" +
    "#bvoll:before{content:'';position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(0deg,rgba(34,195,234,.045) 0 1px,transparent 1px 4px)}" +
    "#bkopf{display:flex;align-items:flex-end;justify-content:space-between;padding:4px 6px 10px;transform:translateY(-30px);opacity:0;transition:all .7s cubic-bezier(.2,.9,.3,1)}#bvoll.an #bkopf{transform:none;opacity:1}#bkopf small{display:block;font-size:11px;letter-spacing:.3em;color:#ffaa3c}#bkopf b{display:block;font-size:26px;font-weight:300;letter-spacing:.14em;text-shadow:0 0 22px #22c3ea;margin-top:2px}#bx{width:42px;height:42px;border-radius:50%;border:1.5px solid #2a8fb4;background:rgba(6,22,36,.8);color:#d7f8ff;font-size:18px;font-family:inherit;flex:none}" +
    "#bliste{flex:1;display:flex;flex-direction:column;gap:5px;min-height:0;position:relative}#bliste:after{content:'';position:absolute;left:-12px;right:-12px;top:-60px;height:60px;pointer-events:none;background:linear-gradient(180deg,transparent,rgba(120,230,255,.28),transparent);opacity:0}#bliste.sweep:after{animation:bsw 1.3s ease-in-out}@keyframes bsw{0%{top:-60px;opacity:1}100%{top:100%;opacity:.9}}" +
    ".br{flex:1;max-height:40px;min-height:0;display:flex;align-items:center;gap:8px;position:relative;border-radius:10px;padding:0 10px;background:rgba(6,22,36,.78);border:1px solid rgba(42,143,180,.45);overflow:hidden;transform:translateX(-46px) scale(.97);opacity:0;transition:transform .55s cubic-bezier(.2,.9,.3,1.2),opacity .45s}.br.on{transform:none;opacity:1}" +
    ".br i{position:absolute;left:0;top:0;bottom:0;width:0;background:linear-gradient(90deg,rgba(34,195,234,.12),rgba(34,195,234,.5));transition:width 1.2s cubic-bezier(.2,.8,.2,1);z-index:0;box-shadow:0 0 16px rgba(34,195,234,.5)}.br.z1 i{background:linear-gradient(90deg,rgba(59,140,255,.15),rgba(80,170,255,.62))}.br.z2 i{background:linear-gradient(90deg,rgba(255,170,60,.12),rgba(255,170,60,.5))}.br.z3 i{background:linear-gradient(90deg,rgba(255,200,60,.1),rgba(255,200,60,.4))}.br.z4 i{background:linear-gradient(90deg,rgba(255,90,80,.15),rgba(255,90,80,.55))}" +
    ".br>*{position:relative;z-index:1}.br .pl{width:24px;font-size:15px;font-weight:600;color:#8ccbe0;text-align:right}.br .nm{flex:1;min-width:0;font-size:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.br .sp{font-size:11px;color:#8ccbe0;white-space:nowrap}.br .pt{width:34px;text-align:right;font-size:19px;font-weight:600;color:#fff;text-shadow:0 0 10px rgba(34,195,234,.8)}" +
    ".br.mark{border-color:#ffaa3c;animation:bmk 1.6s ease-in-out infinite}.br.mark .nm{color:#ffd28a;font-weight:600}@keyframes bmk{50%{box-shadow:0 0 22px rgba(255,170,60,.7)}}" +
    "#bleg{display:flex;gap:9px;justify-content:center;padding-top:8px;font-size:9px;letter-spacing:.05em;white-space:nowrap;color:#8ccbe0;opacity:0;transition:opacity 1s}#bleg.on{opacity:1}#bleg u{text-decoration:none;display:inline-flex;align-items:center;gap:5px}#bleg u:before{content:'';width:9px;height:9px;border-radius:50%;background:var(--c)}" +
    ".bs{flex:1;max-height:74px;display:flex;flex-direction:column;justify-content:center;gap:5px;border-radius:14px;padding:6px 10px;background:rgba(6,22,36,.78);border:1px solid rgba(42,143,180,.45);transform:translateY(24px);opacity:0;transition:transform .6s cubic-bezier(.2,.9,.3,1.2),opacity .5s}.bs.on{transform:none;opacity:1}.bs.live{border-color:#ff6a5a;box-shadow:0 0 18px rgba(255,106,90,.4)}" +
    ".bs .zl{display:flex;align-items:center;gap:8px}.bs .h,.bs .g{flex:1;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.bs .h{text-align:right}.bs .sc{flex:none;min-width:70px;text-align:center;font-size:24px;font-weight:600;letter-spacing:.06em;text-shadow:0 0 14px #22c3ea;font-variant-numeric:tabular-nums}.bs .sc.k{font-size:15px;font-weight:300;color:#8ccbe0;text-shadow:none}" +
    ".bs .st{text-align:center;font-size:10px;letter-spacing:.22em;color:#8ccbe0}.bs.live .st{color:#ff8a7a}.bs.live .st:before{content:'';display:inline-block;width:8px;height:8px;border-radius:50%;background:#ff4a3a;margin-right:6px;animation:blv 1s infinite}@keyframes blv{50%{opacity:.2}}";
  function bau() {
    if (root) return;
    var st = document.createElement("style"); st.textContent = CSS + BCSS; document.head.appendChild(st);
    root = document.createElement("div"); root.id = "anim";
    root.innerHTML = '<canvas></canvas><div id="acam"><div id="apanel"><i class="abr a"></i><i class="abr b"></i><i class="abr c"></i><i class="abr d"></i><div class="akopf"><span id="akl"></span><b id="akr"></b></div><div id="ainh"></div></div></div>';
    document.body.appendChild(root); cv = root.querySelector("canvas"); x = cv.getContext("2d");
    window.addEventListener("resize", rs); rs();
  }
  function rs() { if (!cv) return; W = cv.width = innerWidth * S; H = cv.height = innerHeight * S; }
  function ring(px, py, col, gro) { ringe.push({ x: px, y: py, r: 10, max: gro || 420, col: col || "34,195,234", a: 1 }); }
  function burst(px, py, col, n) { for (var i = 0; i < (n || 16); i++) { var a = Math.random() * 6.28, v = 1 + Math.random() * 4; funk.push({ x: px, y: py, vx: Math.cos(a) * v, vy: Math.sin(a) * v, l: 1, col: col || "255,171,61" }); } }
  function mitte(el) { var r = el.getBoundingClientRect(); return { x: (r.left + r.width / 2) * S, y: (r.top + r.height / 2) * S }; }
  function schuss(el, col, n) { var m = mitte(el); strahl.push({ x: m.x, y: m.y, l: 1 }); burst(m.x, m.y, col || "255,200,100", n || 10); orb.k = 1; }
  function mittelRing(col, gro) { ring(W / 2, orb.y * H, col, gro); }

  function frame(t) {
    if (!laeuft) return;
    x.clearRect(0, 0, W, H);
    if (regenAn > 0) { x.lineWidth = (regenSchnee ? 3 : 1.4) * S; for (var q = 0; q < regen.length; q++) { var r0 = regen[q]; r0.y += r0.v * (regenSchnee ? .35 : 1); if (r0.y > 1) { r0.y = -.05; r0.x = Math.random(); } x.strokeStyle = regenSchnee ? "rgba(235,248,255," + .7 * regenAn + ")" : "rgba(150,210,255," + .55 * regenAn + ")"; x.beginPath(); x.moveTo(r0.x * W, r0.y * H); x.lineTo((r0.x + (regenSchnee ? 0 : r0.l * .18)) * W, (r0.y - (regenSchnee ? .004 : r0.l)) * H); x.stroke(); } }
    var ox = orb.x * W, oy = orb.y * H, rr = (22 + orb.k * 9) * S;
    var gl = x.createRadialGradient(ox, oy, 0, ox, oy, rr * 2.6); gl.addColorStop(0, "rgba(140,255,255," + (.6 + orb.k * .3) + ")"); gl.addColorStop(.3, "rgba(34,195,234,.35)"); gl.addColorStop(1, "rgba(34,195,234,0)");
    x.fillStyle = gl; x.beginPath(); x.arc(ox, oy, rr * 2.6, 0, 7); x.fill();
    for (var k = 0; k < 3; k++) { var w = t / (900 - k * 220) * (k % 2 ? -1 : 1); x.strokeStyle = k == 1 ? "rgba(255,171,61,.8)" : "rgba(34,195,234,.7)"; x.lineWidth = (k == 1 ? 3 : 2) * S; x.setLineDash(k == 1 ? [10 * S, 8 * S] : [30 * S, 12 * S]); x.beginPath(); x.arc(ox, oy, rr * (1.15 + k * .35), w, w + 5.4); x.stroke(); }
    x.setLineDash([]);
    for (var i = strahl.length - 1; i >= 0; i--) { var s = strahl[i]; s.l -= .05; if (s.l <= 0) { strahl.splice(i, 1); continue; } x.strokeStyle = "rgba(255,230,160," + s.l + ")"; x.lineWidth = 2.5 * S * s.l; x.shadowColor = "#ffab3d"; x.shadowBlur = 18 * S; x.beginPath(); x.moveTo(ox, oy); x.lineTo(s.x, s.y); x.stroke(); x.shadowBlur = 0; }
    for (i = ringe.length - 1; i >= 0; i--) { var r = ringe[i]; r.r += (r.max - r.r) * .06 + 2; r.a -= .014; if (r.a <= 0) { ringe.splice(i, 1); continue; } x.strokeStyle = "rgba(" + r.col + "," + r.a + ")"; x.lineWidth = 3 * S; x.beginPath(); x.arc(r.x, r.y, r.r * S, 0, 7); x.stroke(); }
    for (i = funk.length - 1; i >= 0; i--) { var f = funk[i]; f.x += f.vx * S; f.y += f.vy * S; f.vy += .06; f.l -= .025; if (f.l <= 0) { funk.splice(i, 1); continue; } x.fillStyle = "rgba(" + f.col + "," + f.l + ")"; x.fillRect(f.x, f.y, 3 * S * f.l, 3 * S * f.l); }
    orb.k *= .94; requestAnimationFrame(frame);
  }

  // ---- Fenster öffnen (gemeinsam für alle) ----
  function oeffnen(tk, links, rechts, html) {
    var p = document.getElementById("apanel"); p.className = ""; document.getElementById("akl").textContent = links; document.getElementById("akr").textContent = rechts; document.getElementById("ainh").innerHTML = html;
    // Panel verkleinern, wenn das Antwortfeld unten sonst darueber liegt
    try { var cam = document.getElementById("acam"), wk = document.getElementById("werk"); cam.style.transform = ""; cam.style.transformOrigin = "top center"; if (wk) { var frei = wk.getBoundingClientRect().top - cam.getBoundingClientRect().top - 14, hoch = p.offsetHeight; if (hoch > frei && frei > 120) cam.style.transform = "scale(" + Math.max(.5, frei / hoch).toFixed(3) + ")"; } } catch (e) {}
    orb.x = .5; orb.y = (parseFloat(getComputedStyle(document.getElementById("acam")).top) - 34) / innerHeight; orb.k = 1.5;
    root.className = "an"; mittelRing("34,195,234", 600); mittelRing("255,171,61", 420);
    return wait(450).then(function () { if (tk !== tok) return false; p.className = "an"; return wait(1100).then(function () { return tk === tok; }); });
  }
  function fertig(farbe) { var p = document.getElementById("apanel"); p.classList.add(farbe || "fertig"); orb.k = 2; mittelRing(farbe === "weg" ? "255,106,90" : "125,255,176", 800); }
  function ende(tk) { return wait(4300).then(function () { if (tk === tok) stop(); }); }
  function el(sel) { return [].slice.call(document.querySelectorAll(sel)); }

  // ---- Kalender (Termine ansehen, Termin anlegen/ändern/löschen, Urlaub, Training) ----
  function kalender(tk, o) {
    var von = utc(o.von), bis = utc(o.bis || o.von), st = von - wt(von) * 86400000;
    var wochen = Math.min(6, Math.max(4, Math.ceil((bis - st + 86400000) / (7 * 86400000)))), n = wochen * 7, h = '<div class="agrid">';
    ["MO", "DI", "MI", "DO", "FR", "SA", "SO"].forEach(function (d) { h += '<div class="awt">' + d + "</div>"; });
    for (var i = 0; i < n; i++) { var t = st + i * 86400000; h += '<div class="ad' + (wt(t) > 4 ? " we" : "") + '" data-d="' + iso(t) + '">' + new Date(t).getUTCDate() + "</div>"; }
    h += "</div>";
    var m1 = new Date(von), m2 = new Date(bis), kr = MON[m1.getUTCMonth()] + " " + m1.getUTCFullYear() + (m1.getUTCMonth() !== m2.getUTCMonth() || m1.getUTCFullYear() !== m2.getUTCFullYear() ? " – " + MON[m2.getUTCMonth()] + " " + m2.getUTCFullYear() : "");
    return oeffnen(tk, "GOOGLE KALENDER", kr, h).then(function (ok) {
      if (!ok) return;
      var zellen = el(".ad"), ziel = zellen.filter(function (c) { var d = utc(c.dataset.d); return o.tage ? o.tage.indexOf(c.dataset.d) >= 0 : (d >= von && d <= bis && !(o.ohneWe && wt(d) > 4)); }), p = Promise.resolve();
      zellen.forEach(function (c) { p = p.then(function () { c.classList.add("on"); return wait(Math.max(8, 600 / n)); }); });
      p = p.then(function () { return wait(300); });
      ziel.forEach(function (c) {
        p = p.then(function () {
          if (tk !== tok) return;
          if (o.lesen) { c.classList.add("lese"); schuss(c, "120,220,255", 6); return wait(90); }
          if (o.loeschen) { c.classList.add("rot"); schuss(c, "255,106,90", 8); return wait(90); }
          c.classList.add("blitz"); schuss(c, "255,200,100", 10); return wait(70).then(function () { c.classList.remove("blitz"); c.classList.add("hit"); return wait(40); });
        });
      });
      return p.then(function () { if (tk !== tok) return; return wait(400); }).then(function () {
        if (tk !== tok) return;
        if (o.loeschen) { fertig("weg"); return; }
        if (o.lesen) { fertig(); return; }
        fertig(); ziel.forEach(function (c, i) { setTimeout(function () { c.classList.remove("hit"); c.classList.add("gruen"); }, i * 20); });
      }).then(function () { return ende(tk); });
    });
  }

  // ---- Listen (Einkauf, Aufgaben, Erinnerungen) ----
  function preisText(p, k) { var n = { e5: "E5", e10: "E10", diesel: "Diesel" }; if (!k || !p[k]) k = p.e10 ? "e10" : p.diesel ? "diesel" : "e5"; return p[k] ? n[k] + " " + p[k] + " €" : ""; }
  function briefing(tk, e) {
    var r = [], sc = e.schicht, w = e.wetter, f = e.fahrt, er = (e.erinnerungen || []), t0 = (e.termine || [])[0];
    if (sc && sc.art) { if (sc.abfahrt) r.push({ text: sc.art + " · Abfahrt", zeit: sc.abfahrt }); else if (sc.stand === "schicht_vorbei") { } else if (sc.stand === "auf_der_arbeit") r.push({ text: sc.art + " · auf der Arbeit", zeit: sc.noch_bis_ende_min ? "noch " + sc.noch_bis_ende_min + " Min" : "" }); else r.push({ text: sc.art, zeit: "" }); }
    if (f && f.minuten) { var plus = f.normal ? f.minuten - f.normal : 0; r.push({ text: f.art === "heim" ? "Heimweg" : "Fahrt zur Arbeit", zeit: f.minuten + " Min" + (plus >= 5 ? " · +" + plus : " · frei") }); if (f.stau) r.push({ text: f.stau, zeit: "Stau" }); if (f.empfehlung && /fr(ü|ue)her|Achtung|knapp/.test(f.empfehlung)) r.push({ text: "Früher losfahren?", zeit: "ja" }); }
    if (w) r.push({ text: "Wetter" + (w.text ? " · " + w.text : ""), zeit: w.jetzt != null ? Math.round(w.jetzt) + "°" : (w.max != null ? Math.round(w.max) + "°" : "") });
    if (t0) r.push({ text: t0.titel, zeit: t0.zeit });
    er.slice(0, 2).forEach(function (q) { r.push({ text: q.text, zeit: q.zeit }); });
    if (e.nachricht) r.push({ text: e.nachricht, zeit: "" });
    if (e.morgen) r.push({ text: "Morgen · " + e.morgen.art, zeit: e.morgen.abfahrt ? "ab " + e.morgen.abfahrt : "" });
    if (!r.length) r.push({ text: "Nichts Besonderes heute", zeit: "" });
    r = r.slice(0, 7);
    var d = new Date(), tage = ["SO", "MO", "DI", "MI", "DO", "FR", "SA"];
    var h = r.map(function (q) { return '<div class="arow kp"><span>' + esc(q.text) + "</span>" + (q.zeit ? "<em>" + esc(q.zeit) + "</em>" : "") + "</div>"; }).join("");
    var gr = d.getHours() < 11 ? "GUTEN MORGEN" : d.getHours() < 17 ? "GUTEN TAG" : "GUTEN ABEND";
    var pn = window.AtlasProfil && window.AtlasProfil.name ? ", " + String(window.AtlasProfil.name).toUpperCase() : "";
    return oeffnen(tk, gr + pn, tage[d.getDay()] + " " + d.getDate() + "." + (d.getMonth() + 1) + ".", h).then(function (ok) {
      if (!ok) return; root.classList.add("sonne"); orb.k = 2.2; mittelRing("255,171,61", 900);
      var p = wait(900);
      el(".arow").forEach(function (rw) { p = p.then(function () { if (tk !== tok) return; rw.classList.add("blitz"); schuss(rw, "255,200,100", 12); return wait(120).then(function () { rw.classList.remove("blitz"); rw.classList.add("on"); return wait(600); }); }); });
      return p.then(function () { return wait(1500); }).then(function () { if (tk === tok) fertig(); }).then(function () { return ende(tk); });
    });
  }
  function liste(tk, o) {
    var h = o.eintraege.map(function (e) { return '<div class="arow' + (o.kompakt ? " kp" : "") + '">' + (o.ohneBox ? "" : '<div class="bx">✔</div>') + '<span>' + esc(e.text) + "</span>" + (e.zeit ? "<em>" + esc(e.zeit) + "</em>" : "") + "</div>"; }).join("");
    return oeffnen(tk, o.titel, o.rechts || o.eintraege.length + (o.eintraege.length === 1 ? " EINTRAG" : " EINTRÄGE"), h).then(function (ok) {
      if (!ok) return;
      var rows = el(".arow"), p = Promise.resolve();
      rows.forEach(function (r) {
        p = p.then(function () {
          if (tk !== tok) return;
          r.classList.add("blitz"); schuss(r, o.haken ? "125,255,176" : "255,200,100", o.haken ? 22 : 10);
          return wait(110).then(function () { r.classList.remove("blitz"); r.classList.add("on"); if (o.haken) r.classList.add("done"); return wait(o.haken ? 600 : 380); });
        });
      });
      return p.then(function () { return wait(o.halten || 600); }).then(function () { if (tk === tok) fertig(); }).then(function () { return ende(tk); });
    });
  }

  // ---- Websuche (Weltkugel, Seiten lesen, Ergebnis) ----
  // ---- Nachrichten: echte Weltkugel (MapLibre), zoomt Welt -> Deutschland -> Region -> Heimatort ----
  var mapLibP = null, nkMap = null, liest = false, wartet = false, pausiert = false, nkP = null, wartetT = 0;
  var ML_JS = "https://unpkg.com/maplibre-gl@5/dist/maplibre-gl.js", ML_CSS = "https://unpkg.com/maplibre-gl@5/dist/maplibre-gl.css", ML_STIL = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
  function mapLib() {
    if (window.maplibregl) return Promise.resolve(window.maplibregl);
    if (mapLibP) return mapLibP;
    mapLibP = new Promise(function (ok, nein) {
      var l = document.createElement("link"); l.rel = "stylesheet"; l.href = ML_CSS; document.head.appendChild(l);
      var sc = document.createElement("script"); sc.src = ML_JS; sc.onload = function () { window.maplibregl ? ok(window.maplibregl) : nein(new Error("maplibre")); }; sc.onerror = function () { nein(new Error("maplibre laden")); };
      document.head.appendChild(sc); setTimeout(function () { nein(new Error("maplibre Zeit")); }, 8000);
    }); mapLibP.catch(function () { mapLibP = null; });
    return mapLibP;
  }
  function pwait(ms) { return new Promise(function (ok) { var t = 0; (function s() { if (!pausiert) t += 100; if (t >= ms) ok(); else setTimeout(s, 100); })(); }); }
  function pause(an) {
    pausiert = an; var c = document.getElementById("ncard"); if (c) c.classList.toggle("halt", an);
    var h = document.getElementById("nhint"); if (h) h.textContent = an ? "ANGEHALTEN · TIPPEN = WEITER" : "TIPPEN = ANHALTEN · ✕ = SCHLIESSEN";
    try { var a = window.AtlasSprecher && window.AtlasSprecher.a; if (a && !a.ended) { if (an) a.pause(); else a.play().catch(function () {}); } } catch (e) {}
  }
  function nkWeg(hart) {
    if (wartet && !hart) return; // Weltkugel wartet auf die Nachrichten
    wartet = false; pausiert = false; nkP = null; clearTimeout(wartetT); liest = false; try { if (window.AtlasSprecher) window.AtlasSprecher.stopp(); } catch (e) {}
    if (nkMap) { try { nkMap.remove(); } catch (e) {} nkMap = null; }
    var v = document.getElementById("nvoll"); if (v && v.parentNode) v.parentNode.removeChild(v);
  }
  var NSTUFEN = [
    { k: "welt", t: "WELT", c: [15, 25], z: 3.4, p: 0 },
    { k: "deutschland", t: "DEUTSCHLAND", c: [10.3, 51.2], z: 6.3, p: 0 },
    { k: "region", t: "NORDDEUTSCHLAND", c: [10, 54], z: 8.2, p: 0 },
    { k: "ort", t: "ZUHAUSE", c: [10, 51.2], z: 12.8, p: 50 }
  ];
  // Vollbild und Weltkugel aufbauen (sofort beim Fragen, noch bevor die Nachrichten da sind)
  function nkBau(laden) {
    if (document.getElementById("nvoll") && nkP) return nkP;
    nkWeg(true);
    var v = document.createElement("div"); v.id = "nvoll";
    v.innerHTML = '<div id="nmap"></div><div id="nkopf"><span>NACHRICHTEN</span><b id="nr">WELT</b></div><button id="nx" aria-label="Schließen">✕</button>' + (laden ? '<div id="nlade">NACHRICHTEN WERDEN GELADEN …</div>' : "") + '<div id="ncard"><img id="nimg" alt="" referrerpolicy="no-referrer"><div class="nt"><small id="nq"></small><p id="nh"></p><div class="nk" id="nkz"></div></div></div><div id="nbar"><u id="nu"></u></div><div id="nhint">TIPPEN = ANHALTEN · ✕ = SCHLIESSEN</div>';
    document.body.appendChild(v);
    v.onclick = function (e) { var id = e.target && e.target.closest ? (e.target.closest("#ncard") ? "k" : e.target.closest("#nx") ? "x" : "") : ""; if (id === "k") return pause(!pausiert); nkWeg(true); stop(); };
    requestAnimationFrame(function () { v.classList.add("an"); });
    var nk = document.getElementById("nmap");
    nkP = mapLib().then(function (ml) {
      return new Promise(function (fertigK) {
        var done = false, fin = function () { if (!done) { done = true; fertigK(true); } };
        try {
          nkMap = new ml.Map({ container: nk, style: ML_STIL, center: [10, 20], zoom: 1.2, interactive: false, attributionControl: { compact: true }, fadeDuration: 0 });
          nkMap.on("style.load", function () { try { nkMap.setProjection({ type: "globe" }); } catch (e) {} });
          nkMap.on("load", function () { fin(); try { nkMap.easeTo({ center: [200, 20], zoom: 1.3, duration: 60000, easing: function (t) { return t; } }); } catch (e) {} }); setTimeout(fin, 6000);
        } catch (e) { done = true; fertigK(false); }
      });
    }).catch(function () { return false; });
    return nkP;
  }
  function vorab() { try { if (!an() || wartet) return; bau(); nkBau(true); liest = true; wartet = true; wartetT = setTimeout(function () { nkWeg(true); }, 40000); } catch (e) {} }
  function vorabEnde() { if (wartet) nkWeg(true); }
  function nachrichten(tk, o) {
    var pf = window.AtlasProfil || {}; NSTUFEN.forEach(function (s) { if (s.k === "ort") { if (pf.ort) s.t = String(pf.ort).toUpperCase(); if (pf.lat != null && pf.lon != null) s.c = [pf.lon, pf.lat]; } }); // Heimatort aus dem Profil
    var eb = o.ebenen || {}, st = NSTUFEN.filter(function (s) { return eb[s.k] !== undefined && (o.nur ? o.nur === s.k : true); });
    if (!st.length) st = NSTUFEN;
    var lad = document.getElementById("nlade"); if (lad && lad.parentNode) lad.parentNode.removeChild(lad);
    wartet = false; clearTimeout(wartetT); liest = true;
    var card, img;
    return nkBau(false).then(function (hatKarte) {
      card = document.getElementById("ncard"); img = document.getElementById("nimg");
      if (tk !== tok) { nkWeg(); return; }
      var kr = document.getElementById("nr"), u = document.getElementById("nu"), q = document.getElementById("nq"), h = document.getElementById("nh"), kz = document.getElementById("nkz"), marker = [], p = Promise.resolve();
      var schritte = []; st.forEach(function (s) { var l = eb[s.k] || []; if (!l.length) schritte.push({ s: s, q: null }); l.forEach(function (x) { schritte.push({ s: s, q: x }); }); });
      var S = window.AtlasSprecher, pre = []; // alle Meldungen schon vorab vertonen, damit jede genau zur Karte bereit ist
      schritte.forEach(function (z, i) { if (S && z.q) pre[i] = S.laden(z.q.titel); });
      p = p.then(function () { return wait(900); });
      schritte.forEach(function (z, i) {
        p = p.then(function () {
          if (tk !== tok) return;
          var x = z.q, s = z.s, ziel = x && isFinite(x.lat) && isFinite(x.lon) ? [x.lon, x.lat] : s.c;
          kr.textContent = s.t; u.style.width = Math.round((i + 1) / schritte.length * 100) + "%"; card.classList.remove("an");
          marker.forEach(function (m) { try { m.remove(); } catch (e) {} }); marker = [];
          if (hatKarte && nkMap) {
            try {
              nkMap.flyTo({ center: ziel, zoom: s.z, pitch: s.p, bearing: s.p ? -20 : 0, duration: 3400, essential: true });
              if (x && ziel !== s.c) { var d = document.createElement("div"); d.className = "nmk"; marker.push(new window.maplibregl.Marker({ element: d }).setLngLat(ziel).addTo(nkMap)); }
            } catch (e) {}
          }
          return pwait(1900).then(function () {
            if (tk !== tok) return;
            q.textContent = (x && x.quelle ? x.quelle.toUpperCase() : s.t) + (x && x.ort ? "  ·  " + x.ort.toUpperCase() : "");
            h.textContent = x ? x.titel : "Keine aktuelle Meldung gefunden."; kz.textContent = x && x.kurz ? x.kurz : ""; kz.scrollTop = 0;
            if (x && x.bild) { img.className = ""; img.onerror = function () { img.className = "weg"; }; img.src = x.bild; } else { img.className = "weg"; img.removeAttribute("src"); }
            card.classList.add("an");
            var las = S && x ? S.frei().then(function () { return pre[i]; }).then(function (b) { return tk === tok ? S.spiel(b) : null; }) : Promise.resolve();
            return Promise.all([las, pwait(x ? (x.kurz ? 6500 : 3800) : 2600)]).then(function () { return pwait(500); }); // Karte bleibt, bis die Meldung zu Ende gesprochen ist
          });
        });
      });
      return p.then(function () {
        if (tk !== tok) return; card.classList.remove("an");
        if (hatKarte && nkMap) { try { nkMap.flyTo({ center: [10, 30], zoom: 1.2, pitch: 0, bearing: 0, duration: 2200 }); } catch (e) {} }
        return wait(2200);
      }).then(function () { if (tk === tok) stop(); });
    });
  }
  function websuche(tk, o) {
    var lg = "", k; for (k = 0; k < 6; k++) lg += '<ellipse rx="84" ry="84" fill="none" stroke="#22c3ea" stroke-opacity=".5"><animate attributeName="rx" values="84;0;84" dur="6s" begin="-' + k + 's" repeatCount="indefinite"/></ellipse>';
    for (k = -3; k <= 3; k++) { var y = k * 24, rx = Math.sqrt(Math.max(0, 84 * 84 - y * y)); lg += '<ellipse cy="' + y + '" rx="' + rx.toFixed(1) + '" ry="' + (rx * .18).toFixed(1) + '" fill="none" stroke="#22c3ea" stroke-opacity=".4"/>'; }
    [[30, -40, 0], [-50, 10, .5], [60, 35, 1], [-20, -55, 1.4]].forEach(function (q) { lg += '<circle cx="' + q[0] + '" cy="' + q[1] + '" r="3.5" fill="#ffab3d"/><circle cx="' + q[0] + '" cy="' + q[1] + '" r="4" fill="none" stroke="#ffab3d"><animate attributeName="r" values="4;18" dur="1.8s" begin="' + q[2] + 's" repeatCount="indefinite"/><animate attributeName="opacity" values=".9;0" dur="1.8s" begin="' + q[2] + 's" repeatCount="indefinite"/></circle>'; });
    var svg = '<svg class="wglobe" viewBox="-110 -110 220 220"><defs><radialGradient id="wgl"><stop offset="0" stop-color="#22c3ea" stop-opacity=".35"/><stop offset="1" stop-color="#22c3ea" stop-opacity="0"/></radialGradient></defs><circle r="100" fill="url(#wgl)"/><circle r="84" fill="none" stroke="#22c3ea" stroke-width="1.5"/>' + lg + "</svg>";
    var h = svg + '<div class="wq">„' + esc(String(o.frage || "").slice(0, 90)) + '“</div><div class="wbar" id="wbar"><u id="wu"></u></div><small class="wst" id="wst">SUCHE IM INTERNET …</small><div class="wres" id="wres">' + esc(String(o.text || "").slice(0, 260)) + "</div>";
    return oeffnen(tk, "WEBSUCHE", "LÄUFT", h).then(function (ok) {
      if (!ok) return;
      var u = document.getElementById("wu"), st = document.getElementById("wst"), r = document.getElementById("akr"), p = Promise.resolve();
      [[35, "SUCHE IM INTERNET …"], [70, "SEITEN WERDEN GELESEN …"], [100, "ANTWORT WIRD ERSTELLT …"]].forEach(function (z) {
        p = p.then(function () { if (tk !== tok) return; u.style.width = z[0] + "%"; st.textContent = z[1]; mittelRing("255,171,61", 300); return wait(750); });
      });
      return p.then(function () {
        if (tk !== tok) return; document.getElementById("wbar").classList.add("ok"); st.textContent = "GEFUNDEN"; r.textContent = "GEFUNDEN"; document.getElementById("wres").classList.add("on"); fertig(); return wait(o.halten || 6500);
      }).then(function () { return ende(tk); });
    });
  }

  // ---- Sonne und Mond ----
  function mondPfad(k, zun) {
    var R = 31, rx = Math.abs(1 - 2 * k) * R, d;
    if (k < .02) d = ""; else if (k > .98) d = "M0 -" + R + " A" + R + " " + R + " 0 1 1 0 " + R + " A" + R + " " + R + " 0 1 1 0 -" + R;
    else d = "M0 -" + R + " A" + R + " " + R + " 0 0 1 0 " + R + " A" + rx.toFixed(1) + " " + R + " 0 0 " + (k < .5 ? 0 : 1) + " 0 -" + R;
    return '<path d="' + d + '" fill="#e8eef5" style="filter:drop-shadow(0 0 8px #cfe8ff)"' + (zun ? "" : ' transform="scale(-1 1)"') + "/>";
  }
  function sonneMond(tk, o) {
    var svg = '<svg width="100%" viewBox="0 0 356 250" style="margin-top:6px"><defs><radialGradient id="asgl"><stop offset="0" stop-color="#fff6c8"/><stop offset=".5" stop-color="#ffb84d"/><stop offset="1" stop-color="#ffab3d" stop-opacity="0"/></radialGradient><linearGradient id="ash" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#22c3ea" stop-opacity=".25"/><stop offset="1" stop-color="#22c3ea" stop-opacity="0"/></linearGradient></defs>' +
      '<line x1="10" y1="190" x2="346" y2="190" stroke="#22c3ea" stroke-opacity=".5"/><path d="M30 190 A148 150 0 0 1 326 190" fill="none" stroke="#ffab3d" stroke-width="3" stroke-dasharray="3 7" opacity=".45"/>' +
      '<path id="asp" d="M30 190 A148 150 0 0 1 326 190" fill="none" stroke="#ffab3d" stroke-width="4" stroke-linecap="round" style="filter:drop-shadow(0 0 8px #ffab3d)"/><rect x="10" y="190" width="336" height="50" fill="url(#ash)"/>' +
      '<g id="asg" transform="translate(30,190)" opacity="' + (o.status === "tag" ? 1 : .35) + '"><circle r="34" fill="url(#asgl)"/><circle r="11" fill="#fff6c8"/><g stroke="#ffd98a" stroke-width="2" opacity=".8"><line x1="0" y1="-24" x2="0" y2="-32"/><line x1="24" y1="0" x2="32" y2="0"/><line x1="-24" y1="0" x2="-32" y2="0"/><line x1="17" y1="-17" x2="23" y2="-23"/><line x1="-17" y1="-17" x2="-23" y2="-23"/><animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="14s" repeatCount="indefinite"/></g></g>' +
      '<g class="asl" id="asl1"><text x="42" y="212" fill="#ffab3d" font-size="10.5" text-anchor="middle" letter-spacing="1.2">AUFGANG</text><text x="42" y="233" fill="#fff" font-size="20" text-anchor="middle">' + esc(o.auf) + '</text></g>' +
      '<g class="asl" id="asl2"><text x="314" y="212" fill="#ffab3d" font-size="10.5" text-anchor="middle" letter-spacing="1.2">UNTERGANG</text><text x="314" y="233" fill="#fff" font-size="20" text-anchor="middle">' + esc(o.unter) + "</text></g>" +
      '<g class="asl" id="asl3"><text x="178" y="226" fill="#8ccbe0" font-size="11" text-anchor="middle" letter-spacing="1.5">TAGESLÄNGE</text><text x="178" y="244" fill="#fff" font-size="15" text-anchor="middle">' + esc(o.laenge) + "</text></g></svg>";
    var mond = o.mond ? '<div class="amo" id="amo"><svg width="82" height="82" viewBox="-41 -41 82 82" style="flex:none"><circle r="33" fill="#0b1626" stroke="#22c3ea" stroke-opacity=".6"/>' + mondPfad(o.mond.anteil, o.mond.zunehmend) + '</svg><div><b>' + esc(o.mond.name) + " · " + esc(o.mond.prozent) + ' %</b>' + (o.mond.auf || o.mond.unter ? "<small>" + (o.mond.auf ? "Aufgang " + esc(o.mond.auf) : "") + (o.mond.auf && o.mond.unter ? " · " : "") + (o.mond.unter ? "Untergang " + esc(o.mond.unter) : "") + "</small>" : "") + (o.mond.voll ? '<small class="v">Vollmond: ' + esc(o.mond.voll) + "</small>" : "") + "</div></div>" : "";
    return oeffnen(tk, "SONNE UND MOND", o.rechts, svg + mond).then(function (ok) {
      if (!ok) return; var pf = document.getElementById("asp"), sun = document.getElementById("asg"), len = pf.getTotalLength(), t0 = performance.now(), ziel = Math.max(0, Math.min(1, o.f));
      pf.style.strokeDasharray = len; pf.style.strokeDashoffset = len;
      return new Promise(function (res) { (function f() { var p = Math.min(1, (performance.now() - t0) / 2400), e = 1 - Math.pow(1 - p, 3), pt = pf.getPointAtLength(Math.max(.01, len * ziel * e)); sun.setAttribute("transform", "translate(" + pt.x + "," + pt.y + ")"); pf.style.strokeDashoffset = len - len * ziel * e; if (tk !== tok) return res(); if (p < 1) requestAnimationFrame(f); else res(); })(); }).then(function () {
        if (tk !== tok) return; schuss(document.getElementById("asg"), "255,171,61", 26); [1, 2, 3].forEach(function (i, n) { setTimeout(function () { var g = document.getElementById("asl" + i); if (g) g.classList.add("on"); }, n * 260); });
        return wait(900).then(function () { var m = document.getElementById("amo"); if (m) m.classList.add("on"); mittelRing("255,171,61", 500); return wait(1800); });
      }).then(function () { if (tk === tok) fertig(); }).then(function () { return ende(tk); });
    });
  }

  // ---- Erinnerung (Uhr) ----
  function uhr(tk, o) {
    var svg = '<svg class="auhr" width="230" height="230" viewBox="-115 -115 230 230"><circle r="100" fill="rgba(5,25,40,.7)" stroke="#22c3ea" stroke-width="2" style="filter:drop-shadow(0 0 6px #22c3ea)"/><circle r="88" fill="none" stroke="#ffab3d" stroke-width="3" stroke-dasharray="3 15.4" opacity=".8"/><line id="zm" x1="0" y1="0" x2="0" y2="-72" stroke="#22c3ea" stroke-width="3" stroke-linecap="round" style="filter:drop-shadow(0 0 5px #22c3ea)"/><line id="zh" x1="0" y1="0" x2="0" y2="-48" stroke="#ffab3d" stroke-width="5" stroke-linecap="round" style="filter:drop-shadow(0 0 5px #ffab3d)"/><circle r="6" fill="#fff"/></svg><div class="aunt" id="aunt">&nbsp;</div>';
    return oeffnen(tk, "ERINNERUNG", o.rechts, svg).then(function (ok) {
      if (!ok) return;
      var zm = document.getElementById("zm"), zh = document.getElementById("zh"), t0 = performance.now(), hz = ((o.h % 12) + o.m / 60) * 30, mz = o.m * 6 + 720;
      return new Promise(function (res) { (function f() { var p = Math.min(1, (performance.now() - t0) / 2400), e = 1 - Math.pow(1 - p, 3); zm.setAttribute("transform", "rotate(" + e * mz + ")"); zh.setAttribute("transform", "rotate(" + (300 + e * (hz - 300)) + ")"); if (p < 1 && tk === tok) requestAnimationFrame(f); else res(); })(); }).then(function () {
        if (tk !== tok) return; schuss(document.querySelector(".auhr"), "255,171,61", 30); document.getElementById("aunt").textContent = o.text; mittelRing("255,171,61", 500);
        return wait(1200);
      }).then(function () { if (tk === tok) fertig(); }).then(function () { return ende(tk); });
    });
  }

  // ---- Schicht (Wochenbalken) ----
  function schicht(tk, o) {
    var h = '<div class="atage">' + o.tage.map(function (d, i) {
      var k = /^Früh/.test(d.art) ? "frueh" : /^Spät/.test(d.art) ? "" : /frei/.test(d.art) ? "frei" : "sonst", kurz = /^Früh/.test(d.art) ? "FRÜH" : /^Spät/.test(d.art) ? "SPÄT" : /frei/.test(d.art) ? "frei" : esc(String(d.art).slice(0, 6));
      return '<div class="atag ' + k + '" id="atg' + i + '">' + (k === "frei" ? "" : "<i></i>") + "<span>" + kurz + '</span><span style="font-weight:400;color:#8ccbe0">' + esc(String(d.wochentag).slice(0, 2).toUpperCase()) + "</span></div>";
    }).join("") + "</div>";
    var z = o.zeiten; if (z) h += '<div class="azeit"><div>ABFAHRT<b>' + esc(z.abfahrt) + "</b></div><div>BEGINN<b>" + esc(z.beginn) + "</b></div><div>ENDE<b>" + esc(z.ende) + '</b></div></div><div class="alinie" id="alin"></div>';
    return oeffnen(tk, "SCHICHTPLAN", o.rechts, h).then(function (ok) {
      if (!ok) return; var p = Promise.resolve();
      o.tage.forEach(function (d, i) { p = p.then(function () { if (tk !== tok) return; var e = document.getElementById("atg" + i); e.classList.add("on"); if (!/frei/.test(d.art)) schuss(e, "34,195,234", 12); return wait(260); }); });
      return p.then(function () { return wait(300); }).then(function () { var l = document.getElementById("alin"); if (l) l.style.width = "100%"; return wait(1700); }).then(function () { if (tk === tok) fertig(); }).then(function () { return ende(tk); });
    });
  }

  // ---- Gedächtnis (Netz) ----
  function netz(tk, o) {
    var svg = '<svg class="anetz" id="anz" width="300" height="250" viewBox="0 0 300 250"></svg><div class="aunt" id="aunt">&nbsp;</div>';
    return oeffnen(tk, "GEDÄCHTNIS", o.rechts, svg).then(function (ok) {
      if (!ok) return; var sv = document.getElementById("anz"), pts = [], i, j;
      for (i = 0; i < 14; i++) pts.push([30 + Math.random() * 240, 20 + Math.random() * 210]);
      var h = ""; for (i = 0; i < pts.length; i++) for (j = i + 1; j < pts.length; j++) { var d = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]); if (d < 90) h += '<line x1="' + pts[i][0] + '" y1="' + pts[i][1] + '" x2="' + pts[j][0] + '" y2="' + pts[j][1] + '" stroke="#22c3ea" stroke-opacity="' + (1 - d / 90) * .7 + '"/>'; }
      pts.forEach(function (q) { h += '<circle cx="' + q[0] + '" cy="' + q[1] + '" r="3.5" fill="#9cf3ff" style="filter:drop-shadow(0 0 4px #22c3ea)"/>'; });
      sv.innerHTML = h; return wait(900).then(function () {
        if (tk !== tok) return; var c = document.createElementNS("http://www.w3.org/2000/svg", "circle"); c.setAttribute("cx", 150); c.setAttribute("cy", 125); c.setAttribute("r", 8); c.setAttribute("fill", o.weg ? "#ff6a5a" : "#ffab3d"); c.setAttribute("style", "filter:drop-shadow(0 0 10px " + (o.weg ? "#ff6a5a" : "#ffab3d") + ")"); sv.appendChild(c);
        schuss(sv, o.weg ? "255,106,90" : "255,171,61", 30); document.getElementById("aunt").textContent = o.text || ""; return wait(1600);
      }).then(function () { if (tk === tok) fertig(o.weg ? "weg" : "fertig"); }).then(function () { return ende(tk); });
    });
  }


  // ---- Bundesliga: Vollbild (Tabelle mit wachsenden Balken, Spieltag mit zaehlenden Ergebnissen) ----
  function bWeg() { var v = document.getElementById("bvoll"); if (v && v.parentNode) v.parentNode.removeChild(v); }
  function bundesligaVoll(tk, e, a) {
    bWeg(); var kurz = function (t) { return String(t || "").replace(/^(1\. )?(FC|SC|SV|VfB|VfL|TSG|FSV|RB|Borussia|Bayer 04) /, ""); };
    var gef = (e.gefragt || []).map(function (q) { return q.team; }), v = document.createElement("div"); v.id = "bvoll"; var h, tab = e.tabelle && e.tabelle.length;
    var kopf = '<div id="bkopf"><div><small>BUNDESLIGA' + (e.saison ? " " + esc(e.saison) : "") + "</small><b>" + (tab ? "TABELLE" : esc(String(e.spieltag || "SPIELTAG").toUpperCase())) + '</b></div><button id="bx" aria-label="Schließen">✕</button></div>';
    if (tab) {
      var mx = Math.max.apply(null, e.tabelle.map(function (q) { return q.punkte; })) || 1, n = e.tabelle.length;
      h = kopf + '<div id="bliste">' + e.tabelle.map(function (q) { var z = q.platz <= 4 ? "z1" : q.platz <= 6 ? "z2" : q.platz === 16 && n >= 18 ? "z3" : q.platz >= 17 ? "z4" : ""; return '<div class="br ' + z + (gef.indexOf(q.team) >= 0 ? " mark" : "") + '" data-p="' + q.punkte + '" data-w="' + Math.round(q.punkte / mx * 100) + '"><i></i><span class="pl">' + q.platz + '</span><span class="nm">' + esc(kurz(q.team)) + '</span><span class="sp">' + q.spiele + " Sp · " + esc(q.tore) + '</span><span class="pt">0</span></div>'; }).join("") + '</div><div id="bleg"><u style="--c:#5aa8ff">CHAMPIONS LEAGUE</u><u style="--c:#ffaa3c">EUROPA</u><u style="--c:#ffc83c">RELEGATION</u><u style="--c:#ff5a50">ABSTIEG</u></div>';
    } else {
      h = kopf + '<div id="bliste">' + e.spiele.slice(0, 9).map(function (q) { var live = q.stand === "läuft", kommt = q.stand === "kommt"; return '<div class="bs' + (live ? " live" : "") + '" data-e="' + (kommt ? "" : esc(q.ergebnis)) + '"><div class="zl"><span class="h">' + esc(kurz(q.heim)) + '</span><span class="sc' + (kommt ? " k" : "") + '">' + (kommt ? "–" : "0 : 0") + '</span><span class="g">' + esc(kurz(q.gast)) + '</span></div><div class="st">' + (live ? "LÄUFT" : kommt ? esc(String(q.anstoss || "").toUpperCase()) : "ENDSTAND") + "</div></div>"; }).join("") + "</div>";
    }
    v.innerHTML = h; document.body.appendChild(v); v.querySelector("#bx").onclick = function () { stop(); };
    requestAnimationFrame(function () { v.classList.add("an"); });
    var rows = [].slice.call(v.querySelectorAll(tab ? ".br" : ".bs")), p = wait(700);
    rows.forEach(function (r, i) {
      p = p.then(function () {
        if (tk !== tok) return; r.classList.add("on");
        if (tab) {
          setTimeout(function () { r.querySelector("i").style.width = r.dataset.w + "%"; }, 120); var pt = r.querySelector(".pt"), ziel = +r.dataset.p, t0 = performance.now();
          (function f() { var q = Math.min(1, (performance.now() - t0) / 1000); pt.textContent = Math.round(q * ziel); if (q < 1 && tk === tok) requestAnimationFrame(f); })();
          if (i < 3) { var m = mitte(r); schuss(r, "90,170,255", 8); }
        } else if (r.dataset.e) {
          var sc = r.querySelector(".sc"), tt = r.dataset.e.split(":"), a1 = +tt[0] || 0, a2 = +tt[1] || 0, t1 = performance.now();
          (function f() { var q = Math.min(1, (performance.now() - t1) / 900); sc.textContent = Math.round(q * a1) + " : " + Math.round(q * a2); if (q < 1 && tk === tok) requestAnimationFrame(f); })();
        }
        return wait(tab ? 55 : 110);
      });
    });
    return p.then(function () { if (tk !== tok) return; var li = v.querySelector("#bliste"), lg = v.querySelector("#bleg"); if (li) li.classList.add("sweep"); if (lg) lg.classList.add("on"); return wait(1400); });
  }

  // ---- Wetter ----
  function wetterAnim(tk, o) {
    var wolke = o.sonne ? '<b class="sonne" style="left:55px;top:0;width:90px;height:90px"></b>' : '<b style="left:10px;top:30px;width:90px;height:60px"></b><b style="left:55px;top:0;width:100px;height:80px"></b><b style="left:110px;top:25px;width:90px;height:62px"></b>';
    var h = '<div class="awx"><div class="awolke" id="awo">' + wolke + '</div><div class="atemp" id="atp">0°</div><div class="awdd">' + esc(o.wetter) + '</div><div class="awd">' + esc(o.zeile) + "</div>" + (o.warnung ? '<div class="awarn">⚠ ' + esc(o.warnung) + "</div>" : "") + "</div>";
    return oeffnen(tk, "WETTER", String(o.ort || "").toUpperCase(), h).then(function (ok) {
      if (!ok) return; document.getElementById("awo").classList.add("on"); schuss(document.getElementById("awo"), o.sonne ? "255,200,100" : "150,210,255", 20);
      var t0 = performance.now(), ziel = o.temp;
      return new Promise(function (res) { (function f() { var p = Math.min(1, (performance.now() - t0) / 1500); document.getElementById("atp").textContent = Math.round(p * ziel) + "°"; if (p < 1 && tk === tok) requestAnimationFrame(f); else res(); })(); }).then(function () {
        if (tk !== tok) return; regenSchnee = !!o.schnee; if (o.regen || o.schnee) (function a() { if (tk !== tok) return; regenAn = Math.min(1, regenAn + .02); if (regenAn < 1) requestAnimationFrame(a); })();
        return wait(2400);
      }).then(function () { if (tk === tok) fertig(o.warnung ? "weg" : "fertig"); }).then(function () { return wait(4300).then(function () { if (tk === tok) stop(); }); });
    });
  }

  // ---- Fahrt (Route mit wanderndem Punkt) ----
  function fahrt(tk, o) {
    var farbe = o.verz >= 5 ? "#ff6a5a" : "#22c3ea";
    var svg = '<svg class="anetz" width="310" height="150" viewBox="0 0 310 150"><path id="afp" d="M30 110 C 90 20, 150 140, 280 40" fill="none" stroke="' + farbe + '" stroke-width="4" stroke-linecap="round" stroke-dasharray="400" stroke-dashoffset="400" style="filter:drop-shadow(0 0 8px ' + farbe + ');transition:stroke-dashoffset 1.8s cubic-bezier(.3,.8,.3,1)"/><circle cx="30" cy="110" r="7" fill="#fff"/><circle cx="280" cy="40" r="7" fill="#ffab3d"/><text x="30" y="135" fill="#8ccbe0" font-size="11" text-anchor="middle">HEIM</text><text x="280" y="62" fill="#ffab3d" font-size="11" text-anchor="middle">ARBEIT</text><circle id="afd" r="6" fill="#fff" cx="30" cy="110" style="filter:drop-shadow(0 0 8px #fff)"/></svg>';
    var h = svg + '<div class="awx"><div class="atemp" id="atp" style="font-size:64px">0</div><div class="awdd">MINUTEN FAHRZEIT</div><div class="awd">' + esc(o.zeile) + "</div></div>";
    return oeffnen(tk, o.titel, o.rechts, h).then(function (ok) {
      if (!ok) return; var pf = document.getElementById("afp"), dot = document.getElementById("afd"), len = pf.getTotalLength(), t0 = performance.now();
      pf.style.strokeDasharray = len; pf.style.strokeDashoffset = len; pf.getBoundingClientRect(); pf.style.strokeDashoffset = 0;
      return new Promise(function (res) { (function f() { var p = Math.min(1, (performance.now() - t0) / 1900), e = 1 - Math.pow(1 - p, 3), pt = pf.getPointAtLength(len * e); dot.setAttribute("cx", pt.x); dot.setAttribute("cy", pt.y); document.getElementById("atp").textContent = Math.round(o.min * e); if (p < 1 && tk === tok) requestAnimationFrame(f); else res(); })(); }).then(function () {
        if (tk !== tok) return; schuss(document.getElementById("afd"), o.verz >= 5 ? "255,106,90" : "34,195,234", 24); return wait(1400);
      }).then(function () { if (tk === tok) fertig(o.verz >= 5 ? "weg" : "fertig"); }).then(function () { return ende(tk); });
    });
  }


  // ---- Fahrt mit echter dunkler Karte: Neon-Route, Stau orange (leicht) oder rot (stark) ----
  function karteAnim(tk, o) {
    var P = o.punkte, W = 620, H = 380;
    function mx(lon) { return (lon + 180) / 360; }
    function my(lat) { var s = Math.sin(lat * Math.PI / 180); return .5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI); }
    var x0 = 9, x1 = -9, y0 = 9, y1 = -9;
    P.concat((o.tanken || []).map(function (q) { return [q.lat, q.lon, 0]; })).forEach(function (p) { var a = mx(p[1]), b = my(p[0]); x0 = Math.min(x0, a); x1 = Math.max(x1, a); y0 = Math.min(y0, b); y1 = Math.max(y1, b); });
    var dx = Math.max(x1 - x0, 1e-7), dy = Math.max(y1 - y0, 1e-7);
    var z = Math.max(3, Math.min(16, Math.floor(Math.log(Math.min(.74 * W / dx, .66 * H / dy) / 512) / Math.LN2)));
    var S = 512 * Math.pow(2, z), ox = (x0 + x1) / 2 * S - W / 2, oy = (y0 + y1) / 2 * S - H / 2;
    var pts = P.map(function (p) { return [mx(p[1]) * S - ox, my(p[0]) * S - oy, p[2] || 0]; });
    var tp = (o.tanken || []).map(function (q) { return { x: mx(q.lon) * S - ox, y: my(q.lat) * S - oy, t: q.text }; });
    var lens = [0]; for (var i = 1; i < pts.length; i++) lens.push(lens[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    var TL = lens[lens.length - 1] || 1, maxS = 0, sMitte = null, best = 0;
    for (i = 0; i < pts.length - 1; i++) { if (pts[i][2] > maxS) maxS = pts[i][2]; if (pts[i][2] > 0) { var l = lens[i + 1] - lens[i]; if (pts[i][2] * 1e6 + l > best) { best = pts[i][2] * 1e6 + l; sMitte = [(pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2, pts[i][2]]; } } }
    function at(d) { d = Math.max(0, Math.min(TL, d)); for (var k = 1; k < lens.length; k++) { if (d <= lens[k]) { var f = (d - lens[k - 1]) / ((lens[k] - lens[k - 1]) || 1); return [pts[k - 1][0] + (pts[k][0] - pts[k - 1][0]) * f, pts[k - 1][1] + (pts[k][1] - pts[k - 1][1]) * f, pts[k - 1][2]]; } } return pts[pts.length - 1]; }
    var FARBE = [["34,211,255", "#d6f8ff"], ["255,171,61", "#ffe3b3"], ["255,45,74", "#ffc4cc"]];
    var html = '<canvas class="akarte" id="akc" width="' + W + '" height="' + H + '" style="width:310px;height:190px"></canvas><div class="awx"><div class="atemp" id="atp" style="font-size:54px">0</div><div class="awdd">MINUTEN FAHRZEIT</div><div class="awd">' + esc(o.zeile) + "</div></div>";
    // Karte laden (OpenStreetMap-Kacheln), nach spaetestens 2,6 s geht es auch ohne los
    var basis = document.createElement("canvas"); basis.width = W; basis.height = H; var bc = basis.getContext("2d");
    bc.fillStyle = "#0c111b"; bc.fillRect(0, 0, W, H); bc.strokeStyle = "rgba(34,195,234,.07)"; for (var g = 0; g < W; g += 40) { bc.beginPath(); bc.moveTo(g, 0); bc.lineTo(g, H); bc.stroke(); } for (g = 0; g < H; g += 40) { bc.beginPath(); bc.moveTo(0, g); bc.lineTo(W, g); bc.stroke(); }
    // Freie OpenStreetMap-Kacheln (256 px, eine Stufe tiefer), im Browser dunkel eingefaerbt
    var tz = Math.pow(2, z + 1);
    var kachelnFertig = new Promise(function (res) {
      var t1 = Math.floor(ox / 256), t2 = Math.floor((ox + W) / 256), u1 = Math.floor(oy / 256), u2 = Math.floor((oy + H) / 256), liste = [];
      for (var a = t1; a <= t2; a++) for (var b = u1; b <= u2; b++) if (a >= 0 && b >= 0 && a < tz && b < tz) liste.push([a, b]);
      if (!liste.length) return res();
      var offen = liste.length; function eins() { if (--offen <= 0) res(); }
      liste.forEach(function (q) { var im = new Image(); im.onload = function () { try { bc.filter = "invert(1) hue-rotate(180deg) brightness(.82) contrast(.92) saturate(.6)"; } catch (e) {} bc.drawImage(im, q[0] * 256 - ox, q[1] * 256 - oy, 256, 256); bc.filter = "none"; eins(); }; im.onerror = eins; im.src = "https://tile.openstreetmap.org/" + (z + 1) + "/" + q[0] + "/" + q[1] + ".png"; });
      setTimeout(res, 2600);
    });
    return oeffnen(tk, o.titel, o.rechts, html).then(function (ok) {
      if (!ok) return; return kachelnFertig.then(function () {
        if (tk !== tok) return; var cv = document.getElementById("akc"); if (!cv) return; var c = cv.getContext("2d"), t0 = performance.now(), DAUER = 2600;
        bc.fillStyle = "rgba(2,8,16,.28)"; bc.fillRect(0, 0, W, H); bc.fillStyle = "rgba(160,190,205,.55)"; bc.font = "16px sans-serif"; bc.fillText("© OpenStreetMap-Mitwirkende", 12, H - 10);
        function seg(von, bis, mitGlut, zeit) {
          for (var k = 0; k < pts.length - 1; k++) {
            var a0 = lens[k], a1 = lens[k + 1]; if (a1 <= von || a0 >= bis) continue;
            var s0 = Math.max(a0, von), s1 = Math.min(a1, bis), pa = at(s0), pb = at(s1), st = pts[k][2], col = FARBE[st], pulse = st === 2 ? .75 + .25 * Math.sin(zeit / 140) : 1;
            c.lineCap = "round"; c.beginPath(); c.moveTo(pa[0], pa[1]); c.lineTo(pb[0], pb[1]);
            if (mitGlut) { c.strokeStyle = "rgba(" + col[0] + "," + (.38 * pulse) + ")"; c.lineWidth = 17; c.shadowColor = "rgb(" + col[0] + ")"; c.shadowBlur = 26; c.stroke(); }
            c.strokeStyle = "rgb(" + col[0] + ")"; c.lineWidth = 6.5; c.shadowColor = "rgb(" + col[0] + ")"; c.shadowBlur = 14; c.stroke();
            c.strokeStyle = col[1]; c.lineWidth = 2.4; c.shadowBlur = 0; c.stroke();
          }
        }
        function pin(p, farbe, text, zeit) { c.shadowBlur = 0; c.strokeStyle = farbe; c.lineWidth = 3; c.beginPath(); c.arc(p[0], p[1], 15 + 4 * Math.sin(zeit / 220), 0, 7); c.stroke(); c.fillStyle = "#fff"; c.shadowColor = farbe; c.shadowBlur = 16; c.beginPath(); c.arc(p[0], p[1], 8, 0, 7); c.fill(); c.shadowBlur = 0; c.font = "bold 19px sans-serif"; c.textAlign = "center"; var w = c.measureText(text).width + 24, ly = p[1] > H - 70 ? p[1] - 56 : p[1] + 24; c.fillStyle = "rgba(3,14,26,.88)"; c.strokeStyle = farbe; c.lineWidth = 1.5; c.beginPath(); if (c.roundRect) c.roundRect(Math.max(4, Math.min(W - w - 4, p[0] - w / 2)), ly, w, 32, 10); else c.rect(p[0] - w / 2, ly, w, 32); c.fill(); c.stroke(); c.fillStyle = farbe === "#ffab3d" ? "#ffe9c0" : "#d9f6ff"; c.fillText(text, Math.max(4 + w / 2, Math.min(W - w / 2 - 4, p[0])), ly + 22); }
        function tank(zeit, a) { tp.forEach(function (q, n) { c.globalAlpha = a; c.shadowBlur = 14; c.shadowColor = "#ffab3d"; c.fillStyle = "#ffab3d"; c.beginPath(); c.arc(q.x, q.y, 7 + (n === 0 ? 2 * Math.sin(zeit / 200) : 0), 0, 7); c.fill(); c.shadowBlur = 0; c.font = "bold 15px sans-serif"; c.textAlign = "center"; var w = c.measureText(q.t).width + 12, ly = q.y - 18 - n % 2 * 18; c.fillStyle = "rgba(4,12,22,.85)"; c.fillRect(q.x - w / 2, ly - 14, w, 20); c.strokeStyle = "#ffab3d"; c.lineWidth = 1; c.strokeRect(q.x - w / 2, ly - 14, w, 20); c.fillStyle = "#ffe3b3"; c.fillText(q.t, q.x, ly + 1); c.textAlign = "left"; }); c.globalAlpha = 1; }
        function name(t) { t = String(t || "").trim(); return (t.toLowerCase() === "heim" ? "HEIM" : t.toLowerCase() === "arbeit" ? "ARBEIT" : t).toUpperCase(); }
        function stauLabel(d) { if (sMitte && d > TL * .6) { var sa = Math.min(1, (d / TL - .6) / .2), rot = sMitte[2] === 2; c.globalAlpha = sa; c.font = "bold 17px sans-serif"; var tx = o.stau ? ((o.stau.grad === "stark" ? "STAU " : "ZÄHFLIESSEND ") + String(o.stau.km).replace(".", ",") + " KM" + (o.stau.strasse ? " · " + o.stau.strasse : "")) : (o.verz >= 1 ? "STAU +" + o.verz + " MIN" : (rot ? "STAU" : "ZÄHFLIESSEND")), tw = c.measureText(tx).width + 24, lx = Math.max(4, Math.min(W - tw - 4, sMitte[0] + 16)), ly2 = Math.max(4, sMitte[1] - 40); c.fillStyle = "rgba(3,14,26,.9)"; c.strokeStyle = rot ? "#ff2d4a" : "#ffab3d"; c.lineWidth = 1.5; c.beginPath(); if (c.roundRect) c.roundRect(lx, ly2, tw, 30, 10); else c.rect(lx, ly2, tw, 30); c.fill(); c.stroke(); c.fillStyle = rot ? "#ff8a98" : "#ffcf8a"; c.textAlign = "left"; c.fillText(tx, lx + 12, ly2 + 21); c.globalAlpha = 1; } }
        return new Promise(function (res) {
          (function f() {
            var zeit = performance.now() - t0, p = Math.min(1, zeit / DAUER), e = 1 - Math.pow(1 - p, 3), d = TL * e;
            c.shadowBlur = 0; c.globalAlpha = 1; c.drawImage(basis, 0, 0);
            for (var r = 0; r < 3; r++) { var q = ((zeit / 1600 + r / 3) % 1); c.strokeStyle = "rgba(34,211,255," + (.5 * (1 - q)) + ")"; c.lineWidth = 2; c.beginPath(); c.arc(pts[0][0], pts[0][1], 10 + q * 130, 0, 7); c.stroke(); }
            seg(0, d, true, zeit);
            if (p > .1) for (var k = 0; k < 9; k++) { var dd = (zeit * .24 + k * TL / 9) % TL; if (dd < d) { var pp = at(dd), sl = pp[2]; c.fillStyle = FARBE[sl][1]; c.shadowColor = "rgb(" + FARBE[sl][0] + ")"; c.shadowBlur = 10; c.beginPath(); c.arc(pp[0], pp[1], 3.4, 0, 7); c.fill(); c.shadowBlur = 0; } }
            if (p < 1) { var h = at(d); c.fillStyle = "#fff"; c.shadowColor = "#7ff3ff"; c.shadowBlur = 26; c.beginPath(); c.arc(h[0], h[1], 8, 0, 7); c.fill(); c.shadowBlur = 0; }
            pin(pts[0], "#22d3ff", name(o.von), zeit);
            if (p > .85) { c.globalAlpha = Math.min(1, (p - .85) / .15); pin(pts[pts.length - 1], "#ffab3d", name(o.nach), zeit); c.globalAlpha = 1; }
            if (p > .5) tank(zeit, Math.min(1, (p - .5) / .3));
            stauLabel(d);
            c.fillStyle = "#22d3ff"; c.font = "16px sans-serif"; c.textAlign = "left"; c.fillText(p < 1 ? "ROUTE WIRD BERECHNET" : "ROUTE FERTIG", 14, 26);
            document.getElementById("atp").textContent = Math.round(o.min * e);
            if (tk !== tok) return res(); if (p < 1) requestAnimationFrame(f); else { (function nach() { var z2 = performance.now() - t0; if (z2 > DAUER + 1700 || tk !== tok) return res(); var e2 = z2; c.drawImage(basis, 0, 0); seg(0, TL, true, e2); pin(pts[0], "#22d3ff", name(o.von), e2); pin(pts[pts.length - 1], "#ffab3d", name(o.nach), e2); tank(e2, 1); stauLabel(TL); requestAnimationFrame(nach); })(); }
          })();
        }).then(function () { if (tk === tok) fertig(o.verz >= 5 ? "weg" : "fertig"); }).then(function () { return ende(tk); });
      });
    });
  }

  // ---- Kurzer Effekt für alle anderen Funktionen ----
  function kurz(tk) { root.className = "an"; orb.x = .5; orb.y = .4; orb.k = 1.5; mittelRing("34,195,234", 700); mittelRing("255,171,61", 520); document.getElementById("apanel").className = ""; document.getElementById("akl").textContent = ""; document.getElementById("akr").textContent = ""; return wait(1300).then(function () { fertig(); return wait(600); }).then(function () { if (tk === tok) stop(); }); }

  // ---- Auswahl nach Werkzeug ----
  function wahl(w) {
    var a = w.args || {}, e = w.erg || {}, n = w.name, ak = a.aktion;
    function tage1(s) { return String(s || "").slice(0, 10); }
    if (n === "termin_neu") {
      if (ak === "anlegen" && e.angelegt) { var b = tage1(e.angelegt.beginn), en = tage1(e.angelegt.ende); if (e.angelegt.ganztag && en > b) en = iso(utc(en) - 86400000); return function (tk) { return kalender(tk, { von: b, bis: en >= b ? en : b }); }; }
      if (ak === "verschieben" && a.beginn) return function (tk) { return kalender(tk, { von: tage1(a.beginn) }); };
      if (ak === "loeschen" && e.geloescht && e.geloescht.beginn) return function (tk) { return kalender(tk, { von: tage1(e.geloescht.beginn), loeschen: true }); };
    }
    if (n === "termine" && e.termine && e.termine.length) { var tg = []; e.termine.forEach(function (t) { var s = utc(tage1(t.beginn)), z = t.ganztag ? utc(tage1(t.ende)) - 86400000 : utc(tage1(t.ende || t.beginn)); for (var d = s; d <= Math.max(s, z) && tg.length < 60; d += 86400000) tg.push(iso(d)); }); tg.sort(); return function (tk) { return kalender(tk, { von: tg[0], bis: tg[tg.length - 1], tage: tg, lesen: true }); }; }
    if (n === "urlaub") {
      if (ak === "eintragen" && a.von && a.bis) return function (tk) { return kalender(tk, { von: a.von, bis: a.bis, ohneWe: !!a.ohne_wochenende }); };
      if (ak === "abfragen" && e.urlaub && e.urlaub.length) return function (tk) { return kalender(tk, { von: e.urlaub[0].von, bis: e.urlaub[0].bis, ohneWe: !!e.urlaub[0].ohne_wochenende, lesen: true }); };
    }
    if (n === "schicht" && e.tage && e.tage.length && ak === "abfragen") { var tt = e.tage.slice(0, 7), zz = null; e.tage.forEach(function (d) { if (!zz && d.zeiten) zz = d.zeiten; }); return function (tk) { return schicht(tk, { tage: tt, zeiten: zz, rechts: (e.zusammenfassung && e.zusammenfassung.length === 1 ? String(e.zusammenfassung[0]).split(": ").pop() : "").toUpperCase() }); }; }
    if (n === "schicht" && e.zeiten && ak === "zeiten_zeigen") { var f = e.zeiten.frueh, sp = e.zeiten.spaet; return function (tk) { return schicht(tk, { tage: [{ art: "Frühschicht", wochentag: "Früh" }, { art: "Spätschicht", wochentag: "Spät" }], zeiten: sp, rechts: "ZEITEN" }); }; }
    if (n === "einkauf" || n === "aufgaben" || n === "mitnehmen") {
      var t = n === "einkauf" ? "EINKAUFSLISTE" : n === "mitnehmen" ? "MITNEHMEN" : "AUFGABEN", it = [], haken = false;
      if (ak === "hinzufuegen") it = e.hinzugefuegt || []; else if (ak === "abhaken") { it = e.erledigt || []; haken = true; } else if (ak === "zeigen") it = e.offen || [];
      it = it.slice(0, 7).map(function (q) { return typeof q === "string" ? { text: q } : { text: q.text, zeit: q.faellig ? String(q.faellig).slice(5).split("-").reverse().join(".") : "" }; });
      if (it.length) return function (tk) { return liste(tk, { titel: t, eintraege: it, haken: haken }); };
    }
    if (n === "geburtstag" && ak !== "loeschen" && e.geburtstage && e.geburtstage.length) return function (tk) { return liste(tk, { titel: "GEBURTSTAGE", ohneBox: true, kompakt: true, eintraege: e.geburtstage.slice(0, 5).map(function (g) { return { text: g.name + (g.wird_alt ? " (" + g.wird_alt + ")" : ""), zeit: g.heute ? "HEUTE" : g.in_tagen === 1 ? "morgen" : "in " + g.in_tagen + " T." }; }) }); };
    if (n === "geburtstag" && ak === "merken" && e.gemerkt) return function (tk) { return liste(tk, { titel: "GEBURTSTAG GEMERKT", ohneBox: true, kompakt: true, eintraege: [{ text: e.gemerkt.name, zeit: e.gemerkt.datum }] }); };
    if (n === "feiertage" && e.eintraege && e.eintraege.length) return function (tk) { return liste(tk, { titel: "FEIERTAGE UND FERIEN", ohneBox: true, kompakt: true, eintraege: e.eintraege.slice(0, 5).map(function (f) { return { text: f.name, zeit: f.laeuft_gerade ? "läuft" : f.in_tagen === 0 ? "HEUTE" : f.in_tagen === 1 ? "morgen" : "in " + f.in_tagen + " T." }; }) }); };
    if (n === "kontakte" && e.ok && (e.kontakt || e.gespeichert || (e.kontakte && e.kontakte.length))) { var kk = e.kontakt ? [e.kontakt] : e.gespeichert ? [e.gespeichert] : e.kontakte.slice(0, 6); var kz = kk.map(function (q) { return { text: q.name, zeit: q.telefon || (q.adresse ? "Adresse" : "") }; }); return function (tk) { return liste(tk, { titel: "KONTAKTE", ohneBox: true, kompakt: true, rechts: e.gespeichert ? "GESPEICHERT" : "", eintraege: kz }); }; }
    if (n === "mail" && e.ok && (e.mails || e.betreff)) { var ml = e.mails ? e.mails.slice(0, 5).map(function (q) { return { text: String(q.von).slice(0, 18) + " – " + String(q.betreff).slice(0, 26), zeit: q.ungelesen ? "NEU" : "" }; }) : [{ text: String(e.von).slice(0, 18) + " – " + String(e.betreff).slice(0, 26), zeit: "GELESEN" }]; if (ml.length) return function (tk) { return liste(tk, { titel: "POSTEINGANG", ohneBox: true, kompakt: true, halten: 6000, rechts: e.ungelesen_im_posteingang != null ? e.ungelesen_im_posteingang + " UNGELESEN" : "", eintraege: ml }); }; }
    if (n === "kuendigung" && e.ok && e.brief) { var kd = [{ text: e.anbieter || "Kündigung", zeit: e.zeitpunkt === "datum" ? "ZU DATUM" : e.zeitpunkt === "ausserordentlich" ? "FRISTLOS" : "NÄCHSTMÖGLICH" }]; if (e.luecken && e.luecken.length) kd.push({ text: "Anschrift fehlt noch", zeit: "PRÜFEN" }); return function (tk) { return liste(tk, { titel: "KÜNDIGUNG", ohneBox: true, kompakt: true, rechts: "ENTWURF", eintraege: kd }); }; }
    if (n === "nachrichten" && e.ok && e.ebenen) return function (tk) { return nachrichten(tk, { ebenen: e.ebenen, nur: ["welt", "deutschland", "region", "ort"].indexOf(a.ebene) >= 0 ? a.ebene : "" }); };
    if (n === "websuche" && e.ok && e.ergebnis) return function (tk) { return websuche(tk, { frage: e.frage, text: e.ergebnis }); };
    if (n === "foto" && e.ok) { var FA = { schild_text: "SCHILD", rechnung: "RECHNUNG", brief: "BRIEF", stundenplan: "STUNDENPLAN", essensplan: "ESSENSPLAN", visitenkarte: "VISITENKARTE", einkaufszettel: "EINKAUFSZETTEL", plakat_einladung: "PLAKAT", produkt: "PRODUKT", warnleuchte: "WARNLEUCHTE", parkschild: "PARKSCHILD", sonstiges: "FOTO" }; var fz = [{ text: e.beschreibung || "Foto", zeit: FA[e.art] || "FOTO" }]; var fl = String(e.text || "").split("\n").filter(function (x) { return x.trim(); }).slice(0, 3); fl.forEach(function (x) { fz.push({ text: x.slice(0, 40), zeit: "" }); }); return function (tk) { return liste(tk, { titel: "FOTO GELESEN", ohneBox: true, kompakt: true, rechts: FA[e.art] || "", eintraege: fz }); }; }
    if (n === "termin_finder" && e.ok && e.tage && e.tage.length) { var tf = []; e.tage.slice(0, 5).forEach(function (t) { t.frei.slice(0, 1).forEach(function (f) { tf.push({ text: t.tag + " " + t.datum.slice(8) + "." + t.datum.slice(5, 7) + ".", zeit: f.von + "–" + f.bis }); }); }); return function (tk) { return liste(tk, { titel: "FREIE ZEIT", ohneBox: true, kompakt: true, rechts: e.dauer_minuten + " MIN", eintraege: tf }); }; }
    if (n === "ueberblick" && e.ok && a.briefing) return function (tk) { return briefing(tk, e); };
    if (n === "ueberblick" && e.ok) { var ue = []; if (e.schicht && e.schicht.abfahrt) ue.push({ text: e.schicht.art, zeit: "ab " + e.schicht.abfahrt }); (e.termine || []).slice(0, 3).forEach(function (q) { ue.push({ text: q.titel, zeit: q.zeit }); }); if (e.wetter && e.wetter.schirm) ue.push({ text: "Schirm mitnehmen", zeit: e.wetter.regen_ab ? "ab " + e.wetter.regen_ab : "" }); (e.erinnerungen || []).slice(0, 2).forEach(function (q) { ue.push({ text: q.text, zeit: q.zeit }); }); (e.geburtstage || []).slice(0, 1).forEach(function (g) { ue.push({ text: g.name + " Geburtstag", zeit: g.in_tagen === 0 ? "HEUTE" : g.in_tagen === 1 ? "morgen" : "in " + g.in_tagen + " T." }); }); if (ue.length) return function (tk) { return liste(tk, { titel: "WAS STEHT AN", ohneBox: true, kompakt: true, rechts: e.tag === "heute" ? "HEUTE" : e.tag === "morgen" ? "MORGEN" : "", eintraege: ue.slice(0, 7) }); }; }
    if (n === "notiz" && ak === "zeigen" && e.notizen && e.notizen.length) return function (tk) { return liste(tk, { titel: "NOTIZEN", ohneBox: true, kompakt: true, eintraege: e.notizen.slice(0, 5).map(function (q) { return { text: q.titel || String(q.text).split("\n")[0].slice(0, 36), zeit: String(q.angelegt || "").slice(8, 10) + "." + String(q.angelegt || "").slice(5, 7) + "." }; }) }); };
    if (n === "notiz" && (ak === "anlegen" || ak === "anhaengen") && (e.angelegt || e.geaendert)) { var nz = e.angelegt || e.geaendert; return function (tk) { return liste(tk, { titel: ak === "anlegen" ? "NOTIZ GESPEICHERT" : "NOTIZ ERGÄNZT", ohneBox: true, kompakt: true, eintraege: [{ text: nz.titel || String(nz.text).split("\n")[0].slice(0, 40) }] }); }; }
    if (n === "erinnerung") {
      if (ak === "anlegen" && e.angelegt && /T\d\d:\d\d$/.test(e.angelegt.zeit || "")) { var zt = e.angelegt.zeit, hh = +zt.slice(11, 13), mm = +zt.slice(14, 16); return function (tk) { return uhr(tk, { h: hh, m: mm, text: e.angelegt.text, rechts: zt.slice(8, 10) + "." + zt.slice(5, 7) + ". " + zt.slice(11, 16) }); }; }
      if (ak === "zeigen" && e.offen && e.offen.length) return function (tk) { return liste(tk, { titel: "ERINNERUNGEN", eintraege: e.offen.slice(0, 7).map(function (q) { return { text: q.text, zeit: String(q.zeit || "").slice(11, 16) }; }) }); };
    }
    if (n === "sonne_mond" && e.sonne) {
      if (e.sonne.aufgang && e.sonne.untergang) {
        var tm = function (z) { var m = String(z).match(/(\d+):(\d+)/); return m ? +m[1] * 60 + +m[2] : 0; }, nu = new Date(), ymd = nu.getFullYear() + "-" + ("0" + (nu.getMonth() + 1)).slice(-2) + "-" + ("0" + nu.getDate()).slice(-2), jt = nu.getHours() * 60 + nu.getMinutes(), ta = tm(e.sonne.aufgang), tu = tm(e.sonne.untergang), heute = e.datum === ymd, st = !heute ? "tag" : jt < ta ? "vor" : jt > tu ? "nach" : "tag";
        var md = e.mond ? { name: String(e.mond.phase || "").replace(/ \(.*\)/, ""), prozent: e.mond.beleuchtung_prozent, anteil: (e.mond.beleuchtung_prozent || 0) / 100, zunehmend: e.mond.zunehmend !== false, auf: e.mond.aufgang, unter: e.mond.untergang, voll: e.mond.naechster_vollmond ? String(e.mond.naechster_vollmond).replace(/^(\S+), (\d+)\. (\S+)$/, function (a, w, d, mo) { return w.slice(0, 2) + ", " + d + ". " + mo; }) : "" } : null;
        return function (tk) { return sonneMond(tk, { auf: e.sonne.aufgang, unter: e.sonne.untergang, laenge: e.sonne.tageslaenge || "", f: !heute ? .5 : jt < ta ? 0 : jt > tu ? 1 : (jt - ta) / (tu - ta), status: st, mond: md, rechts: heute ? "HEUTE" : String(e.datum || "").slice(5).split("-").reverse().join(".") }); };
      }
      var sm = []; if (e.sonne.aufgang) sm.push({ text: "Sonnenaufgang", zeit: e.sonne.aufgang }); if (e.sonne.untergang) sm.push({ text: "Sonnenuntergang", zeit: e.sonne.untergang }); if (e.sonne.tageslaenge) sm.push({ text: "Tageslänge", zeit: e.sonne.tageslaenge }); if (e.mond) sm.push({ text: "Mond: " + String(e.mond.phase || "").replace(/ \(.*\)/, ""), zeit: e.mond.beleuchtung_prozent + " %" }); if (sm.length) return function (tk) { return liste(tk, { titel: "SONNE UND MOND", eintraege: sm, haken: false, ohneBox: true, kompakt: true }); };
    }
    if (n === "in_der_naehe" && e.auf_dem_weg && e.karte && e.karte.punkte && e.karte.punkte.length > 1 && e.orte && e.orte.length) { var tt0 = e.orte.filter(function (q) { return isFinite(q.lat) && isFinite(q.lon); }).map(function (q) { return { lat: q.lat, lon: q.lon, text: preisText(q.preise || {}, e.kraftstoff).replace(" €", "") }; }); return function (tk) { return karteAnim(tk, { titel: "TANKEN UNTERWEGS", rechts: "TANKERKÖNIG", punkte: e.karte.punkte, von: e.karte.von, nach: e.karte.nach, stau: null, min: e.fahrzeit_min || 0, verz: 0, zeile: (e.km || "") + " KM", tanken: tt0 }); }; }
    if (n === "in_der_naehe" && e.orte && e.orte.length) { var on = e.orte.slice(0, 4).map(function (q) { return { text: q.name, zeit: (q.preise ? preisText(q.preise, e.kraftstoff) + " · " : "") + q.entfernung + (q.offen === true ? (q.schliesst ? " · offen bis " + q.schliesst : " · offen") : q.offen === false ? " · geschlossen" : "") }; }); return function (tk) { return liste(tk, { titel: String(a.art || "IN DER NÄHE").toUpperCase(), eintraege: on, haken: false, ohneBox: true, kompakt: true }); }; }
    if (n === "verkehr" && e.fahrzeit_min) { var vz = e.verzoegerung_min || 0; if (e.karte && e.karte.punkte && e.karte.punkte.length > 1) return function (tk) { return karteAnim(tk, { titel: "FAHRT", rechts: e.live_verkehr ? "LIVE-VERKEHR" : "OHNE VERKEHRSLAGE", punkte: e.karte.punkte, von: e.karte.von, nach: e.karte.nach, stau: (e.staus || []).reduce(function (m, x) { return !m || (x.grad === "stark" && m.grad !== "stark") || (x.grad === m.grad && x.km > m.km) ? x : m; }, null), min: e.fahrzeit_min, verz: vz, zeile: e.km + " KM" + (vz >= 5 ? " · +" + vz + " MIN VERKEHR" : "") }); }; return function (tk) { return fahrt(tk, { titel: "FAHRZEIT", rechts: e.live_verkehr ? "LIVE-VERKEHR" : "OHNE VERKEHRSLAGE", min: e.fahrzeit_min, verz: vz, zeile: e.km + " KM" + (vz >= 5 ? " · +" + vz + " MIN VERKEHR" : "") }); }; }
    if (n === "abfahrt" && e.fahrzeit_jetzt_min) { var vz2 = Math.max(0, e.fahrzeit_jetzt_min - e.fahrzeit_normal_min); if (e.karte && e.karte.punkte && e.karte.punkte.length > 1) return function (tk) { return karteAnim(tk, { titel: "ABFAHRT " + e.abfahrt, rechts: "ANKUNFT " + e.ankunft_geplant, punkte: e.karte.punkte, von: e.karte.von, nach: e.karte.nach, stau: (e.staus || []).reduce(function (m, x) { return !m || (x.grad === "stark" && m.grad !== "stark") || (x.grad === m.grad && x.km > m.km) ? x : m; }, null), min: e.fahrzeit_jetzt_min, verz: vz2, zeile: "BEGINN " + e.beginn + " · PUFFER " + e.puffer_bis_beginn_min + " MIN" }); }; return function (tk) { return fahrt(tk, { titel: "ABFAHRT " + e.abfahrt, rechts: "ANKUNFT " + e.ankunft_geplant, min: e.fahrzeit_jetzt_min, verz: vz2, zeile: "BEGINN " + e.beginn + " · PUFFER " + e.puffer_bis_beginn_min + " MIN" }); }; }
    if (n === "wetter" && e.aktuell) {
      var ak2 = e.aktuell, regenWahr = 0; (e.stunden || []).forEach(function (q) { if ((q.regen_prozent || 0) > regenWahr) regenWahr = q.regen_prozent; });
      var tx = String(ak2.wetter || ""), schnee = /Schnee/.test(tx), rg = /Regen|Niesel|Schauer|Gewitter/.test(tx) || (e.empfehlung && e.empfehlung.schirm), w0 = e.warnungen && e.warnungen[0];
      return function (tk) { return wetterAnim(tk, { ort: e.ort, temp: Math.round(ak2.temperatur), wetter: tx, zeile: (regenWahr ? "REGEN " + regenWahr + "% · " : "") + "WIND " + Math.round(ak2.wind_kmh) + " KM/H", sonne: /klar/.test(tx), regen: !!rg && !schnee, schnee: schnee, warnung: w0 ? String(w0.titel).replace(/^Amtliche WARNUNG vor /i, "").slice(0, 60) : "" }); };
    }
    if (n === "bundesliga" && e.ok && ((e.tabelle && e.tabelle.length) || (e.spiele && e.spiele.length))) return function (tk) { return bundesligaVoll(tk, e, a); };
    if (n === "gedaechtnis") {
      if (ak === "merken") return function (tk) { return netz(tk, { rechts: "NEUER EINTRAG", text: "Gemerkt" }); };
      if (ak === "vergessen" && a.bestaetigt) return function (tk) { return netz(tk, { rechts: "EINTRAG GELÖSCHT", text: "Vergessen", weg: true }); };
      if (ak === "suchen") return function (tk) { return netz(tk, { rechts: "SUCHE", text: "Gefunden: " + ((e.treffer || []).length) }); };
    }
    return null;
  }

  function play(liste) {
    try {
      if (!an() || !liste || !liste.length) return;
      var w = null, i; for (i = liste.length - 1; i >= 0; i--) { if (liste[i].ok) { w = liste[i]; break; } }
      if (!w || !(w.name === "nachrichten" && w.erg && w.erg.ebenen)) vorabEnde();
      if (!w) return;
      var f = wahl(w) || kurz;
      bau(); stop(true); var tk = ++tok; laeuft = true; strahl = []; funk = []; ringe = []; requestAnimationFrame(frame);
      Promise.resolve(f(tk)).catch(function (e) { console.error("Animation", e); stop(); });
    } catch (e) { console.error("Animation", e); }
  }
  function stop(still) { nkWeg(); bWeg(); tok++; laeuft = false; regenAn = 0; if (!root) return; root.className = ""; var p = document.getElementById("apanel"); if (p) p.className = ""; }
  window.AtlasAnim = { play: play, stop: stop, an: an, vorab: vorab, vorabEnde: vorabEnde, liest: function () { return liest; } };
})();
