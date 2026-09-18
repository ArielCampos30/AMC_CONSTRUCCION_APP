import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../server.mjs';

const origin='https://app.amcconstrucciones.com.ar';
function actor(base){return {cookie:'',csrf:'',async call(path,body,status=200,method){const response=await fetch(base+path,{method:method||(body===undefined?'GET':'POST'),headers:{Origin:origin,'Content-Type':'application/json',Cookie:this.cookie,'X-CSRF-Token':this.csrf},...(body===undefined?{}:{body:JSON.stringify(body)})});const data=await response.json();assert.equal(response.status,status,`${path}: ${JSON.stringify(data)}`);const setCookie=response.headers.get('set-cookie');if(setCookie)this.cookie=setCookie.split(';')[0];if(data.csrf)this.csrf=data.csrf;return data;}};}

async function withApp(run){const app=createApp({dbPath:':memory:',origin,sendRecovery:async()=>{}});const adminUser=app.addUser('admin-ugc@amc.test','Strong-Admin-UGC-2026!','AMC Administración','admin');await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+app.server.address().port;try{await run({app,base,adminUser});}finally{await new Promise(resolve=>app.server.close(resolve));}}

const clientAccount={email:'cliente-ugc@amc.test',password:'Strong-Client-UGC-2026!',passwordConfirm:'Strong-Client-UGC-2026!',name:'Cliente UGC'};

test('producción exige términos al registrar y registra versión y fecha',async()=>withApp(async({base})=>{
 const rejected=actor(base);
 await rejected.call('/api/register',clientAccount,400);
 const client=actor(base);
 await client.call('/api/register',{...clientAccount,acceptTerms:true});
 const state=await client.call('/api/state');
 assert.equal(state.ugc.enforced,true);
 assert.equal(state.ugc.termsAccepted,true);
 assert.equal(state.ugc.termsRequired,false);
 assert.equal(state.ugc.termsVersion,'2026-09-18-v1');
 assert.match(state.ugc.acceptedAt,/T/);
 assert.equal(state.ugc.termsUrl,'https://amcconstrucciones.com.ar/terminos.html');
}));

test('cuenta existente debe aceptar antes de nuevo UGC y puede hacerlo desde Perfil',async()=>withApp(async({app,base})=>{
 const legacy=app.addUser('legacy-ugc@amc.test','Strong-Legacy-UGC-2026!','Cliente Existente','client'),client=actor(base);
 await client.call('/api/login',{email:legacy.email,password:'Strong-Legacy-UGC-2026!'});
 let state=await client.call('/api/state');
 assert.equal(state.ugc.termsRequired,true);
 await client.call('/api/client-chat/messages',{text:'No debe salir todavía',photos:[],idempotencyKey:'legacy-ugc-before'},428);
 await client.call('/api/profile',{name:'Cliente Existente',phone:'3548000000',town:'La Falda',sound:true,address:'',acceptTerms:true});
 state=await client.call('/api/state');
 assert.equal(state.ugc.termsRequired,false);
 const message=await client.call('/api/client-chat/messages',{text:'Ahora sí',photos:[],idempotencyKey:'legacy-ugc-after'},201);
 assert.equal(message.senderId,legacy.id);
}));

test('cliente puede reportar, bloquear y desbloquear chat sin afectar operaciones ajenas al chat',async()=>withApp(async({base})=>{
 const admin=actor(base),client=actor(base);
 await admin.call('/api/login',{email:'admin-ugc@amc.test',password:'Strong-Admin-UGC-2026!'});
 await client.call('/api/register',{...clientAccount,acceptTerms:true});
 const clientId=(await client.call('/api/state')).user.id;
 await client.call('/api/client-chat/messages',{text:'Hola Administración',photos:[],idempotencyKey:'ugc-client-first'},201);
 const reply=await admin.call('/api/client-chat/messages',{clientId,text:'Hola, te leemos.',photos:[],idempotencyKey:'ugc-admin-reply'},201);
 const report=await client.call('/api/ugc/reports',{contentKind:'clientMessage',contentId:reply.id,reason:'Quiero que Administración revise este mensaje.'},201);
 assert.equal(report.report.status,'Pendiente');
 let adminState=await admin.call('/api/state');
 assert.ok(adminState.ugc.reports.some(item=>item.id===report.report.id&&item.reporterId===clientId));
 await admin.call('/api/ugc/reports/'+report.report.id+'/resolve',{});
 adminState=await admin.call('/api/state');
 assert.equal(adminState.ugc.reports.find(item=>item.id===report.report.id).status,'Revisado');

 await client.call('/api/ugc/blocks',{scope:'client',participantId:clientId,blocked:true});
 let clientState=await client.call('/api/state');
 assert.ok(clientState.ugc.blocks.some(item=>item.active&&item.participantId===clientId&&item.blockedByUserId===clientId));
 await client.call('/api/client-chat/messages',{text:'Bloqueado cliente',photos:[],idempotencyKey:'ugc-client-blocked'},409);
 await admin.call('/api/client-chat/messages',{clientId,text:'Bloqueado admin',photos:[],idempotencyKey:'ugc-admin-blocked'},409);
 await client.call('/api/profile',{name:'Cliente UGC',phone:'3548111111',town:'Valle Hermoso',sound:true,address:'Calle 1'});
 assert.equal((await client.call('/api/state')).user.name,'Cliente UGC');

 await client.call('/api/ugc/blocks',{scope:'client',participantId:clientId,blocked:false});
 clientState=await client.call('/api/state');
 assert.equal(clientState.ugc.blocks.some(item=>item.active&&item.participantId===clientId),false);
 const restored=await admin.call('/api/client-chat/messages',{clientId,text:'Chat restaurado',photos:[],idempotencyKey:'ugc-admin-restored'},201);
 assert.equal(restored.clientId,clientId);
}));

test('empleado puede reportar y bloquear su chat 1 a 1 con Administración',async()=>withApp(async({app,base})=>{
 const employeeUser=app.addUser('empleado-ugc@amc.test','Strong-Employee-UGC-2026!','Empleado UGC','employee'),admin=actor(base),employee=actor(base);
 await admin.call('/api/login',{email:'admin-ugc@amc.test',password:'Strong-Admin-UGC-2026!'});
 await employee.call('/api/login',{email:employeeUser.email,password:'Strong-Employee-UGC-2026!'});
 assert.equal((await employee.call('/api/state')).ugc.termsRequired,true);
 await employee.call('/api/profile',{name:'Empleado UGC',phone:'3548222222',town:'Valle Hermoso',sound:true,acceptTerms:true});
 const message=await admin.call('/api/staff-chat/messages',{employeeId:employeeUser.id,text:'Mensaje para revisar',photos:[],idempotencyKey:'staff-ugc-admin'},201);
 const report=await employee.call('/api/ugc/reports',{contentKind:'staffMessage',contentId:message.id,reason:'Revisar conversación interna.'},201);
 assert.equal(report.report.targetUserId,(await admin.call('/api/state')).user.id);
 await employee.call('/api/ugc/blocks',{scope:'staff',participantId:employeeUser.id,blocked:true});
 assert.ok((await employee.call('/api/state')).ugc.blocks.some(item=>item.scope==='staff'&&item.active));
 await employee.call('/api/staff-chat/messages',{text:'No sale',photos:[],idempotencyKey:'staff-ugc-employee-blocked'},409);
 await admin.call('/api/staff-chat/messages',{employeeId:employeeUser.id,text:'Tampoco sale',photos:[],idempotencyKey:'staff-ugc-admin-blocked'},409);
 await employee.call('/api/ugc/blocks',{scope:'staff',participantId:employeeUser.id,blocked:false});
 const restored=await employee.call('/api/staff-chat/messages',{text:'Restaurado',photos:[],idempotencyKey:'staff-ugc-restored'},201);
 assert.equal(restored.employeeId,employeeUser.id);
}));
