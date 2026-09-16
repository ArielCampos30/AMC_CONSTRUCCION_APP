import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {createDatabaseCore} from '../database-core.mjs';

const id=()=>randomUUID();
const sha=value=>createHash('sha256').update(value).digest('hex');
const now=()=>new Date().toISOString();
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};

function setup(){
 const core=createDatabaseCore({dbPath:':memory:',id,sha,now,fail});
 const add=(key,role)=>core.db.prepare('INSERT INTO users(id,email,name,phone,town,role,password,active) VALUES(?,?,?,?,?,?,?,1)').run(key,key+'@amc.test',key,'','',role,'salt:hash');
 add('admin-scope','admin');add('client-a','client');add('client-b','client');add('employee-a','employee');
 const put=(kind,owner,key,extra={})=>core.put(kind,owner,{id:key,userId:owner,...extra});
 put('appearance','admin-scope','appearance-1');
 put('post','admin-scope','post-public',{demo:false});
 put('review','client-b','review-public',{approved:true});
 put('calendarBooking','','booking-global',{requestId:'request-a'});
 put('leadClient','','lead-internal');
 put('recoveryRequest','','recovery-internal');
 put('fileUpload','client-a','upload-internal');
 put('tariffCatalog','','tariff-internal');
 put('monitor','','monitor-internal');
 put('teamAssignmentBatch','','batch-internal');
 put('employeeAudit','','audit-internal');
 put('admin2fa','admin-scope','twofactor-internal');
 put('request','client-a','request-a');put('request','client-b','request-b');
 put('notice','client-a','notice-a');put('notice','client-b','notice-b');put('notice','employee-a','notice-employee');
 put('message','client-a','message-a',{requestId:'request-a'});put('message','client-b','message-b',{requestId:'request-b'});
 put('clientMessage','client-a','direct-a');put('clientMessage','client-b','direct-b');
 put('chatRead','admin-scope','chat-read-admin',{requestId:'request-a',lastMessageId:'message-a'});
 put('clientChatRead','admin-scope','client-read-admin',{clientId:'client-a',lastMessageId:'direct-a'});
 put('quote','client-a','quote-a',{requestId:'request-a'});put('quote','client-b','quote-b',{requestId:'request-b'});
 put('work','client-a','work-a',{requestId:'request-a'});put('work','client-b','work-b',{requestId:'request-b'});
 put('assignment','employee-a','assignment-a',{employeeId:'employee-a',requestId:'request-a',status:'Asignada'});
 put('staffMessage','employee-a','staff-message-a',{employeeId:'employee-a',senderRole:'admin'});
 put('staffRead','employee-a','staff-read-a',{userId:'employee-a'});
 put('staffAdminRead','admin-scope','staff-admin-read-a',{employeeId:'employee-a'});
 return core;
}

const ids=(core,kind)=>new Set(core.all(kind).map(row=>row.id));

test('snapshot de cliente conserva datos propios, públicos y recibos de lectura sin cargar datos ajenos',async()=>{
 const core=setup();
 try{
  await core.beginStateSnapshot({id:'client-a',role:'client'});
  assert.deepEqual([...ids(core,'notice')],['notice-a']);
  assert.deepEqual([...ids(core,'message')],['message-a']);
  assert.deepEqual([...ids(core,'clientMessage')],['direct-a']);
  assert.equal(ids(core,'review').has('review-public'),true);
  assert.equal(ids(core,'post').has('post-public'),true);
  assert.equal(ids(core,'calendarBooking').has('booking-global'),true);
  assert.equal(ids(core,'chatRead').has('chat-read-admin'),true);
  assert.equal(ids(core,'clientChatRead').has('client-read-admin'),true);
  assert.equal(core.all('leadClient').length,0);
  assert.equal(core.all('recoveryRequest').length,0);
  assert.equal(core.all('fileUpload').length,0);
  assert.equal(core.all('tariffCatalog').length,0);
  assert.equal(core.activeUsers('admin').some(user=>user.id==='admin-scope'),true);
  assert.equal(core.activeUsers('client').some(user=>user.id==='client-b'),false);
 }finally{core.endStateSnapshot();core.db.close();}
});

test('snapshot de empleado conserva asignación y recursos cruzados necesarios sin cargar datos de clientes',async()=>{
 const core=setup();
 try{
  await core.beginStateSnapshot({id:'employee-a',role:'employee'});
  assert.deepEqual([...ids(core,'assignment')],['assignment-a']);
  assert.deepEqual([...ids(core,'staffMessage')],['staff-message-a']);
  assert.deepEqual([...ids(core,'notice')],['notice-employee']);
  assert.equal(ids(core,'message').has('message-a'),true);
  assert.equal(ids(core,'message').has('message-b'),true);
  assert.equal(ids(core,'quote').has('quote-a'),true);
  assert.equal(ids(core,'quote').has('quote-b'),true);
  assert.equal(ids(core,'work').has('work-a'),true);
  assert.equal(ids(core,'work').has('work-b'),true);
  assert.equal(ids(core,'review').has('review-public'),true);
  assert.equal(core.all('clientMessage').length,0);
  assert.equal(core.all('request').length,0);
  assert.equal(core.all('calendarBooking').length,0);
  assert.equal(core.all('recoveryRequest').length,0);
  assert.equal(core.activeUsers().some(user=>user.id==='client-a'),false);
 }finally{core.endStateSnapshot();core.db.close();}
});

test('snapshot admin conserva estado operativo global pero omite documentos que se sirven por rutas dedicadas o son internos',async()=>{
 const core=setup();
 try{
  await core.beginStateSnapshot({id:'admin-scope',role:'admin'});
  assert.equal(ids(core,'notice').has('notice-a'),true);
  assert.equal(ids(core,'notice').has('notice-b'),true);
  assert.equal(ids(core,'leadClient').has('lead-internal'),true);
  assert.equal(ids(core,'recoveryRequest').has('recovery-internal'),true);
  assert.equal(ids(core,'calendarBooking').has('booking-global'),true);
  assert.equal(core.all('staffMessage').length,0);
  assert.equal(core.all('staffRead').length,0);
  assert.equal(core.all('staffAdminRead').length,0);
  assert.equal(core.all('fileUpload').length,0);
  assert.equal(core.all('tariffCatalog').length,0);
  assert.equal(core.all('monitor').length,0);
  assert.equal(core.all('teamAssignmentBatch').length,0);
  assert.equal(core.all('employeeAudit').length,0);
  assert.equal(core.all('admin2fa').length,0);
  assert.equal(core.activeUsers('client').length,2);
  assert.equal(core.activeUsers('employee').length,1);
 }finally{core.endStateSnapshot();core.db.close();}
});
