package com.amc.construcciones;

import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import android.util.Base64;

import java.io.OutputStream;
import com.amc.connected.Online;
import com.amc.connected.ConnectionActivity;
import org.json.JSONObject;
import android.widget.LinearLayout;
import android.widget.Button;

public class MainActivity extends Activity {
    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        webView = new WebView(this);
        LinearLayout layout=new LinearLayout(this);layout.setOrientation(LinearLayout.VERTICAL);layout.setFitsSystemWindows(true);Button online=new Button(this);online.setText("Solicitudes y publicaciones online");online.setOnClickListener(v->startActivity(new Intent(this,ConnectionActivity.class)));layout.addView(online);layout.addView(webView,new LinearLayout.LayoutParams(-1,0,1));setContentView(layout);

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);

        webView.setWebViewClient(new WebViewClient(){@Override public boolean shouldOverrideUrlLoading(WebView view,android.webkit.WebResourceRequest req){return !("file".equals(req.getUrl().getScheme()) && "/android_asset/index.html".equals(req.getUrl().getPath()));}});
        webView.setWebChromeClient(new WebChromeClient());
        webView.addJavascriptInterface(new AndroidBridge(), "AndroidBridge");
        webView.addJavascriptInterface(new ConnectedBridge(), "AMCOnline");
        webView.loadUrl("file:///android_asset/index.html");
        if(getIntent().hasExtra("url"))startActivity(new Intent(this,ConnectionActivity.class).putExtra("amc_path","/#avisos"));
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override protected void onNewIntent(Intent intent){super.onNewIntent(intent);setIntent(intent);if(webView!=null)webView.reload();}
    public class ConnectedBridge {
        @JavascriptInterface public String selectedRequest(){return getIntent().getStringExtra("amc_request");}
        @JavascriptInterface public void open(){runOnUiThread(()->startActivity(new Intent(MainActivity.this,ConnectionActivity.class)));}
        @JavascriptInterface public void request(String method,String path,String body,String csrf,String callback){
            if(body.length()>8000000||callback.length()>100)return;
            new Thread(()->{String result;boolean ok;try{result=Online.request(method,path,body,csrf);ok=true;}catch(Exception e){result=e.getMessage();ok=false;}final String js="window.amcOnlineResponse("+JSONObject.quote(callback)+","+ok+","+JSONObject.quote(result)+")";runOnUiThread(()->webView.evaluateJavascript(js,null));}).start();
        }
    }
    public class AndroidBridge {
        @JavascriptInterface
        public void savePdf(String base64Data, String fileName, boolean share) {
            runOnUiThread(() -> {
                try {
                    byte[] data = Base64.decode(base64Data, Base64.DEFAULT);
                    ContentValues values = new ContentValues();
                    values.put(MediaStore.Downloads.DISPLAY_NAME, fileName);
                    values.put(MediaStore.Downloads.MIME_TYPE, "application/pdf");
                    values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/AMC Presupuestos");
                    Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                    if (uri == null) throw new Exception("No se pudo crear el PDF");
                    try (OutputStream out = getContentResolver().openOutputStream(uri)) {
                        if (out == null) throw new Exception("No se pudo abrir el archivo");
                        out.write(data);
                    }
                    Toast.makeText(MainActivity.this, "PDF guardado en Descargas/AMC Presupuestos", Toast.LENGTH_LONG).show();
                    if (share) {
                        Intent intent = new Intent(Intent.ACTION_SEND);
                        intent.setType("application/pdf");
                        intent.putExtra(Intent.EXTRA_STREAM, uri);
                        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        startActivity(Intent.createChooser(intent, "Compartir presupuesto"));
                    }
                } catch (Exception e) {
                    Toast.makeText(MainActivity.this, "Error al guardar PDF: " + e.getMessage(), Toast.LENGTH_LONG).show();
                }
            });
        }
    }
}

