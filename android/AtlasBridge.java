package de.beispiel.atlas;

import android.content.Context;
import android.content.Intent;
import android.provider.AlarmClock;
import android.webkit.JavascriptInterface;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Calendar;

/** Bruecke Seite -> App: window.AtlasApp. Wecker werden in der Uhr-App des Handys gestellt (die echte Wecker-App, kein eigener Ton). */
public class AtlasBridge {
    private final Context c;
    AtlasBridge(Context c) { this.c = c; }

    /** Offene Erinnerungen als Liste [{id, text, zeit "yyyy-MM-ddTHH:mm"}]: die App plant die Benachrichtigungen. */
    @JavascriptInterface
    public void erinnerungen(String json) { Erinnerungen.sync(c.getApplicationContext(), json); }

    /** Heimweg-Hinweise: [{zeit "yyyy-MM-ddTHH:mm", art}], die App zeigt dann zur Zeit Fahrzeit und Verkehr als Benachrichtigung. */
    @JavascriptInterface
    public void heimweg(String json) { Heimweg.sync(c.getApplicationContext(), json); }

    /** Briefing-Push: [{zeit "yyyy-MM-ddTHH:mm", art}], die App holt zur Zeit das Briefing und zeigt es als Benachrichtigung. */
    @android.webkit.JavascriptInterface
    public void briefing(String json) { Morgen.sync(c.getApplicationContext(), json); }

    /** Parkplatz per Auto-Bluetooth. JSON {bt, geraete:[{name, adresse}], gewaehlt, name, hintergrund} */
    @JavascriptInterface
    public String parkGeraete() {
        try {
            JSONObject o = new JSONObject(); JSONArray l = new JSONArray();
            boolean bt = android.os.Build.VERSION.SDK_INT < 31 || c.checkSelfPermission("android.permission.BLUETOOTH_CONNECT") == android.content.pm.PackageManager.PERMISSION_GRANTED;
            o.put("bt", bt);
            if (bt) {
                android.bluetooth.BluetoothAdapter ad = android.bluetooth.BluetoothAdapter.getDefaultAdapter();
                if (ad != null && ad.getBondedDevices() != null) for (android.bluetooth.BluetoothDevice d : ad.getBondedDevices()) l.put(new JSONObject().put("name", d.getName() == null ? d.getAddress() : d.getName()).put("adresse", d.getAddress()));
            }
            android.content.SharedPreferences sp = Erinnerungen.p(c);
            o.put("geraete", l).put("gewaehlt", sp.getString("park_bt", "")).put("name", sp.getString("park_name", ""))
                    .put("hintergrund", android.os.Build.VERSION.SDK_INT < 29 || c.checkSelfPermission("android.permission.ACCESS_BACKGROUND_LOCATION") == android.content.pm.PackageManager.PERMISSION_GRANTED);
            return o.toString();
        } catch (Throwable t) { return "{}"; }
    }

    @JavascriptInterface
    public void parkWaehlen(String adresse, String name) {
        Erinnerungen.p(c).edit().putString("park_bt", adresse == null ? "" : adresse).putString("park_name", name == null ? "" : name).apply();
    }

    /** Bluetooth-Erlaubnis anfragen (Android 12+). */
    @JavascriptInterface
    public void parkBluetoothErlauben() {
        try { if (c instanceof android.app.Activity && android.os.Build.VERSION.SDK_INT >= 31) ((android.app.Activity) c).requestPermissions(new String[]{"android.permission.BLUETOOTH_CONNECT"}, 5); } catch (Throwable ignored) { }
    }

    /** Standort im Hintergrund: Android erlaubt "Immer" nur über die App-Einstellungen. */
    @JavascriptInterface
    public void parkStandortOeffnen() {
        try { c.startActivity(new Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS, android.net.Uri.parse("package:" + c.getPackageName())).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); } catch (Throwable ignored) { }
    }

    /** "Hey Atlas" ein-/ausschalten. Antwort: "an" | "aus" | "kein_mikro". */
    @JavascriptInterface
    public String heyAtlas(boolean an) {
        try {
            if (an && c.checkSelfPermission(android.Manifest.permission.RECORD_AUDIO) != android.content.pm.PackageManager.PERMISSION_GRANTED) return "kein_mikro";
            HeyDienst.setzen(c.getApplicationContext(), an);
            if (an && !android.provider.Settings.canDrawOverlays(c)) { // damit Atlas sich aus dem Hintergrund öffnen darf
                try { c.startActivity(new Intent(android.provider.Settings.ACTION_MANAGE_OVERLAY_PERMISSION, android.net.Uri.parse("package:" + c.getPackageName())).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); } catch (Throwable ignored) { }
            }
            return HeyDienst.an(c) ? "an" : "aus";
        } catch (Throwable t) { return "fehler: " + t.getMessage(); }
    }

    /** Die Seite hat das Mikrofon losgelassen: der Hey-Atlas-Dienst startet sein Zuhören frisch. */
    @JavascriptInterface
    public void heyNeu() {
        try { if (HeyDienst.an(c)) c.getApplicationContext().startForegroundService(new Intent(c, HeyDienst.class).setAction("neu")); } catch (Throwable ignored) { }
    }

    /** JSON {an, ueberlagerung} */
    @JavascriptInterface
    public String heyStand() {
        try { return new JSONObject().put("an", HeyDienst.an(c)).put("ueberlagerung", android.provider.Settings.canDrawOverlays(c)).put("zuletzt", Erinnerungen.p(c).getString("hey_zuletzt", "")).toString(); } catch (Throwable t) { return "{}"; }
    }

    /** Navigation in Google Maps. json: {ziel, modus: auto|zu_fuss|rad|oepnv, url}. Antwort: "ok" | "fehler: ..." */
    @JavascriptInterface
    public String navigation(String json) {
        try {
            JSONObject o = new JSONObject(json);
            String ziel = o.getString("ziel"), modus = o.optString("modus", "auto");
            final Intent i;
            if ("oepnv".equals(modus)) i = new Intent(Intent.ACTION_VIEW, android.net.Uri.parse(o.optString("url", "https://www.google.com/maps/dir/?api=1&destination=" + android.net.Uri.encode(ziel) + "&travelmode=transit")));
            else i = new Intent(Intent.ACTION_VIEW, android.net.Uri.parse("google.navigation:q=" + android.net.Uri.encode(ziel) + "&mode=" + ("zu_fuss".equals(modus) ? "w" : "rad".equals(modus) ? "b" : "d")));
            i.setPackage("com.google.android.apps.maps").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            if (i.resolveActivity(c.getPackageManager()) == null) return "fehler: Google Maps ist nicht installiert";
            new android.os.Handler(android.os.Looper.getMainLooper()).post(() -> { try { c.startActivity(i); } catch (Throwable ignored) { } });
            return "ok";
        } catch (Throwable t) { return "fehler: " + t.getMessage(); }
    }

    /** WhatsApp-Vertretung. json: {an: bool, kontakte: [namen], token: "..."} (jeder Schluessel optional). Antwort: "ok" | "kein_zugriff" | "keine_kontakte" */
    @JavascriptInterface
    public String vertretung(String json) {
        try {
            JSONObject o = new JSONObject(json); android.content.SharedPreferences.Editor e = WhatsAppDienst.p(c).edit();
            if (o.has("token") && o.optString("token").length() > 10) e.putString("token", o.getString("token"));
            if (o.has("kontakte")) e.putString("kontakte", o.getJSONArray("kontakte").toString());
            if (o.has("minuten")) e.putInt("minuten", Math.max(0, Math.min(120, o.getInt("minuten"))));
            String fehler = "";
            if (o.optBoolean("an", false)) {
                if (!WhatsAppDienst.zugriff(c)) fehler = "kein_zugriff";
                else if ((o.has("kontakte") ? o.getJSONArray("kontakte") : new JSONArray(WhatsAppDienst.p(c).getString("kontakte", "[]"))).length() == 0) fehler = "keine_kontakte";
            }
            if (o.has("an")) e.putBoolean("an", o.getBoolean("an") && fehler.isEmpty()); // nur wirklich an, wenn alles da ist
            e.apply();
            return fehler.isEmpty() ? "ok" : fehler;
        } catch (Throwable t) { return "fehler: " + t.getMessage(); }
    }

    /** Stand fuer die Seite: {an, zugriff, kontakte[], gesehen[], log[]} */
    @JavascriptInterface
    public String vertretungStand() {
        try {
            android.content.SharedPreferences pr = WhatsAppDienst.p(c);
            return new JSONObject().put("minuten", pr.getInt("minuten", 5)).put("an", pr.getBoolean("an", false)).put("zugriff", WhatsAppDienst.zugriff(c)).put("kontakte", new JSONArray(pr.getString("kontakte", "[]"))).put("gesehen", new JSONArray(pr.getString("gesehen", "[]"))).put("log", new JSONArray(pr.getString("log", "[]"))).toString();
        } catch (Throwable t) { return "{}"; }
    }

    /** Eingegangene WhatsApp-Nachrichten der letzten 24 Stunden: {zugriff, liste:[{von,text,zeit,gruppe}]} */
    @JavascriptInterface
    public String waNachrichten() { return WhatsAppDienst.inbox(c); }

    /** Antwortet auf die offene WhatsApp-Benachrichtigung dieses Chats: "ok" | "kein_zugriff" | "keine_benachrichtigung" | "fehler: ..." */
    @JavascriptInterface
    public String waSenden(String name, String text) { return WhatsAppDienst.senden(c, name, text); }

    /** Spotify steuern. json: {aktion: abspielen|pause|weiter|naechstes|vorheriges|lauter|leiser, suche, art: kuenstler|lied|album|playlist}. Antwort: "ok" | "keine_spotify" | "fehler: ..." */
    @JavascriptInterface
    public String spotify(String json) {
        try {
            JSONObject o = new JSONObject(json); String a = o.optString("aktion", "");
            android.media.AudioManager am = (android.media.AudioManager) c.getSystemService(Context.AUDIO_SERVICE);
            if (a.equals("lauter") || a.equals("leiser")) {
                for (int i = 0; i < 3; i++) am.adjustStreamVolume(android.media.AudioManager.STREAM_MUSIC, a.equals("lauter") ? android.media.AudioManager.ADJUST_RAISE : android.media.AudioManager.ADJUST_LOWER, i == 2 ? android.media.AudioManager.FLAG_SHOW_UI : 0);
                return "ok";
            }
            if (a.equals("pause") || a.equals("weiter") || a.equals("naechstes") || a.equals("vorheriges")) {
                int code = a.equals("pause") ? android.view.KeyEvent.KEYCODE_MEDIA_PAUSE : a.equals("weiter") ? android.view.KeyEvent.KEYCODE_MEDIA_PLAY : a.equals("naechstes") ? android.view.KeyEvent.KEYCODE_MEDIA_NEXT : android.view.KeyEvent.KEYCODE_MEDIA_PREVIOUS;
                am.dispatchMediaKeyEvent(new android.view.KeyEvent(android.view.KeyEvent.ACTION_DOWN, code));
                am.dispatchMediaKeyEvent(new android.view.KeyEvent(android.view.KeyEvent.ACTION_UP, code));
                return "ok";
            }
            if (a.equals("abspielen")) {
                String q = o.optString("suche", "").trim(), art = o.optString("art", ""); if (q.isEmpty()) return "fehler: nichts zum Abspielen genannt";
                if (c.getPackageManager().getLaunchIntentForPackage("com.spotify.music") == null) return "keine_spotify";
                spotifySpielen(q, art);
                return "ok";
            }
            return "fehler: unbekannte Aktion";
        } catch (Throwable t) { return "fehler: " + t.getMessage(); }
    }

    // Spotify spielt eine Suche, ohne dass der Bildschirm wechselt: ueber die laufende Spotify-Sitzung (Medien-Steuerung).
    // Ist Spotify aus, wird es per Medientaste im Hintergrund geweckt. Klappt das nicht (kein Zugriff auf Benachrichtigungen), oeffnet sich Spotify sichtbar und Atlas kommt danach nach vorn.
    private android.media.session.MediaController spotifySitzung() {
        try {
            android.media.session.MediaSessionManager m = (android.media.session.MediaSessionManager) c.getSystemService(Context.MEDIA_SESSION_SERVICE);
            java.util.List<android.media.session.MediaController> l = m.getActiveSessions(new android.content.ComponentName(c, WhatsAppDienst.class));
            for (android.media.session.MediaController mc : l) if ("com.spotify.music".equals(mc.getPackageName())) return mc;
        } catch (Throwable ignored) { }
        return null;
    }
    private void spotifyAbspielen(android.media.session.MediaController mc, String q, String art) {
        android.os.Bundle ex = new android.os.Bundle();
        String fokus = art.equals("kuenstler") ? "vnd.android.cursor.item/artist" : art.equals("album") ? "vnd.android.cursor.item/album" : art.equals("playlist") ? "vnd.android.cursor.item/playlist" : art.equals("lied") ? "vnd.android.cursor.item/audio" : "vnd.android.cursor.item/*";
        ex.putString(android.provider.MediaStore.EXTRA_MEDIA_FOCUS, fokus);
        if (art.equals("kuenstler")) ex.putString(android.provider.MediaStore.EXTRA_MEDIA_ARTIST, q); else if (art.equals("lied")) ex.putString(android.provider.MediaStore.EXTRA_MEDIA_TITLE, q); else if (art.equals("album")) ex.putString(android.provider.MediaStore.EXTRA_MEDIA_ALBUM, q);
        mc.getTransportControls().playFromSearch(q, ex);
    }
    private void spotifySpielen(final String q, final String art) {
        final android.os.Handler h = new android.os.Handler(android.os.Looper.getMainLooper());
        h.post(() -> {
            android.media.session.MediaController mc = spotifySitzung();
            if (mc != null) { spotifyAbspielen(mc, q, art); return; }
            try { // Spotify im Hintergrund wecken (Medientaste)
                Intent mb = new Intent(Intent.ACTION_MEDIA_BUTTON).setPackage("com.spotify.music");
                mb.putExtra(Intent.EXTRA_KEY_EVENT, new android.view.KeyEvent(android.view.KeyEvent.ACTION_DOWN, android.view.KeyEvent.KEYCODE_MEDIA_PLAY)); c.sendBroadcast(mb);
                mb = new Intent(Intent.ACTION_MEDIA_BUTTON).setPackage("com.spotify.music");
                mb.putExtra(Intent.EXTRA_KEY_EVENT, new android.view.KeyEvent(android.view.KeyEvent.ACTION_UP, android.view.KeyEvent.KEYCODE_MEDIA_PLAY)); c.sendBroadcast(mb);
            } catch (Throwable ignored) { }
            final int[] versuch = { 0 };
            h.postDelayed(new Runnable() { public void run() {
                android.media.session.MediaController m2 = spotifySitzung();
                if (m2 != null) { spotifyAbspielen(m2, q, art); return; }
                if (++versuch[0] < 6) { h.postDelayed(this, 1000); return; }
                try { // Notloesung: Spotify sichtbar oeffnen, danach zurueck zu Atlas
                    Intent i = new Intent(android.provider.MediaStore.INTENT_ACTION_MEDIA_PLAY_FROM_SEARCH).setPackage("com.spotify.music").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    i.putExtra(android.app.SearchManager.QUERY, q);
                    c.startActivity(i);
                    h.postDelayed(() -> { try { c.startActivity(new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT | Intent.FLAG_ACTIVITY_SINGLE_TOP)); } catch (Throwable ignored) { } }, 3500);
                } catch (Throwable ignored) { }
            } }, 1000);
        });
    }

    /** Version dieser App: {"code": Bau-Nummer, "repo": "besitzer/projekt"} (fuer die Update-Meldung) */
    @JavascriptInterface
    public String version() {
        try { return new JSONObject().put("code", c.getPackageManager().getPackageInfo(c.getPackageName(), 0).versionCode).put("repo", Konfig.REPO).toString(); } catch (Throwable t) { return "{}"; }
    }

    /** Oeffnet eine https-Adresse im Browser (Download der neuen APK) */
    @JavascriptInterface
    public void oeffnen(String url) {
        try { if (url != null && url.startsWith("https://")) c.startActivity(new Intent(Intent.ACTION_VIEW, android.net.Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); } catch (Throwable ignored) { }
    }

    /** Oeffnet die Handy-Einstellung "Zugriff auf Benachrichtigungen" */
    @JavascriptInterface
    public void zugriffOeffnen() {
        try { Intent i = new Intent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); c.startActivity(i); } catch (Throwable ignored) { }
    }

    /** json: {aktion: "stellen"|"loeschen", zeit, wdh, name} oder {aktion: "mehrere", liste: [ ... ]} (nacheinander, mit Pause dazwischen) */
    @JavascriptInterface
    public String wecker(String json) {
        try {
            JSONObject o = new JSONObject(json);
            if ("mehrere".equals(o.optString("aktion"))) {
                final JSONArray l = o.getJSONArray("liste");
                final android.os.Handler h = new android.os.Handler(android.os.Looper.getMainLooper());
                for (int k = 0; k < l.length(); k++) {
                    final JSONObject e = l.getJSONObject(k);
                    h.postDelayed(() -> { try { senden(e); } catch (Throwable ignored) { } }, k * 1500L);
                }
                return "ok";
            }
            return senden(o);
        } catch (Throwable e) {
            return "fehler: " + e.getMessage();
        }
    }

    private String senden(JSONObject o) throws Exception {
        String[] hm = o.getString("zeit").split(":");
        int h = Integer.parseInt(hm[0]), m = Integer.parseInt(hm[1]);
        String wdh = o.optString("wdh", ""), name = o.optString("name", "");
        Intent i;
        if ("loeschen".equals(o.optString("aktion"))) {
            // Android 16: eigener Befehl zum Loeschen. Aeltere/andere Uhr-Apps kennen nur "Abstellen" (klingelnden Wecker beenden).
            i = new Intent("android.intent.action.DELETE_ALARM")
                    .putExtra(AlarmClock.EXTRA_ALARM_SEARCH_MODE, AlarmClock.ALARM_SEARCH_MODE_TIME)
                    .putExtra(AlarmClock.EXTRA_HOUR, h).putExtra(AlarmClock.EXTRA_MINUTES, m);
            if (i.resolveActivity(c.getPackageManager()) == null) {
                i = new Intent(AlarmClock.ACTION_DISMISS_ALARM)
                        .putExtra(AlarmClock.EXTRA_ALARM_SEARCH_MODE, AlarmClock.ALARM_SEARCH_MODE_TIME)
                        .putExtra(AlarmClock.EXTRA_HOUR, h).putExtra(AlarmClock.EXTRA_MINUTES, m);
            }
        } else {
            i = new Intent(AlarmClock.ACTION_SET_ALARM)
                    .putExtra(AlarmClock.EXTRA_HOUR, h).putExtra(AlarmClock.EXTRA_MINUTES, m)
                    .putExtra(AlarmClock.EXTRA_MESSAGE, name.isEmpty() ? "Atlas" : name)
                    .putExtra(AlarmClock.EXTRA_SKIP_UI, true);
            if ("taeglich".equals(wdh) || "werktags".equals(wdh)) {
                ArrayList<Integer> tage = new ArrayList<>();
                tage.add(Calendar.MONDAY); tage.add(Calendar.TUESDAY); tage.add(Calendar.WEDNESDAY); tage.add(Calendar.THURSDAY); tage.add(Calendar.FRIDAY);
                if ("taeglich".equals(wdh)) { tage.add(Calendar.SATURDAY); tage.add(Calendar.SUNDAY); }
                i.putExtra(AlarmClock.EXTRA_DAYS, tage);
            }
        }
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        if (i.resolveActivity(c.getPackageManager()) == null) return "fehler: keine Uhr-App gefunden, die Wecker annimmt";
        final Intent start = i;
        final String meldung = "Wecker " + o.getString("zeit") + ("loeschen".equals(o.optString("aktion")) ? " an die Uhr-App zum Ausschalten übergeben" : " an die Uhr-App übergeben");
        if (c instanceof android.app.Activity) {
            ((android.app.Activity) c).runOnUiThread(() -> {
                try { c.startActivity(start); android.widget.Toast.makeText(c, meldung, android.widget.Toast.LENGTH_SHORT).show(); }
                catch (Throwable e) { android.widget.Toast.makeText(c, "Wecker fehlgeschlagen: " + e.getMessage(), android.widget.Toast.LENGTH_LONG).show(); }
            });
        } else c.startActivity(i);
        return "ok";
    }
}
