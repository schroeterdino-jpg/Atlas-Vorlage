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

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

/** Erinnerungen aus Atlas als Benachrichtigung auf dem Handy, auch wenn die App geschlossen ist. */
final class Erinnerungen {
    static final String KANAL = "erinnerung", AKTION = "de.beispiel.atlas.ERINNERUNG";

    private Erinnerungen() { }

    static SharedPreferences p(Context c) { return c.getSharedPreferences("atlas", Context.MODE_PRIVATE); }

    static long zeitMs(String z) {
        try { return new SimpleDateFormat("yyyy-MM-dd'T'HH:mm", Locale.GERMANY).parse(z).getTime(); } catch (Throwable e) { return 0; }
    }

    static PendingIntent pi(Context c, String id, String text) {
        Intent i = new Intent(c, ErinnerungReceiver.class).setAction(AKTION).putExtra("id", id).putExtra("text", text);
        i.setData(android.net.Uri.parse("atlas://erinnerung/" + id)); // pro Erinnerung ein eigener Alarm
        return PendingIntent.getBroadcast(c, 0, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** Neue Liste uebernehmen: alte Alarme weg, neue setzen. Schon faellige, noch nicht gemeldete kommen sofort. */
    static void sync(Context c, String json) {
        try {
            JSONArray neu = new JSONArray(json);
            AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
            SharedPreferences sp = p(c);
            try { // alte Alarme abbrechen
                JSONArray alt = new JSONArray(sp.getString("erinnerungen", "[]"));
                for (int i = 0; i < alt.length(); i++) { JSONObject o = alt.getJSONObject(i); am.cancel(pi(c, o.getString("id"), o.optString("text"))); }
            } catch (Throwable ignored) { }
            sp.edit().putString("erinnerungen", neu.toString()).apply();
            planen(c);
            meldung(c, neu);
        } catch (Throwable ignored) { }
    }

    /** Kurze Rueckmeldung auf dem Bildschirm: wann die naechste Erinnerung kommt, oder warum sie nicht kommen kann. */
    static void meldung(final Context c, JSONArray neu) {
        try {
            if (neu.length() == 0) return;
            long jetzt = System.currentTimeMillis(), naechste = 0;
            for (int i = 0; i < neu.length(); i++) { long t = zeitMs(neu.getJSONObject(i).optString("zeit")); if (t > jetzt && (naechste == 0 || t < naechste)) naechste = t; }
            if (naechste == 0) return;
            String text;
            NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
            AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
            if (!nm.areNotificationsEnabled()) text = "Atlas darf keine Benachrichtigungen zeigen. Bitte in den Handy-Einstellungen (Apps > Atlas > Benachrichtigungen) erlauben.";
            else if (android.os.Build.VERSION.SDK_INT >= 31 && !am.canScheduleExactAlarms()) text = "Atlas darf keine genauen Alarme setzen. Bitte in den Handy-Einstellungen (Apps > Atlas > Wecker und Erinnerungen) erlauben.";
            else text = "Erinnerung geplant für " + new SimpleDateFormat("HH:mm", Locale.GERMANY).format(new Date(naechste)) + " Uhr";
            final String t = text;
            new android.os.Handler(android.os.Looper.getMainLooper()).post(() -> android.widget.Toast.makeText(c, t, android.widget.Toast.LENGTH_LONG).show());
        } catch (Throwable ignored) { }
    }

    static void planen(Context c) {
        try {
            AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
            SharedPreferences sp = p(c);
            Set<String> gemeldet = new HashSet<>(sp.getStringSet("gemeldet", new HashSet<String>()));
            JSONArray l = new JSONArray(sp.getString("erinnerungen", "[]"));
            long jetzt = System.currentTimeMillis();
            for (int i = 0; i < l.length(); i++) {
                JSONObject o = l.getJSONObject(i);
                String id = o.getString("id"), text = o.optString("text");
                long t = zeitMs(o.optString("zeit"));
                if (t == 0 || gemeldet.contains(id)) continue;
                if (t <= jetzt) { zeigen(c, id, text); continue; }
                try { am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, t, pi(c, id, text)); }
                catch (SecurityException e) { am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, t, pi(c, id, text)); }
            }
        } catch (Throwable ignored) { }
    }

    static void zeigen(Context c, String id, String text) {
        SharedPreferences sp = p(c);
        Set<String> g = new HashSet<>(sp.getStringSet("gemeldet", new HashSet<String>()));
        if (!g.add(id)) return; // jede Erinnerung nur einmal
        if (g.size() > 200) g.clear();
        sp.edit().putStringSet("gemeldet", g).apply();
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        NotificationChannel k = new NotificationChannel(KANAL, "Erinnerungen", NotificationManager.IMPORTANCE_HIGH);
        nm.createNotificationChannel(k);
        PendingIntent oeffnen = PendingIntent.getActivity(c, 1, new Intent(c, MainActivity.class), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        android.app.Notification n = new android.app.Notification.Builder(c, KANAL)
                .setSmallIcon(android.R.drawable.ic_popup_reminder)
                .setContentTitle("Erinnerung")
                .setContentText(text)
                .setStyle(new android.app.Notification.BigTextStyle().bigText(text))
                .setCategory(android.app.Notification.CATEGORY_REMINDER)
                .setAutoCancel(true)
                .setContentIntent(oeffnen)
                .build();
        nm.notify(id.hashCode(), n);
        try { // Bildschirm kurz einschalten, damit man die Erinnerung sieht
            android.os.PowerManager pm = (android.os.PowerManager) c.getSystemService(Context.POWER_SERVICE);
            if (!pm.isInteractive()) {
                android.os.PowerManager.WakeLock wl = pm.newWakeLock(android.os.PowerManager.SCREEN_BRIGHT_WAKE_LOCK | android.os.PowerManager.ACQUIRE_CAUSES_WAKEUP | android.os.PowerManager.ON_AFTER_RELEASE, "atlas:erinnerung");
                wl.acquire(8000);
            }
        } catch (Throwable ignored) { }
    }
}
