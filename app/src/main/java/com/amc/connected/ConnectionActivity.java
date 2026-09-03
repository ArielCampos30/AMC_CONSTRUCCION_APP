package com.amc.connected;
import android.app.*;
import android.content.*;
import android.net.Uri;
import android.os.*;
import android.webkit.*;
import android.widget.*;
import com.google.firebase.messaging.FirebaseMessaging;
import org.json.JSONObject;
import com.amc.construcciones.BuildConfig;

public class ConnectionActivity extends Activity {
 private WebView web;private ValueCallback<Uri[]> photos;
 @Override public void onCreate(Bundle state){super.onCreate(state);if(!Online.configured()){TextView notice=new TextView(this);notice.setText("AMC conectado\n\nFalta configurar la dirección segura del servidor. Esta build todavía no está lista para clientes.");notice.setPadding(35,60,35,30);setContentView(notice);return;}PushService.initialize(this);web=new WebView(this);LinearLayout root=new LinearLayout(this);root.setFitsSystemWindows(true);root.addView(web,new LinearLayout.LayoutParams(-1,-1));setContentView(root);WebSettings settings=web.getSettings();settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);settings.setAllowFileAccess(false);settings.setAllowContentAccess(true);settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);web.addJavascriptInterface(new NativeBridge(),"AMCNative");web.addJavascriptInterface(new PdfBridge(),"AndroidBridge");
 web.setWebViewClient(new WebViewClient(){@Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest req){Uri u=req.getUrl(),base=Uri.parse(Online.base());if(!"https".equals(u.getScheme())||!base.getAuthority().equals(u.getAuthority()))return true;return false;}
 @Override public void onPageFinished(WebView view,String url){CookieManager.getInstance().flush();}
 });
 web.setWebChromeClient(new WebChromeClient(){
 @Override public boolean onJsConfirm(WebView view,String url,String message,JsResult result){new AlertDialog.Builder(ConnectionActivity.this).setTitle("AMC").setMessage(message).setPositiveButton("Confirmar",(d,w)->result.confirm()).setNegativeButton("Cancelar",(d,w)->result.cancel()).setOnCancelListener(d->result.cancel()).show();return true;}
 @Override public boolean onJsAlert(WebView view,String url,String message,JsResult result){new AlertDialog.Builder(ConnectionActivity.this).setTitle("AMC").setMessage(message).setPositiveButton("Aceptar",(d,w)->result.confirm()).setOnCancelListener(d->result.confirm()).show();return true;}
 @Override public boolean onShowFileChooser(WebView v,ValueCallback<Uri[]> cb,FileChooserParams params){if(photos!=null)photos.onReceiveValue(null);photos=cb;Intent pick=params.createIntent().putExtra(Intent.EXTRA_ALLOW_MULTIPLE,params.getMode()==FileChooserParams.MODE_OPEN_MULTIPLE);try{startActivityForResult(Intent.createChooser(pick,"Elegí fotos o un comprobante"),10);}catch(ActivityNotFoundException e){photos.onReceiveValue(null);photos=null;}return true;}});
 web.setDownloadListener((url,agent,disposition,mime,length)->{Uri u=Uri.parse(url);if(!"https".equals(u.getScheme())||!Uri.parse(Online.base()).getAuthority().equals(u.getAuthority()))return;android.app.DownloadManager.Request request=new android.app.DownloadManager.Request(u);request.addRequestHeader("Cookie",CookieManager.getInstance().getCookie(url));request.setTitle("Presupuesto AMC");request.setMimeType("application/pdf");request.setNotificationVisibility(android.app.DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS,"AMC-Presupuesto-"+System.currentTimeMillis()+".pdf");getSystemService(android.app.DownloadManager.class).enqueue(request);});
 String requested=getIntent().getStringExtra("amc_path");web.loadUrl(Online.base()+(requested!=null&&requested.startsWith("/#")?requested:"/"));}

 public class PdfBridge {
  @JavascriptInterface public void savePdf(String base64Data,String fileName,boolean share){
   if(base64Data==null||base64Data.length()>14000000)return;
   runOnUiThread(()->{android.net.Uri uri=null;try{
    byte[] data=android.util.Base64.decode(base64Data,android.util.Base64.DEFAULT);
    if(data.length<5||data[0]!=37||data[1]!=80||data[2]!=68||data[3]!=70||data[4]!=45)throw new Exception("PDF inválido");
    String name=(fileName==null?"AMC-Presupuesto.pdf":fileName).replaceAll("[^a-zA-Z0-9._-]","_");if(name.length()>120)name=name.substring(0,120);if(!name.endsWith(".pdf"))name+=".pdf";
    ContentValues values=new ContentValues();values.put(android.provider.MediaStore.Downloads.DISPLAY_NAME,name);values.put(android.provider.MediaStore.Downloads.MIME_TYPE,"application/pdf");values.put(android.provider.MediaStore.Downloads.RELATIVE_PATH,Environment.DIRECTORY_DOWNLOADS+"/AMC Presupuestos");values.put(android.provider.MediaStore.Downloads.IS_PENDING,1);
    uri=getContentResolver().insert(android.provider.MediaStore.Downloads.EXTERNAL_CONTENT_URI,values);if(uri==null)throw new Exception("No se pudo crear el archivo");
    try(java.io.OutputStream out=getContentResolver().openOutputStream(uri)){if(out==null)throw new Exception("No se pudo abrir el archivo");out.write(data);}
    ContentValues complete=new ContentValues();complete.put(android.provider.MediaStore.Downloads.IS_PENDING,0);getContentResolver().update(uri,complete,null,null);
    Toast.makeText(ConnectionActivity.this,"PDF guardado en Descargas/AMC Presupuestos",Toast.LENGTH_LONG).show();
    if(share){Intent send=new Intent(Intent.ACTION_SEND).setType("application/pdf").putExtra(Intent.EXTRA_STREAM,uri).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);startActivity(Intent.createChooser(send,"Compartir presupuesto"));}
   }catch(Exception e){if(uri!=null)getContentResolver().delete(uri,null,null);Toast.makeText(ConnectionActivity.this,"No se pudo guardar el PDF: "+e.getMessage(),Toast.LENGTH_LONG).show();}});
  }
 }
 private void getToken(){if(!PushService.initialize(this)){Toast.makeText(this,"Falta configurar Firebase para las notificaciones Android.",Toast.LENGTH_LONG).show();return;}FirebaseMessaging.getInstance().getToken().addOnSuccessListener(token->{Online.registerToken(token);if(web!=null)web.evaluateJavascript("window.amcNativeToken && window.amcNativeToken("+JSONObject.quote(token)+")",null);}).addOnFailureListener(e->Toast.makeText(this,"No se pudo registrar el dispositivo. Intentá de nuevo.",Toast.LENGTH_LONG).show());}
 public class NativeBridge{
 @JavascriptInterface public void requestNotifications(){runOnUiThread(()->{if(Build.VERSION.SDK_INT>=33&&checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)!=android.content.pm.PackageManager.PERMISSION_GRANTED)requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS},20);else getToken();});}
 @JavascriptInterface public void clearNotifications(){runOnUiThread(()->{getSystemService(NotificationManager.class).cancelAll();if(PushService.initialize(ConnectionActivity.this))FirebaseMessaging.getInstance().deleteToken();});}
 }
 @Override public void onRequestPermissionsResult(int request,String[] permissions,int[] results){super.onRequestPermissionsResult(request,permissions,results);if(request==20&&results.length>0&&results[0]==android.content.pm.PackageManager.PERMISSION_GRANTED)getToken();}
 @Override public void onActivityResult(int request,int result,Intent data){super.onActivityResult(request,result,data);if(request==10&&photos!=null){photos.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result,data));photos=null;}}
 @Override public void onBackPressed(){if(web!=null&&web.canGoBack())web.goBack();else super.onBackPressed();}
 @Override protected void onDestroy(){if(photos!=null)photos.onReceiveValue(null);if(web!=null){web.removeJavascriptInterface("AMCNative");web.removeJavascriptInterface("AndroidBridge");web.destroy();}super.onDestroy();}
}
