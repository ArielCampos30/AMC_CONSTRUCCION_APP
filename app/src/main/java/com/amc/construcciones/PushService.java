package com.amc.construcciones;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

public class PushService extends FirebaseMessagingService {
    private static final String URGENT="amc_urgent_v2",UPDATES="amc_updates_v2",SILENT="amc_silent_v2";

    @Override public void onNewToken(String token) { getSharedPreferences("amc",MODE_PRIVATE).edit().putString("fcm",token).apply(); }

    private void ensureChannels(NotificationManager manager){
        if(Build.VERSION.SDK_INT<26)return;
        NotificationChannel urgent=new NotificationChannel(URGENT,"Avisos urgentes AMC",NotificationManager.IMPORTANCE_HIGH);
        NotificationChannel updates=new NotificationChannel(UPDATES,"Novedades AMC",NotificationManager.IMPORTANCE_DEFAULT);
        NotificationChannel silent=new NotificationChannel(SILENT,"Novedades silenciosas AMC",NotificationManager.IMPORTANCE_LOW);
        silent.setSound(null,null);silent.enableVibration(false);
        manager.createNotificationChannel(urgent);manager.createNotificationChannel(updates);manager.createNotificationChannel(silent);
    }

    @Override public void onMessageReceived(RemoteMessage message) {
        String id=message.getData().getOrDefault("id",message.getMessageId()==null?"amc":message.getMessageId());
        String url=message.getData().getOrDefault("url","/#avisos");
        String title=message.getData().getOrDefault("title","AMC Construcciones y Arreglos");
        String body=message.getData().getOrDefault("body","Tenés una nueva novedad.");
        boolean sound=!"false".equalsIgnoreCase(message.getData().getOrDefault("sound","true"));
        boolean urgent="urgent".equals(message.getData().get("priority"));
        String channel=!sound?SILENT:urgent?URGENT:UPDATES;
        NotificationManager manager=getSystemService(NotificationManager.class);ensureChannels(manager);
        Intent open=new Intent(this,MainActivity.class).putExtra("amc_url",url).setData(Uri.parse("amc://notice/"+Uri.encode(id))).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP);
        int notificationId=id.hashCode();
        PendingIntent pending=PendingIntent.getActivity(this,notificationId,open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        NotificationCompat.Builder builder=new NotificationCompat.Builder(this,channel).setSmallIcon(R.drawable.ic_notification).setContentTitle(title).setContentText(body).setAutoCancel(true).setContentIntent(pending);
        if(sound)builder.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION));else builder.setSilent(true);
        manager.notify(notificationId,builder.build());
    }
}
