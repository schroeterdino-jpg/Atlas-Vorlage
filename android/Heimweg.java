package de.beispiel.atlas;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/** Heimweg-Hinweis: kurz vor Schichtende holt die App Fahrzeit und Verkehr von Atlas und zeigt eine Benachrichtigung (auch bei geschlossener App). */
final class Heimweg {
    static final String KANAL = "heimweg", AKTION = "de.beispiel.atlas.HEIMWEG";

    private Heimweg() { }

    static PendingIntent pi(Context c, String zeit) {
        Intent i = new Intent(c, ErinnerungReceiver.class).setAction(AKTION).putExtra("zeit", zeit);
        i.setData(android.net.Uri.parse("atlas://heimweg/" + zeit));
        return PendingIntent.getBroadcast(c, 0, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** json: [{zeit "yyyy-MM-ddTHH:mm", art}] */
    static void sync(Context c, String json) {
        try {
            AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
            SharedPreferences sp = Erinnerungen.p(c);
            try { JSONArray alt = new JSONArray(sp.getString("heimweg", "[]")); for (int i = 0; i < alt.length(); i++) am.cancel(pi(c, alt.getJSONObject(i).getString("zeit"))); } catch (Throwable ignored) { }
            sp.edit().putString("heimweg", new JSONArray(json).toString()).apply();
            planen(c);
        } catch (Throwable ignored) { }
    }

    static void planen(Context c) {
        try {
            AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
            JSONArray l = new JSONArray(Erinnerungen.p(c).getString("heimweg", "[]"));
            long jetzt = System.currentTimeMillis();
            for (int i = 0; i < l.length(); i++) {
                String z = l.getJSONObject(i).optString("zeit"); long t = Erinnerungen.zeitMs(z);
                if (t <= jetzt) continue;
                try { am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, t, pi(c, z)); }
                catch (SecurityException e) { am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, t, pi(c, z)); }
            }
        } catch (Throwable ignored) { }
    }

    /** Alarm ist da: Daten holen (im Hintergrund) und anzeigen. */
    static void zeigen(final Context c, final android.content.BroadcastReceiver.PendingResult pr) {
        new Thread(() -> {
            String titel = "Heimweg", text = "Verkehr gerade nicht abrufbar. Google Maps zeigt ihn dir.";
            try {
                String token = c.getSharedPreferences(WhatsAppDienst.PREFS, Context.MODE_PRIVATE).getString("token", "");
                if (!token.isEmpty()) {
                    HttpURLConnection h = (HttpURLConnection) new URL(MainActivity.ATLAS_URL + "api/heimweg").openConnection();
                    h.setRequestMethod("POST"); h.setConnectTimeout(15000); h.setReadTimeout(25000); h.setDoOutput(true);
                    h.setRequestProperty("Content-Type", "application/json"); h.setRequestProperty("x-atlas-s", token);
                    OutputStream o = h.getOutputStream(); o.write("{}".getBytes("UTF-8")); o.close();
                    java.io.InputStream is = h.getResponseCode() < 400 ? h.getInputStream() : h.getErrorStream();
                    java.io.ByteArrayOutputStream bo = new java.io.ByteArrayOutputStream(); byte[] buf = new byte[4096]; int k;
                    while ((k = is.read(buf)) > 0) bo.write(buf, 0, k);
                    JSONObject r = new JSONObject(bo.toString("UTF-8"));
                    if (r.optBoolean("ok")) { titel = r.optString("titel", titel); text = r.optString("text", text); }
                } else text = "Bitte Atlas einmal öffnen, damit der Heimweg-Hinweis funktioniert.";
            } catch (Throwable ignored) { }
            try {
                NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
                nm.createNotificationChannel(new NotificationChannel(KANAL, "Heimweg", NotificationManager.IMPORTANCE_HIGH));
                PendingIntent oeffnen = PendingIntent.getActivity(c, 2, new Intent(c, MainActivity.class), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
                android.app.Notification n = new android.app.Notification.Builder(c, KANAL).setSmallIcon(android.R.drawable.ic_menu_directions).setContentTitle(titel).setContentText(text.split("\n")[0])
                        .setStyle(new android.app.Notification.BigTextStyle().bigText(text)).setAutoCancel(true).setContentIntent(oeffnen).build();
                nm.notify(7001, n);
            } catch (Throwable ignored) { }
            try { if (pr != null) pr.finish(); } catch (Throwable ignored) { }
        }).start();
    }
}
