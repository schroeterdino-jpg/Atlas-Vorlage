package de.beispiel.atlas;

import android.app.Notification;
import android.app.PendingIntent;
import android.app.RemoteInput;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * WhatsApp-Vertretung: liest eingehende WhatsApp-Benachrichtigungen. Ist die Vertretung an und der Absender
 * ausgewaehlt, holt sie die Antwort von Atlas und schickt sie ueber die "Antworten"-Schaltflaeche der Benachrichtigung.
 * Gruppen werden nie beantwortet.
 */
public class WhatsAppDienst extends NotificationListenerService {
    static final String PREFS = "vertretung";

    static SharedPreferences p(Context c) { return c.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE); }

    static volatile WhatsAppDienst ich;
    @Override public void onListenerConnected() { ich = this; }
    @Override public void onListenerDisconnected() { if (ich == this) ich = null; }

    private final android.os.Handler handler = new android.os.Handler(android.os.Looper.getMainLooper());
    private final java.util.Map<String, Runnable> wartend = new java.util.HashMap<>();

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        try {
            String pk = sbn.getPackageName();
            if (!"com.whatsapp".equals(pk) && !"com.whatsapp.w4b".equals(pk)) return;
            Notification n = sbn.getNotification();
            if ((n.flags & Notification.FLAG_GROUP_SUMMARY) != 0) return;
            Bundle ex = n.extras;
            if (ex == null) return;
            merkeNachricht(this, ex);
            if (ex.getBoolean("android.isGroupConversation", false)) return;
            CharSequence t = ex.getCharSequence("android.title"), x = ex.getCharSequence("android.text");
            if (t == null || x == null) return;
            final String von = t.toString().trim(), text = x.toString().trim();
            if (von.isEmpty() || text.isEmpty() || von.equalsIgnoreCase("whatsapp") || von.contains(" neue Nachrichten") || von.contains(":")) return;
            merkeGesehen(this, von);
            final SharedPreferences pr = p(this);
            if (!pr.getBoolean("an", false) || !enthalten(pr.getString("kontakte", "[]"), von)) return;
            if (text.startsWith("Du:") || text.startsWith("You:")) return;
            final String vk = von.toLowerCase();
            synchronized (wartend) { if (wartend.containsKey(vk)) return; } // es laeuft schon ein Timer fuer diesen Kontakt: er nimmt beim Ablauf die neueste Nachricht
            long min = pr.getInt("minuten", 5);
            Runnable r = () -> { synchronized (wartend) { wartend.remove(vk); } antworten(von); };
            synchronized (wartend) { wartend.put(vk, r); }
            handler.postDelayed(r, min * 60000L + 1500L);
        } catch (Throwable ignored) { }
    }

    /** Nach der Wartezeit: gibt es die Benachrichtigung dieses Kontakts noch? Dann hat Sam nicht selbst reagiert. */
    private void antworten(final String von) {
        try {
            final SharedPreferences pr = p(this);
            if (!pr.getBoolean("an", false)) return;
            Notification.Action ziel = null; RemoteInput[] ri = null; String text = null;
            StatusBarNotification[] akt = getActiveNotifications();
            if (akt != null) for (StatusBarNotification q : akt) {
                if (!"com.whatsapp".equals(q.getPackageName()) && !"com.whatsapp.w4b".equals(q.getPackageName())) continue;
                Notification n = q.getNotification(); if (n.extras == null || n.extras.getBoolean("android.isGroupConversation", false)) continue;
                CharSequence t = n.extras.getCharSequence("android.title"), x = n.extras.getCharSequence("android.text");
                if (t == null || x == null || !t.toString().trim().equalsIgnoreCase(von)) continue;
                String tx = x.toString().trim(); if (tx.startsWith("Du:") || tx.startsWith("You:")) continue;
                if (n.actions != null) for (Notification.Action a : n.actions) { RemoteInput[] r = a.getRemoteInputs(); if (r != null && r.length > 0 && a.actionIntent != null) { ziel = a; ri = r; text = tx; break; } }
                if (ziel != null) break;
            }
            if (ziel == null) { protokoll(this, von, "", "(nicht beantwortet: Sam hat die Nachricht selbst gelesen oder beantwortet)"); return; }
            long jetzt = System.currentTimeMillis(); String zk = "z_" + von.toLowerCase();
            StringBuilder neu = new StringBuilder(); int anz = 0;
            for (String z : pr.getString(zk, "").split(",")) { try { long l = Long.parseLong(z); if (jetzt - l < 3600000L) { anz++; neu.append(l).append(','); } } catch (Throwable ignored) { } }
            if (anz >= 6) { protokoll(this, von, text, "(nicht beantwortet: schon 6 Antworten in der letzten Stunde)"); return; }
            final boolean erste = jetzt - pr.getLong("l_" + von.toLowerCase(), 0) > 6 * 3600000L;
            final Context c = getApplicationContext(); final Notification.Action za = ziel; final RemoteInput[] zr = ri; final String zkey = zk, vorher = neu.toString(), tx = text;
            new Thread(() -> {
                try {
                    String token = pr.getString("token", "");
                    if (token.isEmpty()) { protokoll(c, von, tx, "(Fehler: Atlas bitte einmal oeffnen, damit die Anmeldung gespeichert wird)"); return; }
                    JSONObject b = new JSONObject().put("von", von).put("text", tx).put("erste", erste);
                    HttpURLConnection h = (HttpURLConnection) new URL(MainActivity.ATLAS_URL + "api/vertretung").openConnection();
                    h.setRequestMethod("POST"); h.setConnectTimeout(15000); h.setReadTimeout(30000); h.setDoOutput(true);
                    h.setRequestProperty("Content-Type", "application/json"); h.setRequestProperty("x-atlas-s", token);
                    OutputStream o = h.getOutputStream(); o.write(b.toString().getBytes("UTF-8")); o.close();
                    java.io.InputStream is = h.getResponseCode() < 400 ? h.getInputStream() : h.getErrorStream();
                    java.io.ByteArrayOutputStream bo = new java.io.ByteArrayOutputStream(); byte[] buf = new byte[4096]; int k;
                    while ((k = is.read(buf)) > 0) bo.write(buf, 0, k);
                    JSONObject r = new JSONObject(bo.toString("UTF-8"));
                    if (!r.optBoolean("ok")) { protokoll(c, von, tx, "(Fehler: " + r.optString("fehler", "unbekannt") + ")"); return; }
                    String antwort = r.getString("antwort");
                    Intent in = new Intent(); Bundle bu = new Bundle();
                    for (RemoteInput q : zr) bu.putCharSequence(q.getResultKey(), antwort);
                    RemoteInput.addResultsToIntent(zr, in, bu);
                    za.actionIntent.send(c, 0, in);
                    long t2 = System.currentTimeMillis();
                    pr.edit().putString(zkey, vorher + t2).putLong("l_" + von.toLowerCase(), t2).apply();
                    protokoll(c, von, tx, antwort);
                } catch (Throwable e) { protokoll(c, von, tx, "(Fehler: " + e.getMessage() + ")"); }
            }).start();
        } catch (Throwable e) { protokoll(this, von, "", "(Fehler: " + e.getMessage() + ")"); }
    }

    /** Merkt jede eingehende WhatsApp-Nachricht (auch Gruppen) fuer "Was hat X geschrieben?". Nur auf dem Handy, bis Sam fragt. */
    static void merkeNachricht(Context c, Bundle ex) {
        try {
            CharSequence t = ex.getCharSequence("android.title"), x = ex.getCharSequence("android.text");
            if (t == null || x == null) return;
            String von = t.toString().trim(), text = x.toString().trim();
            if (von.isEmpty() || text.isEmpty() || von.equalsIgnoreCase("whatsapp") || von.contains(" neue Nachrichten") || text.matches("\\d+ neue Nachrichten.*")) return;
            if (text.startsWith("Du:") || text.startsWith("You:")) return;
            synchronized (WhatsAppDienst.class) {
                SharedPreferences pr = p(c); JSONArray a = new JSONArray(pr.getString("inbox", "[]")); JSONArray n = new JSONArray();
                long jetzt = System.currentTimeMillis();
                for (int i = 0; i < Math.min(a.length(), 6); i++) { JSONObject o = a.getJSONObject(i); if (o.optString("von").equals(von) && o.optString("text").equals(text)) return; }
                n.put(new JSONObject().put("von", von).put("text", text.length() > 300 ? text.substring(0, 300) : text).put("zeit", jetzt).put("gruppe", ex.getBoolean("android.isGroupConversation", false)));
                for (int i = 0; i < a.length() && n.length() < 40; i++) { JSONObject o = a.getJSONObject(i); if (jetzt - o.optLong("zeit") < 24 * 3600000L) n.put(o); }
                pr.edit().putString("inbox", n.toString()).apply();
            }
        } catch (Throwable ignored) { }
    }

    /** {zugriff, liste: [{von, text, zeit, gruppe}]} der letzten 24 Stunden, neueste zuerst */
    static String inbox(Context c) {
        try {
            JSONArray a = new JSONArray(p(c).getString("inbox", "[]")), n = new JSONArray(); long jetzt = System.currentTimeMillis();
            for (int i = 0; i < a.length() && n.length() < 20; i++) if (jetzt - a.getJSONObject(i).optLong("zeit") < 24 * 3600000L) n.put(a.get(i));
            return new JSONObject().put("zugriff", zugriff(c)).put("liste", n).toString();
        } catch (Throwable t) { return "{\"zugriff\":false,\"liste\":[]}"; }
    }

    /** Antwortet auf die noch offene Benachrichtigung dieses Chats. Antwort: "ok" | "kein_zugriff" | "keine_benachrichtigung" | "fehler: ..." */
    static String senden(Context c, String name, String text) {
        try {
            WhatsAppDienst d = ich; if (d == null || !zugriff(c)) return "kein_zugriff";
            StatusBarNotification[] akt = d.getActiveNotifications(); if (akt == null) return "keine_benachrichtigung";
            String nk = name.trim().toLowerCase();
            for (int pass = 0; pass < 2; pass++) for (StatusBarNotification q : akt) {
                if (!"com.whatsapp".equals(q.getPackageName()) && !"com.whatsapp.w4b".equals(q.getPackageName())) continue;
                Notification n = q.getNotification(); if (n.extras == null || (n.flags & Notification.FLAG_GROUP_SUMMARY) != 0) continue;
                CharSequence t = n.extras.getCharSequence("android.title"); if (t == null) continue;
                String tk = t.toString().trim().toLowerCase();
                if (pass == 0 ? !tk.equals(nk) : !(tk.contains(nk) || nk.contains(tk))) continue;
                if (n.actions == null) continue;
                for (Notification.Action a : n.actions) {
                    RemoteInput[] r = a.getRemoteInputs();
                    if (r != null && r.length > 0 && a.actionIntent != null) {
                        Intent in = new Intent(); Bundle bu = new Bundle();
                        for (RemoteInput ri : r) bu.putCharSequence(ri.getResultKey(), text);
                        RemoteInput.addResultsToIntent(r, in, bu);
                        a.actionIntent.send(c.getApplicationContext(), 0, in);
                        return "ok";
                    }
                }
            }
            return "keine_benachrichtigung";
        } catch (Throwable e) { return "fehler: " + e.getMessage(); }
    }

    static boolean enthalten(String json, String name) {
        try { JSONArray a = new JSONArray(json); for (int i = 0; i < a.length(); i++) if (a.getString(i).trim().equalsIgnoreCase(name.trim())) return true; } catch (Throwable ignored) { }
        return false;
    }

    static void merkeGesehen(Context c, String name) {
        try {
            SharedPreferences pr = p(c); JSONArray a = new JSONArray(pr.getString("gesehen", "[]")); JSONArray n = new JSONArray(); n.put(name);
            for (int i = 0; i < a.length() && n.length() < 30; i++) if (!a.getString(i).equalsIgnoreCase(name)) n.put(a.getString(i));
            pr.edit().putString("gesehen", n.toString()).apply();
        } catch (Throwable ignored) { }
    }

    static void protokoll(Context c, String von, String text, String antwort) {
        try {
            SharedPreferences pr = p(c); JSONArray a = new JSONArray(pr.getString("log", "[]")); JSONArray n = new JSONArray();
            n.put(new JSONObject().put("zeit", System.currentTimeMillis()).put("von", von).put("text", text.length() > 120 ? text.substring(0, 120) : text).put("antwort", antwort));
            for (int i = 0; i < a.length() && n.length() < 30; i++) n.put(a.get(i));
            pr.edit().putString("log", n.toString()).apply();
        } catch (Throwable ignored) { }
    }

    static boolean zugriff(Context c) {
        String s = android.provider.Settings.Secure.getString(c.getContentResolver(), "enabled_notification_listeners");
        return s != null && s.contains(c.getPackageName());
    }
}
