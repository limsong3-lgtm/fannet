package net.fannet.gamma;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.JsResult;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * Fannet Android test build: the live Fannet app (https://app.fannet.co) shown full screen.
 * Nothing is bundled, so every web release is in the phone app at once and the screens are
 * exactly the web screens. Links to other sites, email and messages open outside the app.
 */
public class MainActivity extends Activity {
    private static final String HOST = "app.fannet.co";
    private static final String START = "https://" + HOST + "/";
    private WebView web;
    private boolean offlineShown = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);          // keeps the user signed in (local storage)
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setMediaPlaybackRequiresUserGesture(true);
        s.setUserAgentString(s.getUserAgentString() + " FannetAndroid/" + BuildConfig.VERSION_NAME);
        CookieManager.getInstance().setAcceptCookie(true);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                String scheme = u.getScheme() == null ? "" : u.getScheme();
                if (("https".equals(scheme) || "http".equals(scheme)) && HOST.equals(u.getHost())) {
                    return false;                                  // our own pages stay in the app
                }
                if ("about".equals(scheme) || "data".equals(scheme)) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) { }
                return true;                                       // other links open outside
            }

            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                if (url != null && url.startsWith("https://")) offlineShown = false;
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame() && !offlineShown) {
                    offlineShown = true;
                    view.loadDataWithBaseURL(null, OFFLINE, "text/html", "utf-8", null);
                }
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onJsAlert(WebView view, String url, String message, final JsResult result) {
                new AlertDialog.Builder(MainActivity.this).setMessage(message)
                        .setPositiveButton(android.R.string.ok, (d, w) -> result.confirm())
                        .setOnCancelListener(d -> result.cancel()).show();
                return true;
            }

            @Override
            public boolean onJsConfirm(WebView view, String url, String message, final JsResult result) {
                new AlertDialog.Builder(MainActivity.this).setMessage(message)
                        .setPositiveButton(android.R.string.ok, (d, w) -> result.confirm())
                        .setNegativeButton(android.R.string.cancel, (d, w) -> result.cancel())
                        .setOnCancelListener(d -> result.cancel()).show();
                return true;
            }
        });

        setContentView(web);
        if (savedInstanceState != null) web.restoreState(savedInstanceState);
        else web.loadUrl(START);
    }

    /** Shown when the phone has no connection; the button tries the live app again. */
    private static final String OFFLINE =
            "<!doctype html><meta name='viewport' content='width=device-width,initial-scale=1'>"
            + "<body style='margin:0;font-family:sans-serif;background:#0F172A;color:#fff;display:flex;"
            + "align-items:center;justify-content:center;height:100vh;text-align:center'>"
            + "<div><div style='font-size:22px;font-weight:700;margin-bottom:8px'>Fannet</div>"
            + "<div style='opacity:.8;margin-bottom:20px'>No connection. Check your internet and try again.</div>"
            + "<button onclick=\"location.href='" + START + "'\" style='font-size:16px;padding:10px 24px;"
            + "border:0;border-radius:8px;background:#fff;color:#0F172A'>Try again</button></div></body>";

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        web.saveState(outState);
    }

    @Override
    protected void onPause() {
        super.onPause();
        CookieManager.getInstance().flush();
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }
}
