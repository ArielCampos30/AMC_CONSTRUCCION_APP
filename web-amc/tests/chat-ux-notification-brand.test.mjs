import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(path,import.meta.url),'utf8');

test('chat abre sobre el hilo visible, identifica el origen y muestra pendientes por grupo',async()=>{
 const view=await read('../public/chat-view.js');
 assert.match(view,/const visibleLog=.*#amc-chat-dialog\[open\] \.message-log/);
 assert.match(view,/scrollLatest\(log\)/);
 assert.match(view,/chat-kind-badge/);
 assert.match(view,/\?'ADMINISTRACIÓN':'EMPLEADO'/);
 assert.match(view,/\?'AMC':'CLIENTE'/);
 assert.match(view,/clientChatUnread/);
 assert.match(view,/chat-equipo/);
 assert.match(view,/chat-group-unread/);
 assert.match(view,/chat-contact-unread/);
});

test('envío de chat tiene transición suave sin forzar movimiento si el usuario reduce animaciones',async()=>{
 const view=await read('../public/chat-view.js');
 assert.match(view,/message-send-flight/);
 assert.match(view,/@keyframes amc-message-send-flight/);
 assert.match(view,/translate3d\(16px,28px,0\) scale\(\.92\)/);
 assert.match(view,/@media\(prefers-reduced-motion:reduce\)/);
});

test('notificaciones Android usan identidad visual AMC y conservan icono compatible de sistema',async()=>{
 const [push,manifest,colors]=await Promise.all([
  read('../../app/src/main/java/com/amc/construcciones/PushService.java'),
  read('../../app/src/main/AndroidManifest.xml'),
  read('../../app/src/main/res/values/colors.xml')
 ]);
 assert.match(push,/\.setSmallIcon\(R\.drawable\.ic_notification\)/);
 assert.match(push,/\.setLargeIcon\(BitmapFactory\.decodeResource\(getResources\(\),R\.drawable\.amc_logo\)\)/);
 assert.match(push,/\.setColor\(Color\.rgb\(13,102,97\)\)/);
 assert.match(push,/NotificationCompat\.BigTextStyle/);
 assert.match(manifest,/com\.google\.firebase\.messaging\.default_notification_icon/);
 assert.match(manifest,/@drawable\/ic_notification/);
 assert.match(manifest,/com\.google\.firebase\.messaging\.default_notification_color/);
 assert.match(manifest,/@color\/amc_notification_teal/);
 assert.match(colors,/amc_notification_teal">#0D6661/);
});
