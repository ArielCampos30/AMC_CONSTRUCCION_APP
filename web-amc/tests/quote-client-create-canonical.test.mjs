import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createApp} from '../server.mjs';

const origin='http://localhost:4180';
const actor=base=>({cookie:'',csrf:'',async call(path,body,status=200){
 const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:this.cookie,'X-CSRF-Token':this.csrf},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const value=await response.json();
 assert.equal(response.status,status,JSON.stringify(value));
 if(response.headers.get('set-cookie'))this.cookie=response.headers.get('set-cookie').split(';')[0];
 if(value.csrf)this.csrf=value.csrf;
 return value;
}});

test('el alta canónica del Cotizador intercepta el submit antes del flujo histórico y filtra letras del teléfono',()=>{
 const source=readFileSync(new URL('../public/quote-client-create-controller.js',import.meta.url),'utf8');
 assert.match(source,/window\.addEventListener\('submit',submit,true\)/);
 assert.match(source,/event\.stopImmediatePropagation\(\)/);
 assert.match(source,/replace\(\/\\D\/g,''\)/);
 assert.match(source,/El teléfono debe tener al menos 8 números/);
 assert.match(source,/api\('\/api\/admin\/clients',draft\)/);
});

test('el servidor rechaza letras en teléfonos y conserva la deduplicación por número normalizado',async()=>{
 const app=createApp({dbPath:':memory:',origin});
 app.addUser('admin@phone.test','Strong-Admin-2026!','AMC','admin');
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+app.server.address().port,admin=actor(base);
 try{
  await admin.call('/api/login',{email:'admin@phone.test',password:'Strong-Admin-2026!'});
  const invalid=await admin.call('/api/admin/clients',{name:'Cliente inválido',phone:'3548ABC1234',town:'Valle Hermoso'},400);
  assert.match(invalid.error,/no admite letras/i);
  const created=await admin.call('/api/admin/clients',{name:'Cliente válido',phone:'3548123456',town:'Valle Hermoso'},201);
  assert.equal(created.phone,'3548123456');
  const duplicate=await admin.call('/api/admin/clients',{name:'Duplicado',phone:'+54 9 3548 123456',town:'Valle Hermoso'},200);
  assert.equal(duplicate.duplicate.id,created.id);
 }finally{
  await new Promise(resolve=>app.server.close(resolve));
 }
});
