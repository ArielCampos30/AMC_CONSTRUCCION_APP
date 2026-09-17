import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../server.mjs';
import {createAccountUI} from '../public/account-ui.js';

const origin='http://localhost:4180';
function actor(base){return {cookie:'',csrf:'',async call(path,body,status=200,method){const response=await fetch(base+path,{method:method||(body===undefined?'GET':'POST'),headers:{Origin:origin,'Content-Type':'application/json',Cookie:this.cookie,'X-CSRF-Token':this.csrf},...(body===undefined?{}:{body:JSON.stringify(body)})});const data=await response.json();assert.equal(response.status,status,JSON.stringify(data));const setCookie=response.headers.get('set-cookie');if(setCookie)this.cookie=setCookie.split(';')[0];if(data.csrf)this.csrf=data.csrf;return data;}};}

async function withApp(run){const app=createApp({dbPath:':memory:',origin,sendRecovery:async()=>{}});app.addUser('admin@amc.test','Strong-Admin-2026!','AMC','admin');await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+app.server.address().port;try{await run({app,base});}finally{await new Promise(resolve=>app.server.close(resolve));}}

test('cambiar contraseña conserva la sesión actual y revoca las demás sesiones y dispositivos',async()=>withApp(async({app,base})=>{
 const first=actor(base),second=actor(base),fresh=actor(base),account={email:'seguridad@amc.test',password:'Strong-Client-2026!',passwordConfirm:'Strong-Client-2026!',name:'Cliente Seguridad'};
 await first.call('/api/register',account);
 await second.call('/api/login',{email:account.email,password:account.password});
 const firstDevice=await first.call('/api/devices',{kind:'android',subscription:{token:'amc_security_device_token_first_123456789'}});
 const secondDevice=await second.call('/api/devices',{kind:'android',subscription:{token:'amc_security_device_token_second_12345678'}});
 assert.notEqual(firstDevice.deviceId,secondDevice.deviceId);
 await first.call('/api/change-password',{currentPassword:account.password,password:'Strong-Client-New-2026!',deviceId:firstDevice.deviceId});
 const currentState=await first.call('/api/state');
 assert.equal(currentState.user.email,account.email);
 assert.equal((await second.call('/api/state')).user,null);
 assert.equal(app.db.prepare('SELECT count(*) AS n FROM devices WHERE userId=?').get(currentState.user.id).n,1);
 assert.ok(app.db.prepare('SELECT id FROM devices WHERE id=? AND userId=?').get(firstDevice.deviceId,currentState.user.id));
 assert.equal(app.db.prepare('SELECT id FROM devices WHERE id=?').get(secondDevice.deviceId),undefined);
 await fresh.call('/api/login',{email:account.email,password:account.password},401);
 await fresh.call('/api/login',{email:account.email,password:'Strong-Client-New-2026!'});
}));

test('reintentar una misma operación de solicitud no crea duplicados y una operación nueva sí',async()=>withApp(async({base})=>{
 const client=actor(base),password='Strong-Request-2026!';
 await client.call('/api/register',{email:'request-safe@amc.test',password,passwordConfirm:password,name:'Cliente Pedido'});
 const payload={type:'presupuesto',name:'Cliente Pedido',phone:'3548555555',town:'Valle Hermoso',address:'San Martín 123',description:'Pintar dormitorio completo',services:['Interior'],dimensions:'4 x 3',photos:[],idempotencyKey:'request-replay-001'};
 const first=await client.call('/api/requests',payload,201),replay=await client.call('/api/requests',payload,200);
 assert.equal(replay.id,first.id);
 assert.equal((await client.call('/api/state')).requests.length,1);
 const second=await client.call('/api/requests',{...payload,idempotencyKey:'request-replay-002'},201);
 assert.notEqual(second.id,first.id);
 assert.equal((await client.call('/api/state')).requests.length,2);
}));

test('cliente puede solicitar y cancelar eliminación sin borrado automático',async()=>withApp(async({base})=>{
 const admin=actor(base),client=actor(base),password='Strong-Delete-2026!';
 await admin.call('/api/login',{email:'admin@amc.test',password:'Strong-Admin-2026!'});
 await client.call('/api/register',{email:'delete@amc.test',password,passwordConfirm:password,name:'Cliente Privacidad'});
 await client.call('/api/account-deletion-request',{password:'incorrecta-2026',reason:'Prueba'},403);
 const request=await client.call('/api/account-deletion-request',{password,reason:'Ya no voy a usar la cuenta'},201);
 assert.equal(request.status,'Pendiente');
 let clientState=await client.call('/api/state');
 assert.equal(clientState.accountDeletionRequest.status,'Pendiente');
 const adminState=await admin.call('/api/state');
 assert.ok(adminState.accountDeletionRequests.some(item=>item.userId===clientState.user.id&&item.status==='Pendiente'));
 assert.ok(clientState.user);
 await client.call('/api/account-deletion-request/cancel',{});
 clientState=await client.call('/api/state');
 assert.equal(clientState.accountDeletionRequest,null);
 assert.ok(clientState.user);
}));

test('Perfil de cliente muestra el estado de eliminación de cuenta',()=>{
 let state={user:{id:'client',role:'client',name:'Cliente',email:'cliente@amc.test',phone:'',town:'',address:'',sound:true},works:[],accountDeletionRequest:null};
 const ui=createAccountUI({getState:()=>state,getConfig:()=>({}),getTwoFactorSetup:()=>null,isAdmin:()=>false,team:{render:()=>''},heading:(tag,title)=>`<h1>${tag} ${title}</h1>`,field:(label,name)=>`<label>${label}<input name="${name}"></label>`,btn:label=>`<button>${label}</button>`,esc:value=>String(value??'')});
 assert.match(ui.profile(),/Solicitar eliminación de mi cuenta/);
 state={...state,accountDeletionRequest:{status:'Pendiente'}};
 assert.match(ui.profile(),/Solicitud de eliminación pendiente/);
 assert.match(ui.profile(),/Cancelar solicitud/);
});
