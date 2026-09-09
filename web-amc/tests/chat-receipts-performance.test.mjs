import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createApp} from '../server.mjs';

const origin='http://localhost:4180';
const actor=base=>({cookie:'',csrf:'',async call(path,body,status=200){
  const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:this.cookie,'X-CSRF-Token':this.csrf},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const data=await response.json();
  assert.equal(response.status,status,JSON.stringify(data));
  const cookie=response.headers.get('set-cookie');if(cookie)this.cookie=cookie.split(';')[0];
  if(data.csrf)this.csrf=data.csrf;
  return data;
}});

test('chat informa al emisor cuándo el otro lado leyó el mensaje',async()=>{
  const app=createApp({dbPath:':memory:',origin});
  app.addUser('receipt-owner@amc.test','Strong-Owner-2026!','AMC','admin');
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+app.server.address().port;
  try{
    const admin=actor(base),client=actor(base),employee=actor(base);
    await admin.call('/api/login',{email:'receipt-owner@amc.test',password:'Strong-Owner-2026!'});
    await client.call('/api/register',{email:'receipt-client@amc.test',name:'Cliente',password:'Strong-Client-2026!',passwordConfirm:'Strong-Client-2026!'});
    const request=await client.call('/api/requests',{name:'Cliente',phone:'3548111222',town:'La Falda',description:'Prueba chat',service:'Albañilería',type:'presupuesto'},201);

    const fromAdmin=await admin.call('/api/requests/'+request.id+'/messages',{text:'Mensaje admin',photos:[],idempotencyKey:'receipt-admin-1'},201);
    await client.call('/api/requests/'+request.id+'/messages/read',{lastMessageId:fromAdmin.id});
    let adminState=await admin.call('/api/state');
    assert.equal(adminState.chatReadByOther[request.id],fromAdmin.id);

    const fromClient=await client.call('/api/requests/'+request.id+'/messages',{text:'Mensaje cliente',photos:[],idempotencyKey:'receipt-client-1'},201);
    await admin.call('/api/requests/'+request.id+'/messages/read',{lastMessageId:fromClient.id});
    let clientState=await client.call('/api/state');
    assert.equal(clientState.chatReadByOther[request.id],fromClient.id);

    const worker=await admin.call('/api/employees',{name:'Operario',email:'receipt-worker@amc.test',password:'Strong-Worker-2026!',dailyCost:50000},201);
    await employee.call('/api/login',{email:'receipt-worker@amc.test',password:'Strong-Worker-2026!'});

    const staffFromAdmin=await admin.call('/api/staff-chat/messages',{employeeId:worker.id,text:'Hola equipo',idempotencyKey:'receipt-staff-a'},201);
    await employee.call('/api/staff-chat/read',{});
    adminState=await admin.call('/api/state');
    assert.ok(adminState.staffReadByEmployee[worker.id]>=staffFromAdmin.date);

    const staffFromEmployee=await employee.call('/api/staff-chat/messages',{text:'Recibido',idempotencyKey:'receipt-staff-e'},201);
    await admin.call('/api/staff-chat/read',{employeeId:worker.id});
    const employeeState=await employee.call('/api/state');
    assert.ok(employeeState.staffReadByAdmin>=staffFromEmployee.date);
  }finally{
    await new Promise(resolve=>app.server.close(resolve));
  }
});

test('UI usa checks y prepara fotos más livianas para móvil',async()=>{
  const [features,app,float,chat,team]=await Promise.all([
    readFile(new URL('../public/features-ui.js',import.meta.url),'utf8'),
    readFile(new URL('../public/app.js',import.meta.url),'utf8'),
    readFile(new URL('../public/floating-chat.js',import.meta.url),'utf8'),
    readFile(new URL('../public/chat-view.js',import.meta.url),'utf8'),
    readFile(new URL('../public/team-ui.js',import.meta.url),'utf8')
  ]);
  assert.match(features,/chatReadByOther/);
  assert.match(features,/message-check/);
  assert.match(features,/message-upload-spinner/);
  assert.doesNotMatch(features,/<small>\$\{esc\(x\.state\)\}/);
  assert.match(chat,/\.message-check\.read\{color:#159164\}/);
  assert.match(team,/staffReadByAdmin/);
  assert.match(app,/target=1440/);
  assert.match(app,/canvasBlob\(canvas,'image\/webp',\.74\)/);
  assert.doesNotMatch(app,/Promise\.all\(\[canvasBlob\(canvas,'image\/jpeg'/);
  assert.match(float,/height:min\(430px,58dvh\)/);
});
