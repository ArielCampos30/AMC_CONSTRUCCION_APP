import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../server.mjs';

const origin='https://app.amcconstrucciones.com.ar';
function actor(base){return {cookie:'',csrf:'',async call(path,body,status=200){const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:this.cookie,'X-CSRF-Token':this.csrf},...(body===undefined?{}:{body:JSON.stringify(body)})});const data=await response.json();assert.equal(response.status,status,`${path}: ${JSON.stringify(data)}`);const setCookie=response.headers.get('set-cookie');if(setCookie)this.cookie=setCookie.split(';')[0];if(data.csrf)this.csrf=data.csrf;return data;}};}

test('Administración comparte el mismo lado del bloqueo aunque cambie la cuenta admin',async()=>{
 const app=createApp({dbPath:':memory:',origin,sendRecovery:async()=>{}});
 app.addUser('admin-a-ugc@amc.test','Strong-Admin-A-UGC-2026!','Admin A','admin');
 app.addUser('admin-b-ugc@amc.test','Strong-Admin-B-UGC-2026!','Admin B','admin');
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+app.server.address().port;
 try{
  const adminA=actor(base),adminB=actor(base),client=actor(base);
  await adminA.call('/api/login',{email:'admin-a-ugc@amc.test',password:'Strong-Admin-A-UGC-2026!'});
  await adminB.call('/api/login',{email:'admin-b-ugc@amc.test',password:'Strong-Admin-B-UGC-2026!'});
  await client.call('/api/register',{email:'cliente-admin-side@amc.test',password:'Strong-Client-Side-2026!',passwordConfirm:'Strong-Client-Side-2026!',name:'Cliente Admin Side',acceptTerms:true});
  const clientId=(await client.call('/api/state')).user.id;

  const blocked=await adminA.call('/api/ugc/blocks',{scope:'client',participantId:clientId,blocked:true});
  assert.equal(blocked.block.blockedByRole,'admin');
  await client.call('/api/client-chat/messages',{text:'Debe quedar bloqueado',photos:[],idempotencyKey:'admin-side-blocked'},409);

  const unblocked=await adminB.call('/api/ugc/blocks',{scope:'client',participantId:clientId,blocked:false});
  assert.equal(unblocked.block.id,blocked.block.id);
  assert.equal(unblocked.block.active,false);
  const state=await client.call('/api/state');
  assert.equal(state.ugc.blocks.some(item=>item.active&&item.participantId===clientId),false);

  const restored=await client.call('/api/client-chat/messages',{text:'Administración restauró el chat',photos:[],idempotencyKey:'admin-side-restored'},201);
  assert.equal(restored.clientId,clientId);
 }finally{
  await new Promise(resolve=>app.server.close(resolve));
 }
});
