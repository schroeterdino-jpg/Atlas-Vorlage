package de.beispiel.atlas;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.bluetooth.BluetoothDevice;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Bundle;
import android.os.HandlerThread;

import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/** Auto-Bluetooth wurde getrennt: Standort holen und als Parkplatz an Atlas melden. */
public class ParkReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(final Context c0, Intent in) {
        if (in == null || !BluetoothDevice.ACTION_ACL_DISCONNECTED.equals(in.getAction())) return;
        final Context c = c0.getApplicationContext();
        String gewaehlt = Erinnerungen.p(c).getString("park_bt", "");
        if (gewaehlt.isEmpty()) return;
        BluetoothDevice d = in.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE);
        if (d == null || !gewaehlt.equalsIgnoreCase(d.getAddress())) return;
        final PendingResult pr = goAsync();
        new Thread(() -> { try { melden(c); } catch (Throwable ignored) { } try { pr.finish(); } catch (Throwable ignored) { } }).start();
    }

    static Location standort(Context c) {
        try {
            LocationManager lm = (LocationManager) c.getSystemService(Context.LOCATION_SERVICE);
            Location best = null;
            for (String p : lm.getProviders(true)) { Location l = lm.getLastKnownLocation(p); if (l != null && (best == null || l.getTime() > best.getTime())) best = l; }
            if (best != null && System.currentTimeMillis() - best.getTime() < 180000) return best;
            // zu alt: kurz eine frische Position holen
            final Location[] frisch = new Location[1];
            final Object sperre = new Object();
            HandlerThread ht = new HandlerThread("park-ort"); ht.start();
            LocationListener li = new LocationListener() {
                @Override public void onLocationChanged(Location l) { synchronized (sperre) { frisch[0] = l; sperre.notifyAll(); } }
                @Override public void onStatusChanged(String p, int s, Bundle e) { }
                @Override public void onProviderEnabled(String p) { }
                @Override public void onProviderDisabled(String p) { }
            };
            String prov = lm.isProviderEnabled(LocationManager.GPS_PROVIDER) ? LocationManager.GPS_PROVIDER : LocationManager.NETWORK_PROVIDER;
            try {
                lm.requestSingleUpdate(prov, li, ht.getLooper());
                synchronized (sperre) { long bis = System.currentTimeMillis() + 15000; while (frisch[0] == null && System.currentTimeMillis() < bis) sperre.wait(500); }
            } catch (Throwable ignored) { } finally { try { lm.removeUpdates(li); } catch (Throwable ignored) { } ht.quitSafely(); }
            return frisch[0] != null ? frisch[0] : best;
        } catch (Throwable t) { return null; }
    }

    static void melden(Context c) {
        String titel = "Parkplatz", text;
        Location l = standort(c);
        if (l == null) text = "Konnte den Standort nicht lesen. Erlaube Atlas den Standort \"Immer\".";
        else {
            text = "Parkplatz gemerkt, aber Atlas war nicht erreichbar.";
            try {
                String token = c.getSharedPreferences(WhatsAppDienst.PREFS, Context.MODE_PRIVATE).getString("token", "");
                if (!token.isEmpty()) {
                    HttpURLConnection h = (HttpURLConnection) new URL(MainActivity.ATLAS_URL + "api/parkplatz").openConnection();
                    h.setRequestMethod("POST"); h.setConnectTimeout(15000); h.setReadTimeout(20000); h.setDoOutput(true);
                    h.setRequestProperty("Content-Type", "application/json"); h.setRequestProperty("x-atlas-s", token);
                    OutputStream o = h.getOutputStream(); o.write(new JSONObject().put("lat", l.getLatitude()).put("lon", l.getLongitude()).put("zeit", l.getTime()).toString().getBytes("UTF-8")); o.close();
                    java.io.InputStream is = h.getResponseCode() < 400 ? h.getInputStream() : h.getErrorStream();
                    java.io.ByteArrayOutputStream bo = new java.io.ByteArrayOutputStream(); byte[] buf = new byte[4096]; int k; while ((k = is.read(buf)) > 0) bo.write(buf, 0, k);
                    JSONObject r = new JSONObject(bo.toString("UTF-8"));
                    if (r.optBoolean("ok")) { JSONObject p = r.optJSONObject("parkplatz"); String a = p == null ? "" : (p.optString("strasse") + " " + p.optString("ort")).trim(); text = a.isEmpty() ? "Auto gemerkt." : "Auto steht: " + a; }
                } else text = "Bitte Atlas einmal öffnen, damit der Parkplatz gespeichert werden kann.";
            } catch (Throwable ignored) { }
        }
        try {
            NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
            nm.createNotificationChannel(new NotificationChannel("park", "Parkplatz", NotificationManager.IMPORTANCE_LOW));
            nm.notify(7003, new android.app.Notification.Builder(c, "park").setSmallIcon(android.R.drawable.ic_dialog_map).setContentTitle(titel).setContentText(text).setAutoCancel(true).build());
        } catch (Throwable ignored) { }
    }
}
