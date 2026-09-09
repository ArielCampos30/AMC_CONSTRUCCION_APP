import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createApp} from '../server.mjs';

const origin='http://localhost:4180';

const actor=base=>({cookie:'',csrf:'',async call(path,body,status=200,method){const actual=method||(body===undefined?'GET':'POST'),response=await fetch(base+path,{method:actual,headers:{Origin:origin,'Content-Type':'application/json',Cookie:this.cookie,'X-CSRF-Token':this.csrf},...(actual==='GET'?{}:{body:JSON.stringify(body||{})})});const data=await response.json();assert.equal(response.status,status,JSON.stringify(data));const cookie=response.headers.get('set-cookie');if(cookie)this.cookie=cookie.split(';')[0];if(data.csrf)this.csrf=data.csrf;return data;}});

test('client, admin and employee notices become read when their related content is seen',async()=>{
 const app=createApp({dbPath:':memory:',origin});app.addUser('notice-owner@amc.test','Strong-Owner-2026!','AMC','admin');await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+app.server.address().port;
 try{
  const admin=actor(base),client=actor(base),employee=actor(base);
  await admin.call('/api/login',{email:'notice-owner@amc.test',password:'Strong-Owner-2026!'});
  await client.call('/api/register',{email:'notice-client@amc.test',password:'Strong-Client-2026!',name:'Cliente Avisos'});
  const request=await client.call('/api/requests',{name:'Cliente Avisos',phone:'3548000011',town:'La Falda',description:'Reparar una pared',service:'Albañilería',type:'presupuesto'},201);

  let adminState=await admin.call('/api/state');const requestNotice=adminState.notices.find(n=>n.url==='/#solicitud/'+request.id&&!n.read);assert.ok(requestNotice);
  const openedRequest=await admin.call('/api/notices/read',{route:'#solicitud/'+request.id});assert.ok(openedRequest.noticeIds.includes(requestNotice.id));
  adminState=await admin.call('/api/state');assert.equal(adminState.notices.find(n=>n.id===requestNotice.id).read,true);

  const adminMessage=await admin.call('/api/requests/'+request.id+'/messages',{text:'Hola, recibimos tu pedido.',photos:[],idempotencyKey:'notice-admin-msg'},201);
  let clientState=await client.call('/api/state');const clientChatNotice=clientState.notices.find(n=>n.url==='/#chat/'+request.id&&!n.read);assert.ok(clientChatNotice);assert.equal(clientState.chatUnread[request.id],1);
  const clientRead=await client.call('/api/requests/'+request.id+'/messages/read',{lastMessageId:adminMessage.id});assert.ok(clientRead.noticeIds.includes(clientChatNotice.id));
  clientState=await client.call('/api/state');assert.equal(clientState.chatUnread[request.id]||0,0);assert.equal(clientState.notices.find(n=>n.id===clientChatNotice.id).read,true);

  const clientMessage=await client.call('/api/requests/'+request.id+'/messages',{text:'Perfecto, gracias.',photos:[],idempotencyKey:'notice-client-msg'},201);
  adminState=await admin.call('/api/state');const adminChatNotice=adminState.notices.find(n=>n.url==='/#chat-admin/'+request.id&&!n.read);assert.ok(adminChatNotice);assert.equal(adminState.chatUnread[request.id],1);
  const adminRead=await admin.call('/api/requests/'+request.id+'/messages/read',{lastMessageId:clientMessage.id});assert.ok(adminRead.noticeIds.includes(adminChatNotice.id));
  adminState=await admin.call('/api/state');assert.equal(adminState.chatUnread[request.id]||0,0);assert.equal(adminState.notices.find(n=>n.id===adminChatNotice.id).read,true);

  const quote=await admin.call('/api/quotes',{requestId:request.id,externalId:'notice-quote',version:'a'.repeat(64),number:'AMC-AVISO-1',items:[{description:'Reparación de pared'}],total:150000},201);
  clientState=await client.call('/api/state');const quoteNotice=clientState.notices.find(n=>n.url==='/#presupuesto/'+quote.id&&!n.read);assert.ok(quoteNotice);
  const quoteView=await client.call('/api/quotes/'+quote.id+'/view',{});assert.ok(quoteView.noticeIds.includes(quoteNotice.id));
  clientState=await client.call('/api/state');assert.equal(clientState.notices.find(n=>n.id===quoteNotice.id).read,true);

  const worker=await admin.call('/api/employees',{name:'Operario Avisos',email:'notice-worker@amc.test',password:'Strong-Worker-2026!',dailyCost:50000},201);
  await employee.call('/api/login',{email:'notice-worker@amc.test',password:'Strong-Worker-2026!'});
  await admin.call('/api/staff-chat/messages',{employeeId:worker.id,text:'Revisá tu próxima tarea',idempotencyKey:'notice-staff-msg'},201);
  let employeeState=await employee.call('/api/state');const staffNotice=employeeState.notices.find(n=>n.url==='/#chat-equipo'&&!n.read);assert.ok(staffNotice);assert.equal(employeeState.staffUnread,1);
  const staffRead=await employee.call('/api/staff-chat/read',{});assert.ok(staffRead.noticeIds.includes(staffNotice.id));
  employeeState=await employee.call('/api/state');assert.equal(employeeState.staffUnread,0);assert.equal(employeeState.notices.find(n=>n.id===staffNotice.id).read,true);

  const assignment=await admin.call('/api/assignments',{employeeId:worker.id,requestId:request.id,type:'Urgencia',day:'2030-06-10',time:'10:00',address:'La Falda',instructions:'Revisar pared',dailyCost:50000,estimatedDays:1,idempotencyKey:'notice-task'},201);
  employeeState=await employee.call('/api/state');const taskNotice=employeeState.notices.find(n=>n.url==='/#trabajo/'+assignment.id&&!n.read);assert.ok(taskNotice);
  const taskRead=await employee.call('/api/notices/read',{route:'#trabajo/'+assignment.id});assert.ok(taskRead.noticeIds.includes(taskNotice.id));
  employeeState=await employee.call('/api/state');assert.equal(employeeState.notices.find(n=>n.id===taskNotice.id).read,true);
 }finally{await new Promise(resolve=>app.server.close(resolve));}
});

test('notice UI updates counters, visual state and browser notifications without a page reload',async()=>{
 const [app,features,worker,notices]=await Promise.all([
  readFile(new URL('../public/app.js',import.meta.url),'utf8'),
  readFile(new URL('../public/features-ui.js',import.meta.url),'utf8'),
  readFile(new URL('../public/sw.js',import.meta.url),'utf8'),
  readFile(new URL('../public/notice-ui.js',import.meta.url),'utf8')
 ]);
 assert.match(app,/from '.\/notice-ui\.js'/);
 assert.match(app,/createNoticeUI\(\{getState:\(\)=>state,getPage:\(\)=>page,api,esc,date,heading,btn,empty,sound\}\)/);
 assert.match(notices,/function applyRead\(ids=\[\]\)/);
 assert.match(notices,/async function syncVisible\(\)/);
 assert.match(notices,/api\('\/api\/notices\/read',\{route\}\)/);
 assert.match(app,/queueMicrotask\(syncVisibleNotices\)/);
 assert.match(notices,/data-notice-state/);
 assert.match(notices,/Pendiente/);
 assert.match(notices,/Leído/);
 assert.match(app,/onNoticesRead:applyNoticeRead/);
 assert.match(features,/onNoticesRead\(result\.noticeIds\|\|\[\]\)/);
 assert.match(worker,/AMC_NOTICE_READ/);
 assert.match(worker,/getNotifications\(\)/);
 assert.doesNotMatch(app,/function applyNoticeRead\(ids=\[\]\)/);
 assert.doesNotMatch(app,/function syncVisibleNotices\(\)/);
});


test('backend de avisos queda modularizado sin duplicar reglas en server',async()=>{
 const [server,notifications]=await Promise.all([
  readFile(new URL('../server.mjs',import.meta.url),'utf8'),
  readFile(new URL('../notifications.mjs',import.meta.url),'utf8')
 ]);
 assert.match(server,/from '.\/notifications\.mjs'/);
 assert.match(server,/notificationFeatures\(\{db,all,put,origin,now,id/);
 assert.match(server,/notificationRoutes\(\{p,method,b,user,res\}\)/);
 assert.match(notifications,/const notify=\(userId,title,body,url='\/#avisos',priority='normal'\)/);
 assert.match(notifications,/const notifyAdmins=/);
 assert.match(notifications,/const noticeRouteInfo=/);
 assert.match(notifications,/const markNoticesForRoute=/);
 assert.match(notifications,/p==='\/api\/notices\/read'/);
 assert.match(notifications,/p==='\/api\/notices\/test'/);
 assert.match(notifications,/p==='\/api\/notices'/);
 assert.doesNotMatch(server,/const noticeRouteInfo=/);
 assert.doesNotMatch(server,/p==='\/api\/notices\/read'\)\{/);
});
