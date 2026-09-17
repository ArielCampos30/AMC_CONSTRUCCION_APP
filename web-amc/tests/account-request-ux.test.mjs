import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createApp} from '../server.mjs';
import {isProtectedPage,resolveAppPage} from '../public/app-page-router.js';

test('rutas de acceso separan recuperación externa y cambio autenticado',()=>{
 const guest={quotes:[],works:[],requests:[]};
 const client={...guest,user:{id:'client-1',role:'client'}};
 const employee={...guest,user:{id:'employee-1',role:'employee'}};
 const admin={...guest,user:{id:'admin-1',role:'admin'}};
 assert.equal(isProtectedPage('cambiar-contrasena'),true);
 assert.deepEqual(resolveAppPage('cambiar-contrasena',guest),{view:'auth',returnTo:'cambiar-contrasena'});
 assert.deepEqual(resolveAppPage('cambiar-contrasena',client),{view:'accounts',page:'cambiar-contrasena'});
 assert.deepEqual(resolveAppPage('cambiar-contrasena',employee),{view:'accounts',page:'cambiar-contrasena'});
 assert.deepEqual(resolveAppPage('cambiar-contrasena',admin),{view:'accounts',page:'cambiar-contrasena'});
 assert.deepEqual(resolveAppPage('recuperar',client),{view:'accounts',page:'cambiar-contrasena'});
 assert.deepEqual(resolveAppPage('restablecer',employee),{view:'accounts',page:'cambiar-contrasena'});
 assert.deepEqual(resolveAppPage('ingresar',client),{view:'profile'});
 assert.deepEqual(resolveAppPage('registro',admin),{view:'profile'});
});

test('cambio autenticado exige clave actual, mantiene la sesión y funciona para cliente y empleado',async()=>{
 const origin='http://localhost:4180',app=createApp({dbPath:':memory:',origin});
 app.addUser('owner@amc.test','Strong-Owner-2026!','AMC','admin');
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+app.server.address().port;
 const actor=()=>({cookie:'',csrf:'',async call(path,body,status=200){const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:this.cookie,'X-CSRF-Token':this.csrf},...(body===undefined?{}:{body:JSON.stringify(body)})});const data=await response.json();assert.equal(response.status,status,JSON.stringify(data));if(response.headers.get('set-cookie'))this.cookie=response.headers.get('set-cookie').split(';')[0];if(data.csrf)this.csrf=data.csrf;return data;}});
 try{
  const admin=actor(),client=actor();
  await admin.call('/api/login',{email:'owner@amc.test',password:'Strong-Owner-2026!'});
  await client.call('/api/register',{email:'client@amc.test',password:'Client-Test-2026!',passwordConfirm:'Client-Test-2026!',name:'Cliente'});
  await client.call('/api/change-password',{currentPassword:'Incorrecta-2026!',password:'Client-New-2026!'},403);
  await client.call('/api/change-password',{currentPassword:'Client-Test-2026!',password:'Client-Test-2026!'},400);
  await client.call('/api/change-password',{currentPassword:'Client-Test-2026!',password:'Client-New-2026!'});
  assert.equal((await client.call('/api/state')).user.email,'client@amc.test');
  const relogin=actor();
  await relogin.call('/api/login',{email:'client@amc.test',password:'Client-Test-2026!'},401);
  await relogin.call('/api/login',{email:'client@amc.test',password:'Client-New-2026!'});
  const employeeAccount={email:'employee@amc.test',password:'Strong-Employee-2026!',name:'Empleado'};
  await admin.call('/api/employees',employeeAccount,201);
  const employee=actor();await employee.call('/api/login',employeeAccount);
  await employee.call('/api/change-password',{currentPassword:'Strong-Employee-2026!',password:'Employee-New-2026!'});
  assert.equal((await employee.call('/api/state')).user.role,'employee');
 }finally{await new Promise(resolve=>app.server.close(resolve));}
});

test('contrato mantiene recuperación pública y cambio propio protegido',async()=>{
 const [recovery,dispatcher,account]=await Promise.all([
  readFile(new URL('../recovery.mjs',import.meta.url),'utf8'),
  readFile(new URL('../server-request-dispatcher.mjs',import.meta.url),'utf8'),
  readFile(new URL('../public/accounts-closure-ui.js',import.meta.url),'utf8')
 ]);
 assert.match(recovery,/\/api\/change-password/);
 assert.match(recovery,/passwordMatches/);
 assert.match(dispatcher,/\/api\/change-password/);
 assert.match(account,/currentPassword/);
 assert.match(account,/Las contraseñas nuevas no coinciden/);
});
