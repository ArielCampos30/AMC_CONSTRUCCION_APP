package com.amc.connected;
public class AMCApplication extends android.app.Application { @Override public void onCreate(){super.onCreate();PushService.initialize(this);} }
