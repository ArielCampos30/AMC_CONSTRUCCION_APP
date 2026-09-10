import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createApp} from '../server.mjs';

const origin='http://localhost:4180';
function actor(base){return {cookie:'',csrf:'',async call(path,body,expected=200,method=body===undefined?'GET':'POST'){const response=await fetch(base+path,{method,headers:{Origin:origin,'Content-Type':'application/json',Cookie:this.cookie,'X-CSRF-Token':this.csrf},...(body===undefined?{}:{body:JSON.stringify(body)})});assert.equal(response.status,expected,`${method} ${path}`);const setCookie=response.headers.get('set-cookie');if(setCookie)this.cookie=setCookie.split(';')[0];const data=await response.json();if(data.csrf)this.csrf=data.csrf;return data;}};}

test('administración carga el historial del equipo sólo al abrir la conversación',async()=>{
 const app=createApp({dbPath:':memory:',origin});
 app.addUser('owner-staff-lazy@amc.test','Strong-Owner-2026!','AMC','admin');
 const employee=app.addUser('employee-staff-lazy@amc.test','Strong-Employee-2026!','Operario','employee');
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+app.server.address().port;
 try{
  const admin=actor(base),worker=actor(base);
  await admin.call('/api/login',{email:'owner-staff-lazy@amc.test',password:'Strong-Owner-2026!'});
  await worker.call('/api/login',{email:'employee-staff-lazy@amc.test',password:'Strong-Employee-2026!'});
  const message=await worker.call('/api/staff-chat/messages',{text:'Mensaje diferido para administración',idempotencyKey:'staff-lazy-001'},201);
  const adminState=await admin.call('/api/state');
  assert.deepEqual(adminState.staffMessages,[]);
  const dedicated=await admin.call('/api/staff-chat/messages?employeeId='+employee.id);
  assert.equal(dedicated.messages.length,1);
  assert.equal(dedicated.messages[0].id,message.id);
  const employeeState=await worker.call('/api/state');
  assert.ok(employeeState.staffMessages.some(item=>item.id===message.id));
 }finally{await new Promise(resolve=>app.server.close(resolve));}
});

test('la interfaz admin consulta el endpoint dedicado y el estado no recorre todos los mensajes',async()=>{
 const [stateSource,uiSource]=await Promise.all([
  readFile(new URL('../state-routes.mjs',import.meta.url),'utf8'),
  readFile(new URL('../public/admin-chat-ui.js',import.meta.url),'utf8')
 ]);
 assert.match(stateSource,/offlineNotes:\[\],staffMessages:\[\]/);
 assert.doesNotMatch(stateSource,/staffMessages:user\.role==='admin'\?staffMessages\(user\)/);
 assert.match(uiSource,/fetch\('\/api\/staff-chat\/messages\?employeeId='/);
 assert.match(uiSource,/queueMicrotask\(\(\)=>loadMessages\(employee\.id\)\)/);
 assert.match(uiSource,/credentials:'same-origin'/);
});
