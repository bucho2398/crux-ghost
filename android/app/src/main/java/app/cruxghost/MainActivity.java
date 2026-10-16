package app.cruxghost;

import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.webkit.WebViewAssetLoader;
import java.io.ByteArrayInputStream;
import java.io.OutputStream;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

public class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private WebView web;
    private ValueCallback<Uri[]> chooser;
    private final SaveBridge saver = new SaveBridge();
    private final Map<String, Pending> pending = new HashMap<>();
    private static class Pending {
        Uri uri; OutputStream stream;
        Pending(Uri u, OutputStream s) { uri=u; stream=s; }
    }
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        getWindow().setStatusBarColor(Color.rgb(17,21,18));
        getWindow().setNavigationBarColor(Color.rgb(17,21,18));
        web = new WebView(this);
        setContentView(web);
        web.setBackgroundColor(Color.rgb(17,21,18));
        web.setOnApplyWindowInsetsListener((v,insets) -> {
            v.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),
                insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());
            return insets;
        });
        WebSettings settings=web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(false);
        WebViewAssetLoader loader=new WebViewAssetLoader.Builder()
            .addPathHandler("/assets/",new WebViewAssetLoader.AssetsPathHandler(this)).build();
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request) {
                Uri uri=request.getUrl();
                if (HOST.equals(uri.getHost()) && "https".equals(uri.getScheme())) {
                    WebResourceResponse asset=loader.shouldInterceptRequest(uri);
                    if(asset!=null)return asset;
                    return new WebResourceResponse("text/plain","UTF-8",404,"Not Found",
                        java.util.Collections.emptyMap(),new ByteArrayInputStream(new byte[0]));
                }
                if ("https".equals(uri.getScheme()) || "http".equals(uri.getScheme()))
                    return new WebResourceResponse("text/plain","UTF-8",new ByteArrayInputStream(new byte[0]));
                return null;
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request) {
                Uri uri=request.getUrl();
                if (HOST.equals(uri.getHost()) && "https".equals(uri.getScheme())) return false;
                if (request.isForMainFrame() && "https".equals(uri.getScheme())) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW,uri)); } catch (Exception ignored) {}
                }
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view,ValueCallback<Uri[]> callback,FileChooserParams params) {
                if (chooser!=null) chooser.onReceiveValue(null);
                chooser=callback;
                Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("video/*");
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                try { startActivityForResult(intent,100); }
                catch (Exception error) {chooser.onReceiveValue(null);chooser=null;}
                return true;
            }
        });
        web.addJavascriptInterface(saver,"CruxSave");
        web.loadUrl("https://"+HOST+"/assets/www/index.html");
    }
    @Override protected void onActivityResult(int request,int result,Intent data) {
        super.onActivityResult(request,result,data);
        if (request==100 && chooser!=null) {
            Uri uri=result==RESULT_OK && data!=null ? data.getData() : null;
            chooser.onReceiveValue(uri==null ? null : new Uri[]{uri}); chooser=null;
        }
    }
    public class SaveBridge {
        @JavascriptInterface public synchronized String begin(String ignored) {
            if (pending.size()>=1) return "";
            Uri uri=null;
            try {
                ContentValues values=new ContentValues();
                values.put(MediaStore.Downloads.DISPLAY_NAME,"crux-ghost.mp4");
                values.put(MediaStore.Downloads.MIME_TYPE,"video/mp4");
                values.put(MediaStore.Downloads.RELATIVE_PATH,Environment.DIRECTORY_DOWNLOADS);
                values.put(MediaStore.Downloads.IS_PENDING,1);
                uri=getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI,values);
                if (uri==null) return "";
                OutputStream stream=getContentResolver().openOutputStream(uri,"w");
                if (stream==null) throw new java.io.IOException();
                String token=UUID.randomUUID().toString(); pending.put(token,new Pending(uri,stream));return token;
            } catch (Exception error) {if(uri!=null)getContentResolver().delete(uri,null,null);return "";}
        }
        @JavascriptInterface public synchronized boolean append(String token,String chunk) {
            Pending p=pending.get(token);
            if(p==null||chunk.length()>400000) return false;
            try {p.stream.write(Base64.decode(chunk,Base64.NO_WRAP));return true;} catch(Exception error){return false;}
        }
        @JavascriptInterface public synchronized boolean finish(String token) {
            Pending p=pending.get(token);if(p==null)return false;
            try {
                p.stream.close();ContentValues values=new ContentValues();values.put(MediaStore.Downloads.IS_PENDING,0);
                getContentResolver().update(p.uri,values,null,null);pending.remove(token);return true;
            }catch(Exception error){abort(token);return false;}
        }
        @JavascriptInterface public synchronized void abort(String token) {
            Pending p=pending.remove(token);if(p==null)return;
            try{p.stream.close();}catch(Exception ignored){}
            getContentResolver().delete(p.uri,null,null);
        }
    }
    @Override public void onBackPressed() {
        web.evaluateJavascript("document.getElementById('install-dialog').open", value -> {
            if("true".equals(value))web.evaluateJavascript("document.getElementById('install-dialog').close()",null);
            else finish();
        });
    }
    @Override protected void onDestroy() {
        if(chooser!=null)chooser.onReceiveValue(null);
        synchronized(saver) {
            for(Pending p:pending.values()) {
                try{p.stream.close();getContentResolver().delete(p.uri,null,null);}catch(Exception ignored){}
            }
            pending.clear();
        }
        web.removeJavascriptInterface("CruxSave");web.destroy();super.onDestroy();
    }
}
