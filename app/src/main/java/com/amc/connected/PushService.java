package com.amc.connected;
import android.app.*;
import android.content.*;
import android.media.*;
import android.os.Build;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import com.amc.construcciones.BuildConfig;

public class PushService extends FirebaseMessagingService {
 public static boolean initialize(Context c){
  channels(c);
  if(BuildConfig.AMC_FIREBASE_APP_ID.isEmpty()||BuildConfig.AMC_FIREBASE_API_KEY.isEmpty()||BuildConfig.AMC_FIREBASE_SENDER_ID.isEmpty()||BuildConfig.AMC_FIREBASE_PROJECT_ID.isEmpty())return false;
  if(FirebaseApp.getApps(c).isEmpty())FirebaseApp.initializeApp(c,new FirebaseOptions.Builder().setApplicationId(BuildConfig.AMC_FIREBASE_APP_ID).setApiKey(BuildConfig.AMC_FIREBASE_API_KEY).setGcmSenderId(BuildConfig.AMC_FIREBASE_SENDER_ID).setProjectId(BuildConfig.AMC_FIREBASE_PROJECT_ID).build());return true;
 }
 public static void channels(Context c){NotificationManager manager=c.getSystemService(NotificationManager.class);NotificationChannel loud=new NotificationChannel("amc_updates","Pedidos y novedades AMC",NotificationManager.IMPORTANCE_HIGH);loud.setDescription("Presupuestos, solicitudes y avances de obra");loud.enableVibration(true);loud.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION),new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION).build());manager.createNotificationChannel(loud);NotificationChannel urgent=new NotificationChannel("amc_urgent","Urgencias del equipo AMC",NotificationManager.IMPORTANCE_HIGH);urgent.enableVibration(true);urgent.setVibrationPattern(new long[]{0,300,100,300,100,300});urgent.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION),new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION).build());manager.createNotificationChannel(urgent);NotificationChannel silent=new NotificationChannel("amc_silent","Avisos AMC sin sonido",NotificationManager.IMPORTANCE_LOW);silent.setSound(null,null);silent.enableVibration(false);manager.createNotificationChannel(silent);}
 @Override public void onNewToken(String token){getSharedPreferences("amc_push",0).edit().putString("token",token).apply();Online.registerToken(token);}
 @Override public void onMessageReceived(RemoteMessage message){channels(this);if(Build.VERSION.SDK_INT>=33&&checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)!=android.content.pm.PackageManager.PERMISSION_GRANTED)return;boolean urgent="urgent".equals(message.getData().get("priority"));boolean sound=!"false".equals(message.getData().get("sound"));Intent open=new Intent(this,ConnectionActivity.class).putExtra("amc_path",urgent?"/#tareas":"/#avisos");PendingIntent intent=PendingIntent.getActivity(this,0,open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);Notification n=new Notification.Builder(this,sound?(urgent?"amc_urgent":"amc_updates"):"amc_silent").setSmallIcon(android.R.drawable.ic_dialog_info).setContentTitle(message.getNotification()!=null?message.getNotification().getTitle():(urgent?"URGENTE · AMC":"AMC Construcciones y Arreglos")).setContentText(message.getNotification()!=null?message.getNotification().getBody():"Tenés una nueva novedad. Abrí AMC para verla.").setContentIntent(intent).setAutoCancel(true).build();getSystemService(NotificationManager.class).notify(message.getMessageId()==null?1:message.getMessageId().hashCode(),n);}
}
