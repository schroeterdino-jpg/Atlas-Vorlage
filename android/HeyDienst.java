package de.beispiel.atlas;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.AudioManager;
import android.media.ToneGenerator;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;

import org.json.JSONObject;
import org.vosk.Model;
import org.vosk.Recognizer;
import org.vosk.android.RecognitionListener;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.Locale;

/** "Hey Atlas": Hintergrunddienst mit Mikrofon. Erkennt den Weckruf offline (Vosk, kleines Modell) und holt Atlas nach vorn. Nur wenn der Schalter an ist. */
public class HeyDienst extends Service implements RecognitionListener {
    static final String KANAL = "hey", KANAL_WACH = "heywach";
    private final Handler main = new Handler(Looper.getMainLooper());
    private Model model;
    private GatedSpeech speech;
    private boolean laedt = false, lebt = false;
    private long letzter = 0;

    static boolean an(Context c) { return Erinnerungen.p(c).getBoolean("hey", false); }

    static void setzen(Context c, boolean an) {
        Erinnerungen.p(c).edit().putBoolean("hey", an).apply();
        Intent i = new Intent(c, HeyDienst.class);
        try { if (an) c.startForegroundService(i); else c.stopService(i); } catch (Throwable ignored) { }
    }

    @Override public void onCreate() {
        super.onCreate();
        lebt = true;
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        nm.createNotificationChannel(new NotificationChannel(KANAL, "Hey Atlas (hört zu)", NotificationManager.IMPORTANCE_LOW));
        nm.createNotificationChannel(new NotificationChannel(KANAL_WACH, "Hey Atlas erkannt", NotificationManager.IMPORTANCE_HIGH));
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        PendingIntent pi = PendingIntent.getActivity(this, 0, new Intent(this, MainActivity.class), PendingIntent.FLAG_IMMUTABLE);
        Notification n = new Notification.Builder(this, KANAL).setSmallIcon(android.R.drawable.ic_btn_speak_now).setContentTitle("Hey Atlas hört zu")
                .setContentText("Sag \"Hey Atlas\". Ausschalten in der Atlas-App.").setContentIntent(pi).setOngoing(true).build();
        try { startForeground(5001, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE); }
        catch (Throwable e) { stopSelf(); return START_NOT_STICKY; }
        if (!an(this)) { stopSelf(); return START_NOT_STICKY; }
        modellLaden();
        if (intent != null && "neu".equals(intent.getAction())) pauseStart = 0;
        if (intent != null && "neu".equals(intent.getAction())) main.postDelayed(() -> { stoppeLauschen(); if (model != null && an(this)) starteLauschen(); }, 400); // Seite hat das Mikrofon losgelassen: frisch zuhören
        main.removeCallbacks(takt); main.postDelayed(takt, 1500);
        return START_STICKY;
    }

    /** Alle 2 Sekunden: nur lauschen, wenn Atlas nicht selbst offen ist (sonst braucht die Seite das Mikrofon). */
    /** Seit wann das Mikrofon der Seite gehoert (0 = nicht). Endet mit "neu" (Seite fertig), nach 15 s ohne sichtbares Atlas oder nach 90 s. */
    private long pauseStart = 0;
    private boolean pausiert() {
        if (pauseStart == 0) return false;
        long d = System.currentTimeMillis() - pauseStart;
        if (d > 90000 || (d > 15000 && !MainActivity.sichtbar)) pauseStart = 0;
        return pauseStart != 0;
    }

    private final Runnable takt = new Runnable() {
        @Override public void run() {
            if (!lebt) return;
            boolean will = model != null && an(HeyDienst.this) && !pausiert();
            if (will && speech == null) starteLauschen();
            else if (!will && speech != null) stoppeLauschen();
            main.postDelayed(this, 2000);
        }
    };

    private void modellLaden() {
        if (laedt || model != null) return;
        laedt = true;
        new Thread(() -> {
            try {
                File dir = new File(getFilesDir(), "model"), marker = new File(dir, ".fertig");
                if (!marker.exists()) { loesche(dir); kopiere("model", dir); new FileOutputStream(marker).close(); }
                final Model m = new Model(dir.getAbsolutePath());
                main.post(() -> { laedt = false; if (!lebt) m.close(); else model = m; });
            } catch (Throwable e) { laedt = false; }
        }).start();
    }

    private void starteLauschen() {
        try {
            Recognizer rec = new Recognizer(model, 16000.0f, "[\"hey atlas\", \"hey\", \"okay\", \"hello\", \"hi there\", \"hey siri\", \"hey google\", \"hey alexa\", \"[unk]\"]");
            rec.setWords(true);
            speech = new GatedSpeech(this, rec, 16000.0f);
            speech.startListening(this);
        } catch (Throwable e) { speech = null; }
    }

    private void stoppeLauschen() {
        GatedSpeech s = speech; speech = null;
        if (s != null) { try { s.stop(); s.shutdown(); } catch (Throwable ignored) { } }
    }

    @Override public void onResult(String json) {
        try {
            JSONObject o = new JSONObject(json);
            String text = o.optString("text", "").toLowerCase(Locale.ROOT).trim();
            if (text.isEmpty() || text.equals("[unk]")) return;
            double min = 1.0; org.json.JSONArray ws = o.optJSONArray("result");
            if (ws != null) for (int k = 0; k < ws.length(); k++) min = Math.min(min, ws.getJSONObject(k).optDouble("conf", 1.0));
            boolean passt = text.equals("hey atlas") && min >= 0.55;
            Erinnerungen.p(this).edit().putString("hey_zuletzt", (passt ? "erkannt: " : "abgelehnt: ") + text + " (" + String.format(Locale.US, "%.2f", min) + ") " + new java.text.SimpleDateFormat("HH:mm:ss", Locale.GERMANY).format(new java.util.Date())).apply();
            if (passt) erkannt();
        } catch (Throwable ignored) { }
    }

    private void erkannt() {
        long jetzt = System.currentTimeMillis();
        if (jetzt - letzter < 5000) return;
        letzter = jetzt;
        final MainActivity offen = MainActivity.sichtbar ? MainActivity.aktuell : null;
        pauseStart = System.currentTimeMillis(); stoppeLauschen(); // das Mikrofon gehoert jetzt der Seite, bis sie fertig ist ("neu")
        try { new ToneGenerator(AudioManager.STREAM_NOTIFICATION, 80).startTone(ToneGenerator.TONE_PROP_BEEP, 150); } catch (Throwable ignored) { }
        boolean gesperrt = false;
        try {
            PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
            android.app.KeyguardManager km = (android.app.KeyguardManager) getSystemService(KEYGUARD_SERVICE);
            gesperrt = !pm.isInteractive() || km.isKeyguardLocked();
            if (gesperrt) { @SuppressWarnings("deprecation") PowerManager.WakeLock w = pm.newWakeLock(PowerManager.SCREEN_BRIGHT_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP | PowerManager.ON_AFTER_RELEASE, "atlas:wach"); w.acquire(15000); }
        } catch (Throwable ignored) { }
        final boolean gs = gesperrt;
        if (offen != null) { offen.weckenJetzt(); return; }   // Atlas ist schon offen: nur zuhören lassen
        MainActivity.wach = true;
        final boolean ueberlagerung = android.provider.Settings.canDrawOverlays(this);
        final Intent i = new Intent(this, MainActivity.class).putExtra("wake", true).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        // Android 15 erlaubt das Öffnen aus dem Hintergrund nur, wenn die App ein sichtbares Fenster hat: ein winziges, unsichtbares Fenster genügt
        android.view.View punkt = null; final android.view.WindowManager wm = (android.view.WindowManager) getSystemService(WINDOW_SERVICE);
        if (ueberlagerung) {
            try {
                punkt = new android.view.View(this);
                android.view.WindowManager.LayoutParams lp = new android.view.WindowManager.LayoutParams(1, 1, android.view.WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
                        android.view.WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | android.view.WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE, android.graphics.PixelFormat.TRANSLUCENT);
                wm.addView(punkt, lp);
            } catch (Throwable e) { punkt = null; }
            try { startActivity(i); } catch (Throwable ignored) { }
        }
        final android.view.View weg = punkt;
        if (weg != null) main.postDelayed(() -> { try { wm.removeView(weg); } catch (Throwable ignored) { } }, 4000);
        // Notlösung, falls es nicht aufging (oder der Bildschirm gesperrt war): Meldung zum Tippen bzw. Vollbild über dem Sperrbildschirm
        main.postDelayed(() -> {
            if (MainActivity.sichtbar) return;
            try {
                PendingIntent pi = PendingIntent.getActivity(this, 1, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
                Notification n = new Notification.Builder(this, KANAL_WACH).setSmallIcon(android.R.drawable.ic_btn_speak_now).setContentTitle("Hey Atlas")
                        .setContentText("Tippen, um Atlas zu öffnen").setCategory(Notification.CATEGORY_ALARM).setAutoCancel(true).setContentIntent(pi).setFullScreenIntent(pi, true).build();
                NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
                nm.notify(5002, n); main.postDelayed(() -> nm.cancel(5002), 30000);
            } catch (Throwable ignored) { }
        }, gs ? 0 : 2500);
    }

    @Override public void onPartialResult(String h) { }
    @Override public void onFinalResult(String h) { onResult(h); }
    @Override public void onError(Exception e) { Erinnerungen.p(this).edit().putString("hey_zuletzt", "Mikrofon neu gestartet: " + e.getMessage()).apply(); main.post(() -> stoppeLauschen()); }
    @Override public void onTimeout() { }

    private void kopiere(String pfad, File ziel) throws Exception {
        String[] kids = getAssets().list(pfad);
        if (kids == null || kids.length == 0) {
            ziel.getParentFile().mkdirs();
            try (InputStream in = getAssets().open(pfad); OutputStream out = new FileOutputStream(ziel)) { byte[] b = new byte[65536]; int r; while ((r = in.read(b)) > 0) out.write(b, 0, r); }
        } else { ziel.mkdirs(); for (String k : kids) kopiere(pfad + "/" + k, new File(ziel, k)); }
    }
    private void loesche(File f) { if (!f.exists()) return; File[] k = f.listFiles(); if (k != null) for (File x : k) loesche(x); f.delete(); }

    @Override public void onDestroy() { lebt = false; main.removeCallbacksAndMessages(null); stoppeLauschen(); if (model != null) { model.close(); model = null; } super.onDestroy(); }
    @Override public IBinder onBind(Intent i) { return null; }
}
