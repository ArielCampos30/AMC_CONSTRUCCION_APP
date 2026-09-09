import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../server.mjs';
import {totpCode} from '../twofactor.mjs';

const origin='http://localhost:4180';
const key='test-only-two-factor-key-32-bytes-minimum';

const actor=base=>({
 cookie:'',csrf:'',
 async call(path,body,status=200){
  const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:this.cookie,'X-CSRF-Token':this.csrf},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const data=await response.json();
  assert.equal(response.status,status,JSON.stringify(data));
  const setCookie=response.headers.get('set-cookie');if(setCookie)this.cookie=setCookie.split(';')[0];
  if(data.csrf)this.csrf=data.csrf;
  return data;
 }
});

test('admin two-factor setup, TOTP login and one-use recovery codes work end to end',async()=>{
 const app=createApp({dbPath:':memory:',origin,twoFactorKey:key});
 app.addUser('owner-2fa@amc.test','Strong-Owner-2026!','AMC','admin');
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+app.server.address().port;
 try{
  const admin=actor(base);
  await admin.call('/api/login',{email:'owner-2fa@amc.test',password:'Strong-Owner-2026!'});
  let state=await admin.call('/api/state');
  assert.deepEqual(state.twoFactor,{available:true,enabled:false,pending:false});

  const setup=await admin.call('/api/admin/2fa/setup',{password:'Strong-Owner-2026!'});
  assert.match(setup.secret,/^[A-Z2-7]+$/);
  assert.match(setup.uri,/^otpauth:\/\/totp\//);
  state=await admin.call('/api/state');
  assert.equal(state.twoFactor.pending,true);

  const enabled=await admin.call('/api/admin/2fa/enable',{code:totpCode(setup.secret)});
  assert.equal(enabled.ok,true);
  assert.equal(enabled.recoveryCodes.length,8);
  assert.equal(new Set(enabled.recoveryCodes).size,8);

  await admin.call('/api/logout',{});
  admin.cookie='';admin.csrf='';
  const missing=await admin.call('/api/login',{email:'owner-2fa@amc.test',password:'Strong-Owner-2026!'},401);
  assert.equal(missing.requiresTwoFactor,true);

  await admin.call('/api/login',{email:'owner-2fa@amc.test',password:'Strong-Owner-2026!',code:totpCode(setup.secret)});
  state=await admin.call('/api/state');
  assert.equal(state.twoFactor.enabled,true);

  await admin.call('/api/logout',{});
  admin.cookie='';admin.csrf='';
  await admin.call('/api/login',{email:'owner-2fa@amc.test',password:'Strong-Owner-2026!',code:enabled.recoveryCodes[0]});
  await admin.call('/api/logout',{});
  admin.cookie='';admin.csrf='';
  const reused=await admin.call('/api/login',{email:'owner-2fa@amc.test',password:'Strong-Owner-2026!',code:enabled.recoveryCodes[0]},401);
  assert.equal(reused.requiresTwoFactor,true);
 }finally{
  await new Promise(resolve=>app.server.close(resolve));
 }
});

test('two-factor remains optional for non-admin accounts and reports unavailable without a server key',async()=>{
 const app=createApp({dbPath:':memory:',origin,twoFactorKey:''});
 app.addUser('owner-no-2fa@amc.test','Strong-Owner-2026!','AMC','admin');
 app.addUser('client-no-2fa@amc.test','Client-Strong-2026!','Cliente','client');
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+app.server.address().port;
 try{
  const admin=actor(base);await admin.call('/api/login',{email:'owner-no-2fa@amc.test',password:'Strong-Owner-2026!'});
  assert.equal((await admin.call('/api/state')).twoFactor.available,false);
  const client=actor(base);await client.call('/api/login',{email:'client-no-2fa@amc.test',password:'Client-Strong-2026!'});
  assert.equal((await client.call('/api/state')).user.role,'client');
 }finally{
  await new Promise(resolve=>app.server.close(resolve));
 }
});
