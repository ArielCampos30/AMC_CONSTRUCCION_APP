import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {createDatabaseCore} from '../database-core.mjs';
import {chatFeatures} from '../chat-core.mjs';

const id=()=>randomUUID();
const sha=value=>createHash('sha256').update(value).digest('hex');
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const text=(value,max=200)=>typeof value==='string'?value.trim().slice(0,max):'';

function setup(){
 let tick=0;
 const now=()=>new Date(1789000000000+(tick++)*1000).toISOString();
 const database=createDatabaseCore({dbPath:':memory:',id,sha,now,fail});
 const {db,all,get,put}=database;
 const addUser=(id,email,name,role)=>db.prepare('INSERT INTO users(id,email,name,phone,town,role,password,active) VALUES(?,?,?,?,?,?,?,1)').run(id,email,name,'','',role,'salt:hash');
 addUser('admin','admin@amc.test','AMC','admin');
 addUser('client','client@amc.test','Cliente','client');
 addUser('employee','employee@amc.test','Operario','employee');
 const own=(user,resource)=>{if(user.role!=='admin'&&resource.userId!==user.id)fail(404,'No encontrado.');return resource;};
 const notices=[];
 const sent=[];
 const chat=chatFeatures({
  db,all,get,put,own,
  safeFile:(_user,key)=>key,
  notify:(...args)=>notices.push(['notify',...args]),
  notifyAdmins:(...args)=>notices.push(['admins',...args]),
  send:(_res,status,data)=>sent.push({status,data}),
  fail,text,now,sha,
  markNoticesForRoute:()=>['notice-read']
 });
 return {database,chat,put,all,sent,notices,now};
}

test('chat core keeps request visibility, unread counters and read receipts',()=>{
 const {database,chat,put,sent}=setup();
 try{
  const client={id:'client',role:'client'},employee={id:'employee',role:'employee'};
  put('request','client',{id:'r1',userId:'client',name:'Cliente',service:'Pintura',town:'La Falda'});
  put('assignment','employee',{id:'a1',employeeId:'employee',requestId:'r1',status:'Asignada'});
  put('message','client',{id:'m1',requestId:'r1',senderId:'admin',date:'2026-09-10T10:00:00.000Z',text:'Hola'});

  assert.deepEqual([...chat.clientChatIds(client)],['r1']);
  assert.deepEqual([...chat.chatIds(employee)],['r1']);
  assert.equal(chat.chatOwn(client,{id:'r1',userId:'client'}).id,'r1');
  assert.throws(()=>chat.chatOwn(employee,{id:'r1',userId:'client'}),error=>error.status===404);
  assert.equal(chat.chatSummary(client).chatUnread.r1,1);
  assert.equal(chat.chatSummary(client).chatLatest.r1,'m1');

  assert.equal(chat.routeAfterBody({p:'/api/requests/r1/messages/read',method:'POST',b:{lastMessageId:'m1'},user:client,url:new URL('http://localhost/api/requests/r1/messages/read'),res:{}}),true);
  assert.equal(sent.at(-1).status,200);
  assert.deepEqual(sent.at(-1).data.noticeIds,['notice-read']);
  assert.equal(chat.chatSummary(client).chatUnread.r1,undefined);
 }finally{database.db.close();}
});

test('staff chat keeps idempotency, unread state and read markers',()=>{
 const {database,chat,sent,notices}=setup();
 try{
  const admin={id:'admin',role:'admin',name:'AMC'},employee={id:'employee',role:'employee',name:'Operario'};
  const payload={employeeId:'employee',text:'Nuevo destino',idempotencyKey:'staff-core-001'};
  assert.equal(chat.routeAfterBody({p:'/api/staff-chat/messages',method:'POST',b:payload,user:admin,url:new URL('http://localhost/api/staff-chat/messages'),res:{}}),true);
  const first=sent.at(-1);
  assert.equal(first.status,201);
  assert.equal(first.data.employeeId,'employee');
  assert.equal(chat.staffUnread(employee),1);
  assert.equal(notices.at(-1)[0],'notify');

  assert.equal(chat.routeAfterBody({p:'/api/staff-chat/messages',method:'POST',b:payload,user:admin,url:new URL('http://localhost/api/staff-chat/messages'),res:{}}),true);
  assert.equal(sent.at(-1).status,200);
  assert.equal(sent.at(-1).data.id,first.data.id);

  assert.equal(chat.routeAfterBody({p:'/api/staff-chat/read',method:'POST',b:{},user:employee,url:new URL('http://localhost/api/staff-chat/read'),res:{}}),true);
  assert.equal(chat.staffUnread(employee),0);
  assert.ok(chat.staffReadByEmployee().employee);

  const client={id:'client',role:'client',name:'Cliente'};
  assert.throws(()=>chat.routeAfterBody({p:'/api/staff-chat/messages',method:'GET',b:{},user:client,url:new URL('http://localhost/api/staff-chat/messages'),res:{}}),error=>error.status===404);
 }finally{database.db.close();}
});
