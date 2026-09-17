import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../server.mjs';
import {createCommercialFollowupRuntime} from '../public/commercial-followup-runtime.js';

const origin='http://localhost:4180';

function actor(base){return {cookie:'',csrf:'',async call(path,body,status=200){const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:this.cookie,'X-CSRF-Token':this.csrf},...(body===undefined?{}:{body:JSON.stringify(body)})});const data=await response.json();assert.equal(response.status,status,JSON.stringify(data));if(response.headers.get('set-cookie'))this.cookie=response.headers.get('set-cookie').split(';')[0];if(data.csrf)this.csrf=data.csrf;return data;}};}

test('runtime comercial sólo intercepta su formulario y distingue guardar de contacto',async()=>{
 const calls=[],runtime=createCommercialFollowupRuntime({api:async(path,body)=>{calls.push({path,body});return {ok:true};}}),form={classList:{contains:value=>value==='commercial-followup-form'},dataset:{id:'request 1'}};
 assert.equal(await runtime.submit({classList:{contains:()=>false},dataset:{}},{},{}),false);
 assert.equal(await runtime.submit(form,{nextAction:'WhatsApp',nextActionDay:'2026-09-18',note:'Escribir por la tarde.'},{value:'save'}),true);
 assert.equal(await runtime.submit(form,{nextAction:'Llamar',nextActionDay:'2026-09-19',note:'Confirmó recepción.'},{value:'contacted'}),true);
 assert.deepEqual(calls,[
  {path:'/api/admin/commercial-followups/request%201',body:{nextAction:'WhatsApp',nextActionDay:'2026-09-18',note:'Escribir por la tarde.',action:'save'}},
  {path:'/api/admin/commercial-followups/request%201',body:{nextAction:'Llamar',nextActionDay:'2026-09-19',note:'Confirmó recepción.',action:'contacted'}}
 ]);
});

test('Admin guarda un único seguimiento por solicitud, registra contacto e historial sin exponerlo al cliente',async()=>{
 const app=createApp({dbPath:':memory:',origin});app.addUser('owner-commercial@amc.test','Strong-Owner-2026!','AMC','admin');await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+app.server.address().port;
 try{
  const admin=actor(base),client=actor(base);
  await admin.call('/api/login',{email:'owner-commercial@amc.test',password:'Strong-Owner-2026!'});
  await client.call('/api/register',{email:'cliente-commercial@amc.test',password:'Client-Commercial-2026!',name:'Cliente comercial'});
  const request=await client.call('/api/requests',{name:'Cliente comercial',phone:'3548000011',town:'Valle Hermoso',description:'Pintura interior',service:'Pintura',type:'presupuesto'},201);
  await client.call('/api/admin/commercial-followups/'+request.id,{nextAction:'WhatsApp',nextActionDay:'2026-09-18',note:'No debería guardar.',action:'save'},403);
  const first=await admin.call('/api/admin/commercial-followups/'+request.id,{nextAction:'WhatsApp',nextActionDay:'2026-09-18',note:'Enviar fotos de referencia.',action:'save'});
  assert.equal(first.requestId,request.id);assert.equal(first.lastContactAt,'');assert.equal(first.history.length,1);assert.equal(first.history[0].type,'updated');
  const second=await admin.call('/api/admin/commercial-followups/'+request.id,{nextAction:'Llamar',nextActionDay:'2026-09-19',note:'Presupuesto recibido.',action:'contacted'});
  assert.ok(second.lastContactAt);assert.equal(second.history.length,2);assert.equal(second.history[1].type,'contacted');
  const adminState=await admin.call('/api/state');assert.equal(adminState.commercialFollowups.length,1);assert.equal(adminState.commercialFollowups[0].nextAction,'Llamar');assert.equal(adminState.commercialFollowups[0].history.length,2);
  const clientState=await client.call('/api/state');assert.deepEqual(clientState.commercialFollowups,[]);
  await admin.call('/api/admin/commercial-followups/no-existe',{nextAction:'',nextActionDay:'',note:'',action:'save'},404);
 }finally{await new Promise(resolve=>app.server.close(resolve));}
});
