import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createApp} from '../server.mjs';

const origin='http://localhost:4180';
const actor=base=>({cookie:'',csrf:'',async call(path,body,status=200,method){const actual=method||(body===undefined?'GET':'POST'),response=await fetch(base+path,{method:actual,headers:{Origin:origin,'Content-Type':'application/json',Cookie:this.cookie,'X-CSRF-Token':this.csrf},...(actual==='GET'?{}:{body:JSON.stringify(body||{})})});const data=await response.json();assert.equal(response.status,status,JSON.stringify(data));const cookie=response.headers.get('set-cookie');if(cookie)this.cookie=cookie.split(';')[0];if(data.csrf)this.csrf=data.csrf;return data;}});

test('chat móvil conserva el compositor, sigue al teclado y evita avisos del hilo visible',async()=>{
 const [runtime,confirm,index,manifest,activity,push,notices]=await Promise.all([
  readFile(new URL('../public/mobile-runtime-fixes.js',import.meta.url),'utf8'),
  readFile(new URL('../public/amc-confirm.js',import.meta.url),'utf8'),
  readFile(new URL('../public/index.html',import.meta.url),'utf8'),
  readFile(new URL('../../app/src/main/AndroidManifest.xml',import.meta.url),'utf8'),
  readFile(new URL('../../app/src/main/java/com/amc/construcciones/MainActivity.java',import.meta.url),'utf8'),
  readFile(new URL('../../app/src/main/java/com/amc/construcciones/PushService.java',import.meta.url),'utf8'),
  readFile(new URL('../public/notice-ui.js',import.meta.url),'utf8')
 ]);
 assert.match(index,/mobile-runtime-fixes\.js/);
 assert.match(runtime,/compact-composer\.no-attach\{display:grid!important;grid-template-columns:minmax\(0,1fr\) 44px!important/);
 assert.match(runtime,/window\.visualViewport/);
 assert.match(runtime,/amc-keyboard-open/);
 assert.match(runtime,/refreshPushToken/);
 assert.match(runtime,/amcActiveChatRoute/);
 assert.match(confirm,/position:fixed;inset:0;margin:auto/);
 assert.match(confirm,/@media\(max-width:560px\)/);
 assert.match(manifest,/android:windowSoftInputMode="adjustResize"/);
 assert.match(activity,/putBoolean\("foreground",true\)/);
 assert.match(activity,/refreshPushToken\(\)/);
 assert.match(activity,/setActiveChatRoute\(String route\)/);
 assert.match(push,/getBoolean\("foreground",false\)/);
 assert.match(push,/activeChatRoute\.equals\(url\)\)return/);
 assert.match(notices,/function suppressActiveChat\(notice\)/);
 assert.match(notices,/activeChatRoute\(\)/);
 assert.match(notices,/api\('\/api\/notices\/read',\{route:active\}\)/);
});

test('presupuesto avisa sólo al cliente cuando el PDF está listo y el mismo token Android pertenece a la última cuenta que lo registra',async()=>{
 const app=createApp({dbPath:':memory:',origin});
 app.addUser('mobile-owner@amc.test','Strong-Owner-2026!','AMC','admin');
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+app.server.address().port;
 try{
  const admin=actor(base),client=actor(base);
  await admin.call('/api/login',{email:'mobile-owner@amc.test',password:'Strong-Owner-2026!'});
  await client.call('/api/register',{email:'mobile-client@amc.test',password:'Strong-Client-2026!',name:'Cliente Mobile'});
  const clientState=await client.call('/api/state');
  const token='amc_test_same_android_token_1234567890';
  const first=await client.call('/api/devices',{kind:'android',subscription:{token}});
  const second=await admin.call('/api/devices',{kind:'android',subscription:{token}});
  assert.equal(first.deviceId,second.deviceId);
  assert.equal(app.db.prepare('SELECT userId FROM devices WHERE id=?').get(second.deviceId).userId,(await admin.call('/api/state')).user.id);

  await client.call('/api/devices',{kind:'android',subscription:{token}});
  assert.equal(app.db.prepare('SELECT userId FROM devices WHERE id=?').get(second.deviceId).userId,clientState.user.id);
  const request=await client.call('/api/requests',{name:'Cliente Mobile',phone:'3548000099',town:'La Falda',description:'Trabajo de prueba',service:'Albañilería',type:'presupuesto'},201);
  const quote=await admin.call('/api/quotes',{requestId:request.id,externalId:'mobile-quote',version:'b'.repeat(64),number:'AMC-MOBILE-1',items:[{description:'Trabajo'}],total:619000},201);
  let afterClient=await client.call('/api/state');
  assert.equal(afterClient.notices.some(n=>n.url==='/#presupuesto/'+quote.id&&n.title==='Tu presupuesto está listo'),false);
  const pdf=await admin.call('/api/upload',{mime:'application/pdf',base64:Buffer.from('%PDF-1.4 mobile').toString('base64')},201);
  await admin.call('/api/quotes/'+quote.id+'/pdf',{pdfId:pdf.id});
  afterClient=await client.call('/api/state');const afterAdmin=await admin.call('/api/state');
  assert.ok(afterClient.notices.some(n=>n.url==='/#presupuesto/'+quote.id&&n.title==='Tu presupuesto está listo'));
  assert.equal(afterAdmin.notices.some(n=>n.url==='/#presupuesto/'+quote.id),false);
 }finally{await new Promise(resolve=>app.server.close(resolve));}
});
