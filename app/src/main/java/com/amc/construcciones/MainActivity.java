package com.amc.construcciones;

import android.app.Activity;
import android.app.NotificationManager;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Build;
import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import androidx.core.content.FileProvider;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.google.firebase.messaging.FirebaseMessaging;
import java.io.File;
import java.io.OutputStream;

public class MainActivity extends Activity {
    private static final int FILE_CHOOSER = 6001;
    private static final int NOTIFICATIONS = 6002;
    private WebView webView;
    private ValueCallback<Uri[]> fileCallback;
    private Uri cameraUri;
    private File cameraFile;
    private Uri backendUri;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        backendUri = Uri.parse(BuildConfig.AMC_BACKEND_URL);
        webView = new WebView(this);
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        setContentView(webView);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        if(Build.VERSION.SDK_INT>=26)settings.setSafeBrowsingEnabled(true);
        webView.setWebViewClient(new WebViewClient(){
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request){return routeUrl(request.getUrl());}
            @Override public boolean shouldOverrideUrlLoading(WebView view,String url){return routeUrl(Uri.parse(url));}
            @Override public void onPageFinished(WebView view,String url){super.onPageFinished(view,url);if(isTrusted(Uri.parse(url)))sendPushToken(false);}
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                clearUnusedCameraFile();
                Intent gallery = params.createIntent();
                if (gallery.getType() == null || gallery.getType().equals("*/*")) gallery.setType("image/*");
                gallery.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE);
                Intent camera = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
                try {
                    File dir = new File(getCacheDir(), "camera");
                    if (!dir.exists()) dir.mkdirs();
                    cameraFile = File.createTempFile("amc-", ".jpg", dir);
                    cameraUri = FileProvider.getUriForFile(MainActivity.this, getPackageName() + ".files", cameraFile);
                    camera.putExtra(MediaStore.EXTRA_OUTPUT, cameraUri);
                    camera.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
                } catch (Exception error) { camera = null; cameraUri = null; }
                if (params.isCaptureEnabled() && camera != null) startActivityForResult(camera, FILE_CHOOSER);
                else { clearUnusedCameraFile(); startActivityForResult(Intent.createChooser(gallery, "Elegir de galería"), FILE_CHOOSER); }
                return true;
            }
        });
        webView.addJavascriptInterface(new AndroidBridge(), "AMCNative");
        loadRequestedUrl(getIntent());
    }

    @Override protected void onResume(){
        super.onResume();
        getSharedPreferences("amc",MODE_PRIVATE).edit().putBoolean("foreground",true).apply();
        if(webView!=null)webView.postDelayed(()->sendPushToken(false),250);
    }

    @Override protected void onPause(){
        getSharedPreferences("amc",MODE_PRIVATE).edit().putBoolean("foreground",false).apply();
        super.onPause();
    }

    private boolean isTrusted(Uri uri){
        if(uri==null||backendUri==null)return false;
        int expectedPort=backendUri.getPort(),actualPort=uri.getPort();
        return "https".equalsIgnoreCase(uri.getScheme())&&
            backendUri.getScheme()!=null&&backendUri.getScheme().equalsIgnoreCase(uri.getScheme())&&
            backendUri.getHost()!=null&&backendUri.getHost().equalsIgnoreCase(uri.getHost())&&
            expectedPort==actualPort;
    }

    private boolean routeUrl(Uri uri){
        if(isTrusted(uri))return false;
        String scheme=uri==null?null:uri.getScheme();
        if(scheme!=null&&("http".equalsIgnoreCase(scheme)||"https".equalsIgnoreCase(scheme)||"tel".equalsIgnoreCase(scheme)||"mailto".equalsIgnoreCase(scheme)||"geo".equalsIgnoreCase(scheme))){
            try{startActivity(new Intent(Intent.ACTION_VIEW,uri));}catch(Exception ignored){Toast.makeText(this,"No encontramos una aplicación para abrir este enlace.",Toast.LENGTH_SHORT).show();}
        }
        return true;
    }

    private String trustedBase(){return BuildConfig.AMC_BACKEND_URL.replaceAll("/$","");}
    private void loadRequestedUrl(Intent intent){String path=intent==null?null:intent.getStringExtra("amc_url");String target=path!=null&&path.startsWith("/#")?trustedBase()+path:BuildConfig.AMC_BACKEND_URL;webView.loadUrl(target);}
    private void clearUnusedCameraFile(){if(cameraFile!=null&&cameraFile.exists())cameraFile.delete();cameraFile=null;cameraUri=null;}
    @Override protected void onNewIntent(Intent intent){super.onNewIntent(intent);setIntent(intent);loadRequestedUrl(intent);}
    private void sendPushToken(boolean manual){if(webView==null||!isTrusted(Uri.parse(webView.getUrl()==null?BuildConfig.AMC_BACKEND_URL:webView.getUrl())))return;FirebaseMessaging.getInstance().getToken().addOnSuccessListener(token->{String safe=token.replace("\\","\\\\").replace("\"","\\\"");webView.evaluateJavascript("window.amcNativeToken&&window.amcNativeToken(\""+safe+"\","+manual+")",null);});}
    @Override public void onRequestPermissionsResult(int requestCode,String[] permissions,int[] results){super.onRequestPermissionsResult(requestCode,permissions,results);if(requestCode==NOTIFICATIONS&&results.length>0&&results[0]==PackageManager.PERMISSION_GRANTED)sendPushToken(true);}

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != FILE_CHOOSER || fileCallback == null) return;
        Uri[] result = null;
        if (resultCode == RESULT_OK) {
            if (data == null || (data.getData() == null && data.getClipData() == null)) {
                if (cameraUri != null) result = new Uri[]{cameraUri};
            } else if (data.getClipData() != null) {
                int count = data.getClipData().getItemCount(); result = new Uri[count];
                for (int i = 0; i < count; i++) result[i] = data.getClipData().getItemAt(i).getUri();
            } else result = new Uri[]{data.getData()};
        }
        fileCallback.onReceiveValue(result); fileCallback = null;
        if(result==null)clearUnusedCameraFile();else cameraUri=null;
    }

    @Override public void onBackPressed() {
        if (webView == null) { super.onBackPressed(); return; }
        webView.evaluateJavascript("window.AMCBackHandler?window.AMCBackHandler():false", value -> {
            if ("true".equals(value)) return;
            if (webView.canGoBack()) webView.goBack(); else MainActivity.super.onBackPressed();
        });
    }

    public class AndroidBridge {
        @JavascriptInterface public void clearNotifications(){getSystemService(NotificationManager.class).cancelAll();}
        @JavascriptInterface public void clearNotification(String id){if(id!=null&&!id.isEmpty())getSystemService(NotificationManager.class).cancel(id.hashCode());}
        @JavascriptInterface public void requestNotifications(){runOnUiThread(()->{if(Build.VERSION.SDK_INT>=33&&ContextCompat.checkSelfPermission(MainActivity.this,Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)ActivityCompat.requestPermissions(MainActivity.this,new String[]{Manifest.permission.POST_NOTIFICATIONS},NOTIFICATIONS);else sendPushToken(true);});}
        @JavascriptInterface public void refreshPushToken(){runOnUiThread(()->sendPushToken(false));}
        @JavascriptInterface public void setActiveChatRoute(String route){String safe=route!=null&&route.startsWith("/#chat")?route:"";getSharedPreferences("amc",MODE_PRIVATE).edit().putString("activeChatRoute",safe).apply();}
        @JavascriptInterface public void savePdf(String base64Data, String fileName, boolean share) {
            runOnUiThread(() -> { try {
                byte[] data = Base64.decode(base64Data, Base64.DEFAULT);
                ContentValues values = new ContentValues();
                values.put(MediaStore.Downloads.DISPLAY_NAME, fileName);
                values.put(MediaStore.Downloads.MIME_TYPE, "application/pdf");
                values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/AMC Construcciones");
                Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                if (uri == null) throw new Exception();
                try (OutputStream out = getContentResolver().openOutputStream(uri)) { if (out == null) throw new Exception(); out.write(data); }
                if (share) { Intent intent = new Intent(Intent.ACTION_SEND); intent.setType("application/pdf"); intent.putExtra(Intent.EXTRA_STREAM, uri); intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION); startActivity(Intent.createChooser(intent, "Compartir presupuesto")); }
                else Toast.makeText(MainActivity.this, "PDF guardado en Descargas/AMC Construcciones", Toast.LENGTH_LONG).show();
            } catch (Exception error) { Toast.makeText(MainActivity.this, "No pudimos guardar el PDF. Intentá nuevamente.", Toast.LENGTH_LONG).show(); } });
        }
    }
}
