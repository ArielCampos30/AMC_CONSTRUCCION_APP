import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../server.mjs';

test('auditoría prelaunch: segundo admin creado directamente obtiene permisos reales',async()=>{
 const origin='http://localhost:4180';
 const app=createApp({dbPath:':memory:',origin});
 app.addUser('owner@amc.test','Strong-Owner-2026!','AMC','admin');
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+app.server.address().port;
 const actor=()=>({cookie:'',csrf:'',async call(path,body,status=200){
  const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:this.cookie,'X-CSRF-Token':this.csrf},...(body===undefined?{}:{body:JSON.stringify(body)}),redirect:'manual'});
  const data=(response.headers.get('content-type')||'').includes('json')?await response.json():await response.text();
  assert.equal(response.status,status,JSON.stringify(data));
  if(response.headers.get('set-cookie'))this.cookie=response.headers.get('set-cookie').split(';')[0];
  if(data?.csrf)this.csrf=data.csrf;
  return data;
 }});
 try{
  const owner=actor(),secondAdmin=actor(),client=actor();
  await owner.call('/api/login',{email:'owner@amc.test',password:'Strong-Owner-2026!'});
  await client.call('/api/register',{email:'client@amc.test',password:'Strong-Client-2026!',name:'Cliente'});
  const secondCredentials={email:'second-admin@amc.test',password:'Strong-Admin-2026!',name:'Segundo Admin',role:'admin'};
  await client.call('/api/employees',secondCredentials,403);
  const created=await owner.call('/api/employees',secondCredentials,201);
  assert.ok(created.id);
  assert.equal(created.email,secondCredentials.email);
  await secondAdmin.call('/api/login',{email:secondCredentials.email,password:secondCredentials.password});
  const secondState=await secondAdmin.call('/api/state');
  assert.equal(secondState.user.role,'admin');
  assert.equal(secondState.user.email,secondCredentials.email);
  const employee=await secondAdmin.call('/api/employees',{email:'created-by-second-admin@amc.test',password:'Strong-Employee-2026!',name:'Empleado creado por segundo admin',role:'employee'},201);
  assert.ok(employee.id);
  const ownerState=await owner.call('/api/state');
  assert.ok(ownerState.employees.some(item=>item.id===created.id&&item.role==='admin'));
  assert.ok(ownerState.employees.some(item=>item.id===employee.id&&item.role==='employee'));
 }finally{
  await new Promise(resolve=>app.server.close(resolve));
 }
});
