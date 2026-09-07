import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createApp} from '../server.mjs';

test('employee v4 has isolated mobile navigation, filters and native camera contracts',async()=>{
 const [app,team,css,sw]=await Promise.all([
  readFile(new URL('../public/app.js',import.meta.url),'utf8'),
  readFile(new URL('../public/team-ui.js',import.meta.url),'utf8'),
  readFile(new URL('../public/employee-v4.css',import.meta.url),'utf8'),
  readFile(new URL('../public/sw.js',import.meta.url),'utf8')
 ]);
 assert.match(app,/\['inicio-empleado','Inicio'.*\['mis-trabajos','Mis trabajos'.*\['chat-equipo','Chat'.*\['perfil','Perfil'/s);
 assert.match(team,/¿Qué tengo que hacer hoy\?/);
 assert.match(team,/Hoy','Pendientes','En curso','Finalizados/);
 assert.match(team,/Elegir de galería/);
 assert.match(team,/Sacar foto/);
 assert.match(team,/capture="environment"/);
 assert.match(team,/Antes','Durante','Después/);
 assert.match(css,/@media\(max-width:390px\)/);
 assert.match(css,/grid-template-columns:repeat\(4,1fr\)/);
 assert.doesNotMatch(sw,/\/api\//);
});

test('employee staff unread badge clears only when that employee reads the chat',async()=>{
 const origin='http://localhost:4180',service=createApp({dbPath:':memory:',origin});
 service.addUser('owner@amc.test','Strong-Owner-2026!','AMC','admin');
 await new Promise(resolve=>service.server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+service.server.address().port;
 const actor=()=>({cookie:'',csrf:'',async call(path,body,status=200){const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:this.cookie,'X-CSRF-Token':this.csrf},...(body===undefined?{}:{body:JSON.stringify(body)})});const data=await response.json();assert.equal(response.status,status,JSON.stringify(data));if(response.headers.get('set-cookie'))this.cookie=response.headers.get('set-cookie').split(';')[0];if(data.csrf)this.csrf=data.csrf;return data;}});
 try{
  const admin=actor(),employee=actor();
  await admin.call('/api/login',{email:'owner@amc.test',password:'Strong-Owner-2026!'});
  const account={email:'empleado@amc.test',password:'Strong-Employee-2026!',name:'Empleado'};
  const created=await admin.call('/api/employees',account,201);
  await employee.call('/api/login',account);
  await admin.call('/api/staff-chat/messages',{employeeId:created.id,text:'Nuevo destino',idempotencyKey:'staff-unread-001'},201);
  assert.equal((await employee.call('/api/state')).staffUnread,1);
  await employee.call('/api/staff-chat/read',{});
  assert.equal((await employee.call('/api/state')).staffUnread,0);
  await admin.call('/api/staff-chat/messages',{employeeId:created.id,text:'Otro mensaje',idempotencyKey:'staff-unread-002'},201);
  assert.equal((await employee.call('/api/state')).staffUnread,1);
 }finally{await new Promise(resolve=>service.server.close(resolve));}
});

