package com.amc.connected;
import android.content.Context;
import android.webkit.CookieManager;
import java.net.URL;
import java.net.HttpURLConnection;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;
import com.amc.construcciones.BuildConfig;

public final class Online {
 public static String base(){return BuildConfig.AMC_SERVER_URL;}
 public static boolean configured(){try{return "https".equals(new URL(base()).getProtocol())&&!new URL(base()).getHost().isEmpty();}catch(Exception e){return false;}}
 public static String request(String method,String path,String body,String csrf)throws Exception{
  if(!configured()||!path.matches("/api/(state|upload|quotes|devices)")||!(method.equals("GET")||method.equals("POST")))throw new Exception("Conexión no configurada o acción no permitida.");
  HttpURLConnection conn=(HttpURLConnection)new URL(base()+path).openConnection();conn.setRequestMethod(method);conn.setConnectTimeout(15000);conn.setReadTimeout(30000);conn.setInstanceFollowRedirects(false);conn.setRequestProperty("Origin",base());conn.setRequestProperty("Content-Type","application/json");String cookie=CookieManager.getInstance().getCookie(base());if(cookie!=null)conn.setRequestProperty("Cookie",cookie);if(csrf!=null)conn.setRequestProperty("X-CSRF-Token",csrf);
  if(method.equals("POST")){conn.setDoOutput(true);try(java.io.OutputStream out=conn.getOutputStream()){out.write(body.getBytes(StandardCharsets.UTF_8));}}
  int status=conn.getResponseCode();java.io.InputStream input=status>=400?conn.getErrorStream():conn.getInputStream();java.io.ByteArrayOutputStream buffer=new java.io.ByteArrayOutputStream();if(input!=null){byte[] part=new byte[8192];int count;while((count=input.read(part))!=-1)buffer.write(part,0,count);}String result=input==null?"{}":new String(buffer.toByteArray(),StandardCharsets.UTF_8);if(input!=null)input.close();conn.disconnect();if(status<200||status>=300)throw new Exception(new JSONObject(result).optString("error","No se pudo conectar con AMC."));return result;
 }
 public static void registerToken(String token){new Thread(()->{try{JSONObject state=new JSONObject(request("GET","/api/state","{}",null));if(state.isNull("user"))return;JSONObject body=new JSONObject().put("kind","android").put("subscription",new JSONObject().put("token",token));request("POST","/api/devices",body.toString(),state.getString("csrf"));}catch(Exception ignored){/* Retry when the signed-in online area is opened. */}}).start();}
}

