package com.amc.construcciones;

import android.app.Activity;
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

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        webView = new WebView(this);
        setContentView(webView);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        webView.setWebViewClient(new WebViewClient(){@Override public void onPageFinished(WebView view,String url){super.onPageFinished(view,url);sendPushToken();}});
        webView.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent gallery = params.createIntent();
                if (gallery.getType() == null || gallery.getType().equals("*/*")) gallery.setType("image/*");
                gallery.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE);
                Intent camera = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
                try {
                    File dir = new File(getCacheDir(), "camera");
                    if (!dir.exists()) dir.mkdirs();
                    File photo = File.createTempFile("amc-", ".jpg", dir);
                    cameraUri = FileProvider.getUriForFile(MainActivity.this, getPackageName() + ".files", photo);
                    camera.putExtra(MediaStore.EXTRA_OUTPUT, cameraUri);
                    camera.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
                } catch (Exception error) { camera = null; cameraUri = null; }
                Intent chooser = Intent.createChooser(gallery, "Elegir foto");
                if (camera != null) chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[]{camera});
                startActivityForResult(chooser, FILE_CHOOSER);
                return true;
            }
        });
        webView.addJavascriptInterface(new AndroidBridge(), "AMCNative");
        loadRequestedUrl(getIntent());
    }

    private void loadRequestedUrl(Intent intent){String path=intent==null?null:intent.getStringExtra("amc_url");webView.loadUrl(path!=null&&path.startsWith("/#")?BuildConfig.AMC_BACKEND_URL.replaceAll("/$","")+path:BuildConfig.AMC_BACKEND_URL);}
    @Override protected void onNewIntent(Intent intent){super.onNewIntent(intent);setIntent(intent);loadRequestedUrl(intent);}
    private void sendPushToken(){FirebaseMessaging.getInstance().getToken().addOnSuccessListener(token->{String safe=token.replace("\\","\\\\").replace("\"","\\\"");webView.evaluateJavascript("window.amcNativeToken&&window.amcNativeToken(\""+safe+"\")",null);});}
    @Override public void onRequestPermissionsResult(int requestCode,String[] permissions,int[] results){super.onRequestPermissionsResult(requestCode,permissions,results);if(requestCode==NOTIFICATIONS&&results.length>0&&results[0]==PackageManager.PERMISSION_GRANTED)sendPushToken();}

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
        fileCallback.onReceiveValue(result); fileCallback = null; cameraUri = null;
    }

    @Override public void onBackPressed() {
        if (webView == null) { super.onBackPressed(); return; }
        webView.evaluateJavascript("window.AMCBackHandler?window.AMCBackHandler():false", value -> {
            if ("true".equals(value)) return;
            if (webView.canGoBack()) webView.goBack(); else MainActivity.super.onBackPressed();
        });
    }

    public class AndroidBridge {
        @JavascriptInterface public void requestNotifications(){runOnUiThread(()->{if(Build.VERSION.SDK_INT>=33&&ContextCompat.checkSelfPermission(MainActivity.this,Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)ActivityCompat.requestPermissions(MainActivity.this,new String[]{Manifest.permission.POST_NOTIFICATIONS},NOTIFICATIONS);else sendPushToken();});}
        @JavascriptInterface public void savePdf(String base64Data, String fileName, boolean share) {
            runOnUiThread(() -> { try {
                byte[] data = Base64.decode(base64Data, Base64.DEFAULT);
                ContentValues values = new ContentValues();
                values.put(MediaStore.Downloads.DISPLAY_NAME, fileName);
                values.put(MediaStore.Downloads.MIME_TYPE, "application/pdf");
                values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/AMC Presupuestos");
                Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                if (uri == null) throw new Exception();
                try (OutputStream out = getContentResolver().openOutputStream(uri)) { if (out == null) throw new Exception(); out.write(data); }
                if (share) { Intent intent = new Intent(Intent.ACTION_SEND); intent.setType("application/pdf"); intent.putExtra(Intent.EXTRA_STREAM, uri); intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION); startActivity(Intent.createChooser(intent, "Compartir presupuesto")); }
                else Toast.makeText(MainActivity.this, "PDF guardado en Descargas/AMC Presupuestos", Toast.LENGTH_LONG).show();
            } catch (Exception error) { Toast.makeText(MainActivity.this, "No pudimos guardar el PDF. Intentá nuevamente.", Toast.LENGTH_LONG).show(); } });
        }
    }
}
