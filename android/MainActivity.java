package de.beispiel.atlas;

import android.Manifest;
import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.MediaStore;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.GeolocationPermissions;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/** Zeigt Atlas (die Webseite) im eigenen Fenster: Mikrofon, Standort und Kamera/Fotos gehen an die Seite durch. */
public class MainActivity extends Activity {

    static final String ATLAS_URL = Konfig.URL;
    private WebView web;
    private ValueCallback<Uri[]> fileCallback;
    private Uri camUri;
    static volatile boolean sichtbar = false, wach = false;
    static volatile MainActivity aktuell;
    private boolean seiteFertig = false;

    @Override
    protected void onCreate(Bundle s) {
        super.onCreate(s);
        web = new WebView(this);
        web.setBackgroundColor(Color.BLACK);
        setContentView(web, new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        WebSettings st = web.getSettings();
        st.setJavaScriptEnabled(true);
        st.setCacheMode(WebSettings.LOAD_NO_CACHE); // immer die aktuelle Seite vom Server (sonst bleibt eine alte Seite ohne neue Funktionen im Speicher)
        st.setDomStorageEnabled(true);
        st.setMediaPlaybackRequiresUserGesture(false);
        st.setGeolocationEnabled(true);
        st.setAllowFileAccess(false);
        // Google lässt die Anmeldung in einem "WebView" nicht zu: das Fenster gibt sich als normaler Browser aus
        String ua = st.getUserAgentString();
        if (ua != null) st.setUserAgentString(ua.replace("; wv", "").replace(" Version/4.0", ""));
        CookieManager cm = CookieManager.getInstance();
        cm.setAcceptCookie(true);
        cm.setAcceptThirdPartyCookies(web, true);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView v, String url) { seiteFertig = true; wecken(); }
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                String host = u.getHost() == null ? "" : u.getHost();
                boolean intern = "https".equals(u.getScheme()) && (host.equals("atlas-beispiel.vercel.app") || host.equals("accounts.google.com") || host.endsWith(".google.com"));
                if (intern) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Throwable ignored) { }
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(PermissionRequest request) {
                request.grant(request.getResources());
            }

            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback cb) {
                cb.invoke(origin, true, false);
            }

            @Override
            public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = cb;
                try {
                    if (params != null && params.isCaptureEnabled()) {
                        ContentValues cv = new ContentValues();
                        cv.put(MediaStore.Images.Media.DISPLAY_NAME, "atlas_" + System.currentTimeMillis() + ".jpg");
                        cv.put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg");
                        if (Build.VERSION.SDK_INT >= 29) cv.put(MediaStore.Images.Media.RELATIVE_PATH, "Pictures/Atlas");
                        camUri = getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, cv);
                        if (camUri != null) {
                            Intent ci = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
                            ci.putExtra(MediaStore.EXTRA_OUTPUT, camUri);
                            ci.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
                            startActivityForResult(ci, 77);
                            return true;
                        }
                    }
                } catch (Throwable e) {
                    try { if (camUri != null) getContentResolver().delete(camUri, null, null); } catch (Throwable ignored) { }
                    camUri = null; // Kamera ließ sich nicht starten: weiter mit der normalen Dateiauswahl
                }
                try {
                    startActivityForResult(params.createIntent(), 77);
                } catch (Throwable e) {
                    fileCallback = null;
                    return false;
                }
                return true;
            }
        });
        web.addJavascriptInterface(new AtlasBridge(this), "AtlasApp");
        web.loadUrl(ATLAS_URL);
        if (Build.VERSION.SDK_INT >= 23) {
            requestPermissions(Build.VERSION.SDK_INT >= 33
                    ? new String[]{Manifest.permission.RECORD_AUDIO, Manifest.permission.ACCESS_FINE_LOCATION, "android.permission.POST_NOTIFICATIONS"}
                    : new String[]{Manifest.permission.RECORD_AUDIO, Manifest.permission.ACCESS_FINE_LOCATION}, 1);
        }
    }

    /** "Hey Atlas" wurde erkannt: die Seite beginnt zuzuhören (erst wenn sie geladen ist). */
    void weckenJetzt() { runOnUiThread(() -> { wach = true; wecken(); }); }

    private void wecken() {
        if (!wach || !seiteFertig || web == null) return;
        wach = false;
        web.postDelayed(() -> web.evaluateJavascript("window.atlasWake&&window.atlasWake()", null), 900);
    }

    @Override
    protected void onNewIntent(Intent in) {
        super.onNewIntent(in);
        if (in != null && in.getBooleanExtra("wake", false)) { wach = true; wecken(); }
    }

    @Override
    protected void onResume() {
        super.onResume();
        sichtbar = true; aktuell = this;
        if (getIntent() != null && getIntent().getBooleanExtra("wake", false)) { wach = true; getIntent().removeExtra("wake"); wecken(); }
    }

    @Override
    protected void onPause() {
        sichtbar = false; if (aktuell == this) aktuell = null;
        try { if (web != null) web.evaluateJavascript("window.atlasPause&&window.atlasPause()", null); } catch (Throwable ignored) { } // Atlas ist nicht mehr zu sehen: nicht weiter zuhören
        super.onPause();
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        if (req == 77) {
            Uri[] uris = null;
            final Uri cu = camUri; camUri = null;
            if (cu != null) {
                if (res == RESULT_OK) uris = new Uri[]{cu};
                else { try { getContentResolver().delete(cu, null, null); } catch (Throwable ignored) { } }
            } else if (res == RESULT_OK) {
                try { uris = WebChromeClient.FileChooserParams.parseResult(res, data); } catch (Throwable ignored) { }
            }
            ValueCallback<Uri[]> cb = fileCallback;
            fileCallback = null;
            if (cb != null) cb.onReceiveValue(uris);
            return;
        }
        super.onActivityResult(req, res, data);
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack();
        else moveTaskToBack(true);
    }
}
