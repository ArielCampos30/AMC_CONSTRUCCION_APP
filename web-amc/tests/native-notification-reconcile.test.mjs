import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {reconcileNativeNotifications} from '../public/native-notification-reconcile-runtime.js';

test('reconciliación nativa conserva sólo IDs pendientes y tolera bridge ausente',()=>{
 let payload='';
 const ids=reconcileNativeNotifications({notices:[{id:'notice-a',read:false},{id:'notice-b',read:true},{id:'notice-a',read:false},{id:'',read:false}]},{reconcileNotifications:value=>payload=value});
 assert.deepEqual(ids,['notice-a']);
 assert.deepEqual(JSON.parse(payload),['notice-a']);
 assert.deepEqual(reconcileNativeNotifications({notices:[]},{}),[]);
 assert.doesNotThrow(()=>reconcileNativeNotifications({notices:null},undefined));
});

test('estado y contador visible reconcilian Android contra el estado autoritativo',async()=>{
 const [stateRuntime,noticeUI]=await Promise.all([
  readFile(new URL('../public/app-state-runtime.js',import.meta.url),'utf8'),
  readFile(new URL('../public/notice-ui.js',import.meta.url),'utf8')
 ]);
 assert.match(stateRuntime,/import \{reconcileNativeNotifications\} from '\.\/native-notification-reconcile-runtime\.js'/);
 assert.match(stateRuntime,/applyState\(next\);reconcileNativeNotifications\(next\);syncEmployeeOffline\(next\)/);
 assert.match(noticeUI,/reconcileNativeNotifications\(state\)/);
 assert.match(noticeUI,/function paintCount\(\)/);
});

test('Android identifica avisos y cancela sólo canales AMC que ya no están pendientes',async()=>{
 const [activity,push]=await Promise.all([
  readFile(new URL('../../app/src/main/java/com/amc/construcciones/MainActivity.java',import.meta.url),'utf8'),
  readFile(new URL('../../app/src/main/java/com/amc/construcciones/PushService.java',import.meta.url),'utf8')
 ]);
 assert.match(push,/static boolean isNoticeChannel\(String channel\)/);
 assert.match(push,/extras\.putString\("amc_notice_id",id\)/);
 assert.match(push,/\.addExtras\(extras\)/);
 assert.match(activity,/@JavascriptInterface public void reconcileNotifications\(String unreadIdsJson\)/);
 assert.match(activity,/manager\.getActiveNotifications\(\)/);
 assert.match(activity,/PushService\.isNoticeChannel\(active\.getNotification\(\)\.getChannelId\(\)\)/);
 assert.match(activity,/extras\.getString\("amc_notice_id"\)/);
 assert.match(activity,/unreadIds\.contains\(noticeId\)/);
 assert.match(activity,/unreadHashes\.contains\(active\.getId\(\)\)/);
 assert.match(activity,/if\(!keep\)manager\.cancel\(active\.getId\(\)\)/);
});
