import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createApp} from '../server.mjs';

const origin='http://localhost:4180';
function actor(base){return {cookie:'',csrf:'',async call(path,body,expected=200,method=body===undefined?'GET':'POST'){const response=await fetch(base+path,{method,headers:{Origin:origin,'Content-Type':'application/json',Cookie:this.cookie,'X-CSRF-Token':this.csrf},...(body===undefined?{}:{body:JSON.stringify(body)})});assert.equal(response.status,expected,`${method} ${path}`);const setCookie=response.headers.get('set-cookie');if(setCookie)this.cookie=setCookie.split(';')[0];const data=await response.json();if(data.csrf)this.csrf=data.csrf;return data;}};}

test('diagnóstico del sistema queda fuera del estado general y sólo lo puede leer admin',async()=>{
 const app=createApp({dbPath:':memory:',origin});
 app.addUser('owner-state-system@amc.test','Strong-Owner-2026!','AMC','admin');
 app.addUser('client-state-system@amc.test','Strong-Client-2026!','Cliente','client');
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+app.server.address().port;
 try{
  const admin=actor(base),client=actor(base),guest=actor(base);
  await admin.call('/api/login',{email:'owner-state-system@amc.test',password:'Strong-Owner-2026!'});
  const state=await admin.call('/api/state');
  assert.equal(Object.hasOwn(state,'system'),false);
  const diagnostic=await admin.call('/api/state/system');
  assert.equal(diagnostic.system.database,'SQLite');
  assert.equal(typeof diagnostic.system.documents,'number');
  assert.equal(typeof diagnostic.system.files,'number');
  assert.equal(typeof diagnostic.system.devices,'number');

  await client.call('/api/login',{email:'client-state-system@amc.test',password:'Strong-Client-2026!'});
  assert.equal((await client.call('/api/state/system',undefined,403)).error,'Acceso restringido.');
  assert.equal((await guest.call('/api/state/system',undefined,401)).error,'Ingresá a tu cuenta para continuar.');
 }finally{await new Promise(resolve=>app.server.close(resolve));}
});

test('la interfaz de sistema carga el diagnóstico dedicado de forma diferida',async()=>{
 const [routes,ui]=await Promise.all([
  readFile(new URL('../state-routes.mjs',import.meta.url),'utf8'),
  readFile(new URL('../public/admin-system-ui.js',import.meta.url),'utf8')
 ]);
 assert.match(routes,/p==='\/api\/state\/system'/);
 assert.doesNotMatch(routes,/system:user\.role==='admin'\?systemStatus/);
 assert.match(ui,/fetch\('\/api\/state\/system'/);
 assert.doesNotMatch(ui,/state\.system/);
 assert.match(ui,/Date\.now\(\)-loadedAt<30000/);
});
