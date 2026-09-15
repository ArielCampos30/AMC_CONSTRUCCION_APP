import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createApp} from '../server.mjs';

const source=name=>readFile(new URL('../'+name,import.meta.url),'utf8');

test('Compras tiene dominio propio y no vuelve a Team',async()=>{
 const [team,purchases,server,state,media]=await Promise.all([
  source('team.mjs'),source('purchases.mjs'),source('server.mjs'),source('state-routes.mjs'),source('media-access.mjs')
 ]);
 const dispatcher=await source('server-request-dispatcher.mjs');
 assert.doesNotMatch(team,/\/api\/purchases/);
 assert.doesNotMatch(team,/purchaseView/);
 assert.doesNotMatch(team,/purchases:/);
 assert.match(purchases,/export function purchaseFeatures/);
 assert.match(purchases,/\/api\/purchases/);
 assert.match(purchases,/purchases:purchaseView\(user\)/);
 const composition=await readFile(new URL('../app-composition.mjs',import.meta.url),'utf8');
 assert.match(composition,/const purchases=purchaseFeatures/);
 assert.match(dispatcher,/await purchases\.route/);
 assert.match(state,/\.\.\.purchases\.state\(user\)/);
 assert.match(media,/purchases\.media\(user,p\)/);
});

test('Compras conserva visibilidad, idempotencia, aviso y privacidad del comprobante',async()=>{
 const origin='http://localhost:4180',app=createApp({dbPath:':memory:',origin});
 app.addUser('owner@amc.test','Strong-Owner-2026!','AMC','admin');
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+app.server.address().port;
 const actor=()=>({cookie:'',csrf:'',async call(p,b,status=200){
  const r=await fetch(base+p,{method:b===undefined?'GET':'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:this.cookie,'X-CSRF-Token':this.csrf},...(b===undefined?{}:{body:JSON.stringify(b)}),redirect:'manual'});
  const data=(r.headers.get('content-type')||'').includes('json')?await r.json():await r.text();
  assert.equal(r.status,status,JSON.stringify(data));
  if(r.headers.get('set-cookie'))this.cookie=r.headers.get('set-cookie').split(';')[0];
  if(data.csrf)this.csrf=data.csrf;
  return data;
 }});
 try{
  const admin=actor(),client=actor(),other=actor(),employee=actor();
  await admin.call('/api/login',{email:'owner@amc.test',password:'Strong-Owner-2026!'});
  await client.call('/api/register',{email:'client@amc.test',password:'Strong-Client-2026!',name:'Cliente'});
  await other.call('/api/register',{email:'other@amc.test',password:'Strong-Other-2026!',name:'Otro'});
  const employeeAccount={email:'employee@amc.test',password:'Strong-Employee-2026!',name:'Empleado'};
  await admin.call('/api/employees',employeeAccount,201);
  await employee.call('/api/login',employeeAccount);
  const request=await client.call('/api/requests',{name:'Cliente',phone:'3515551234',town:'La Falda',description:'Compra de materiales',service:'Pintura',type:'presupuesto'},201);
  const invoice=await admin.call('/api/upload',{mime:'application/pdf',base64:Buffer.from('%PDF-1.4\nCompra AMC').toString('base64')},201);
  const day=new Date(Date.now()-86400000).toISOString().slice(0,10);
  const payload={requestId:request.id,day,vendor:'Corralón AMC',reference:'F-100',amount:50000,detail:'Materiales para la obra.',fileId:invoice.id,idempotencyKey:'purchase-domain-001'};
  const purchase=await admin.call('/api/purchases',payload,201);
  assert.equal((await admin.call('/api/purchases',payload)).id,purchase.id);
  assert.equal((await admin.call('/api/state')).purchases.length,1);
  assert.equal((await client.call('/api/state')).purchases.length,0);
  assert.equal((await other.call('/api/state')).purchases.length,0);
  assert.equal((await employee.call('/api/state')).purchases.length,0);
  await admin.call(invoice.url);
  await client.call(invoice.url,undefined,404);
  await other.call(invoice.url,undefined,404);
  await employee.call(invoice.url,undefined,404);
  await client.call('/api/purchases/'+purchase.id+'/send',{},403);
  const noticesBefore=(await client.call('/api/state')).notices.length;
  await admin.call('/api/purchases/'+purchase.id+'/send',{});
  await admin.call('/api/purchases/'+purchase.id+'/send',{});
  const shared=await client.call('/api/state');
  assert.equal(shared.purchases.length,1);
  assert.equal(shared.purchases[0].id,purchase.id);
  assert.ok(shared.purchases[0].sentAt);
  assert.equal(shared.notices.length,noticesBefore+1);
  await client.call(invoice.url);
  await other.call(invoice.url,undefined,404);
  await employee.call(invoice.url,undefined,404);
 }finally{
  await new Promise(r=>app.server.close(r));
 }
});
