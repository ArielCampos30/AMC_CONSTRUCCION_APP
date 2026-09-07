package com.amc.construcciones;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.media.RingtoneManager;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

public class PushService extends FirebaseMessagingService {
    @Override public void onNewToken(String token) { getSharedPreferences("amc",MODE_PRIVATE).edit().putString("fcm",token).apply(); }
    @Override public void onMessageReceived(RemoteMessage message) {
        String url=message.getData().getOrDefault("url","/#avisos");
        String title=message.getNotification()!=null?message.getNotification().getTitle():"AMC Construcciones y Arreglos";
        String body=message.getNotification()!=null?message.getNotification().getBody():"Tenés una nueva novedad.";
        String channel="urgent".equals(message.getData().get("priority"))?"amc_urgent":"amc_updates";
        NotificationManager manager=getSystemService(NotificationManager.class);
        if(Build.VERSION.SDK_INT>=26){NotificationChannel c=new NotificationChannel(channel,channel.equals("amc_urgent")?"Avisos urgentes AMC":"Novedades AMC",NotificationManager.IMPORTANCE_HIGH);manager.createNotificationChannel(c);}
        Intent open=new Intent(this,MainActivity.class).putExtra("amc_url",url).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pending=PendingIntent.getActivity(this,0,open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        manager.notify((message.getMessageId()==null?url:message.getMessageId()).hashCode(),new NotificationCompat.Builder(this,channel).setSmallIcon(R.drawable.ic_notification).setContentTitle(title).setContentText(body).setAutoCancel(true).setContentIntent(pending).setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)).build());
    }
}
