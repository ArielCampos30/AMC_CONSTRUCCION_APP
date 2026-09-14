import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createApp} from '../server.mjs';

const planningSource=readFileSync(new URL('../planning.mjs',import.meta.url),'utf8');
const appearanceSource=readFileSync(new URL('../appearance.mjs',import.meta.url),'utf8');

test('appearance queda separado de planning',()=>{
 assert.doesNotMatch(planningSource,/\/api\/appearance/);
 assert.doesNotMatch(planningSource,/publicMedia/);
 assert.doesNotMatch(planningSource,/appearanceSnapshot/);
 assert.match(appearanceSource,/\/api\/appearance/);
 assert.match(appearanceSource,/\/api\/appearance\/restore/);
 assert.match(appearanceSource,/publicMedia/);
 assert.match(appearanceSource,/appearanceSnapshot/);
});

test('appearance conserva estado, permisos, media pública e historial',async()=>{
 const origin='http://localhost:4180',app=createApp({dbPath:':memory:',demo:true,origin});
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+app.server.address().port;
 const actor=()=>({cookie:'',csrf:'',async call(path,body,status=200){
  const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:this.cookie,'X-CSRF-Token':this.csrf},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const value=response.headers.get('content-type')?.includes('json')?await response.json():await response.arrayBuffer();
  assert.equal(response.status,status,typeof value==='object'&&!(value instanceof ArrayBuffer)?JSON.stringify(value):path);
  if(response.headers.get('set-cookie'))this.cookie=response.headers.get('set-cookie').split(';')[0];
  if(value?.csrf)this.csrf=value.csrf;
  return value;
 }});
 try{
  const admin=actor(),client=actor(),guest=actor();
  await admin.call('/api/login',{email:'admin@amc.test',password:'AMC-Prueba-2026!'});
  await client.call('/api/login',{email:'cliente@amc.test',password:'Cliente-Prueba-2026!'});
  const initialGuest=await guest.call('/api/state');
  assert.equal(initialGuest.appearance.title,'Tu casa.\nTu proyecto.\nTodo en AMC.');
  assert.equal(initialGuest.appearance.history,undefined);

  const photo=await admin.call('/api/upload',{mime:'image/jpeg',base64:Buffer.from([255,216,255,224,0,0]).toString('base64')},201);
  await client.call('/api/appearance',{title:'No permitido',subtitle:'Cliente',photos:[]},403);
  await admin.call('/api/appearance',{title:'AMC Uno',subtitle:'Primera portada',photos:[{id:photo.id,caption:'Trabajo real'}]});

  const publicState=await guest.call('/api/state');
  assert.equal(publicState.appearance.title,'AMC Uno');
  assert.equal(publicState.appearance.subtitle,'Primera portada');
  assert.equal(publicState.appearance.photos[0].url,photo.url);
  assert.equal(publicState.appearance.history,undefined);
  await guest.call(photo.url);

  await admin.call('/api/appearance',{title:'AMC Dos',subtitle:'Segunda portada',photos:[]});
  const adminState=await admin.call('/api/state');
  assert.ok(Array.isArray(adminState.appearance.history));
  assert.equal(adminState.appearance.history[0].title,'AMC Uno');
  const previousVersion=adminState.appearance.history[0].versionAt;

  await admin.call('/api/appearance/restore',{versionAt:previousVersion});
  const restored=await guest.call('/api/state');
  assert.equal(restored.appearance.title,'AMC Uno');
  assert.equal(restored.appearance.photos[0].url,photo.url);
  await guest.call(photo.url);
 }finally{
  await new Promise(resolve=>app.server.close(resolve));
 }
});
