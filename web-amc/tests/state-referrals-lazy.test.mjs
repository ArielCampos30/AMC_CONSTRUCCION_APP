import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createApp} from '../server.mjs';

const origin='http://localhost:4180';
function actor(base){return {cookie:'',csrf:'',async call(path,body,expected=200,method=body===undefined?'GET':'POST'){const response=await fetch(base+path,{method,headers:{Origin:origin,'Content-Type':'application/json',Cookie:this.cookie,'X-CSRF-Token':this.csrf},...(body===undefined?{}:{body:JSON.stringify(body)})});assert.equal(response.status,expected,`${method} ${path}`);const setCookie=response.headers.get('set-cookie');if(setCookie)this.cookie=setCookie.split(';')[0];const data=await response.json();if(data.csrf)this.csrf=data.csrf;return data;}};}

test('referidos salen del estado general y se cargan desde su endpoint dedicado',async()=>{
 const app=createApp({dbPath:':memory:',origin});
 app.addUser('referral-owner@amc.test','Strong-Client-2026!','Cliente','client');
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+app.server.address().port;
 try{
  const client=actor(base);
  await client.call('/api/login',{email:'referral-owner@amc.test',password:'Strong-Client-2026!'});
  await client.call('/api/referrals',{name:'Pedro',note:'Cocina'},201);
  const state=await client.call('/api/state');
  assert.deepEqual(state.referrals,[]);
  const dedicated=await client.call('/api/referrals');
  assert.equal(dedicated.referrals.length,1);
  assert.equal(dedicated.referrals[0].name,'Pedro');
  assert.equal(dedicated.referrals[0].note,'Cocina');
 }finally{await new Promise(resolve=>app.server.close(resolve));}
});

test('el estado conserva la clave vacía sin consultar referidos históricos',async()=>{
 const source=await readFile(new URL('../state-routes.mjs',import.meta.url),'utf8');
 assert.match(source,/referrals:\[\]/);
 assert.doesNotMatch(source,/referrals:all\('referral',user\.id\)/);
});
