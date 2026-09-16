import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {createDatabaseCore} from '../database-core.mjs';

const id=()=>randomUUID();
const sha=value=>createHash('sha256').update(value).digest('hex');
const now=()=>new Date().toISOString();
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};

test('database core initializes schema, storage helpers, snapshots and migrations',async()=>{
 const core=createDatabaseCore({dbPath:':memory:',id,sha,now,fail});
 try{
  const columns=core.db.prepare('PRAGMA table_info(users)').all().map(c=>c.name);
  assert.ok(columns.includes('active'));
  core.put('request','u1',{id:'r1',userId:'u1',status:'Nueva'});
  core.put('quote','u1',{id:'q1',userId:'u1',requestId:'r1'});
  core.put('calendarBooking','',{id:'b1',status:'Programada'});
  core.put('work','u1',{id:'w1',userId:'u1',quoteId:'q1',status:'Pendiente de conformidad',calendarBookingId:'b1'});
  core.runMigrations();
  const request=core.get('request','r1'),quote=core.get('quote','q1'),work=core.get('work','w1'),booking=core.get('calendarBooking','b1');
  assert.equal(quote.presupuestoId,'q1');
  assert.equal(quote.solicitudId,'r1');
  assert.equal(quote.obraId,'w1');
  assert.equal(work.obraId,'w1');
  assert.equal(work.presupuestoId,'q1');
  assert.equal(work.solicitudId,'r1');
  assert.equal(work.status,'Finalizado');
  assert.equal(request.status,'Cerrada');
  assert.deepEqual(request.presupuestoIds,['q1']);
  assert.deepEqual(request.obraIds,['w1']);
  assert.equal(booking.status,'Finalizada');
  core.db.prepare('INSERT INTO users(id,email,name,phone,town,role,password,active) VALUES(?,?,?,?,?,?,?,1)').run('client-snapshot','snapshot@amc.test','Cliente snapshot','','La Falda','client','salt:hash');
  core.db.prepare('INSERT INTO users(id,email,name,phone,town,role,password,active) VALUES(?,?,?,?,?,?,?,0)').run('employee-inactive','inactive@amc.test','Empleado inactivo','','Valle Hermoso','employee','salt:hash');
  core.put('message','client-snapshot',{id:'m-snapshot',userId:'client-snapshot',requestId:'r1',senderId:'admin',date:'2026-09-12T20:00:00.000Z'});
  core.put('chatRead','client-snapshot',{id:'read-snapshot',requestId:'r1',lastMessageId:'m-snapshot'});
  core.put('post','',{id:'p1',title:'Uno'});
  await core.beginStateSnapshot();
  assert.equal(core.activeUsers('client').some(user=>user.id==='client-snapshot'),true);
  assert.equal(core.activeUsers('employee').some(user=>user.id==='employee-inactive'),false);
  assert.equal(core.usersByRoles(['employee']).some(user=>user.id==='employee-inactive'&&!user.active),true);
  assert.ok(core.docPosition('m-snapshot')>0);
  assert.equal(core.allEntries('chatRead').find(entry=>entry.value.id==='read-snapshot')?.owner,'client-snapshot');
  core.db.prepare('UPDATE users SET name=? WHERE id=?').run('Cliente cambiado','client-snapshot');
  core.put('post','',{id:'p2',title:'Dos'});
  core.put('request','u1',{...core.get('request','r1'),status:'Cambiada fuera del snapshot'});
  assert.deepEqual(core.all('post').map(p=>p.id),['p1']);
  assert.equal(core.get('request','r1').status,'Cerrada');
  assert.equal(core.userById('client-snapshot').name,'Cliente snapshot');
  assert.equal(core.db.prepare('SELECT name FROM users WHERE id=?').get('client-snapshot').name,'Cliente snapshot');
  const staff=core.db.prepare("SELECT id,name,email,phone,active,role FROM users WHERE role IN ('employee','admin') ORDER BY name").all();
  assert.equal(staff.find(user=>user.id==='employee-inactive')?.active,0);
  core.endStateSnapshot();
  assert.deepEqual(new Set(core.all('post').map(p=>p.id)),new Set(['p1','p2']));
  assert.equal(core.get('request','r1').status,'Cambiada fuera del snapshot');
  assert.equal(core.userById('client-snapshot').name,'Cliente cambiado');
 }finally{core.db.close();}
});

test('database transaction rolls back atomically',()=>{
 const core=createDatabaseCore({dbPath:':memory:',id,sha,now,fail});
 try{
  assert.throws(()=>core.transaction(()=>{core.put('post','',{id:'rollback',title:'No guardar'});throw Error('stop');}),/stop/);
  assert.equal(core.all('post').some(p=>p.id==='rollback'),false);
 }finally{core.db.close();}
});

test('server delegates database initialization and migrations to database core',async()=>{
 const [server,stateRoutes]=await Promise.all([
  readFile(new URL('../server.mjs',import.meta.url),'utf8'),
  readFile(new URL('../state-routes.mjs',import.meta.url),'utf8')
 ]);
 const composition=await readFile(new URL('../app-composition.mjs',import.meta.url),'utf8');
 assert.match(composition,/from '.\/database-core\.mjs'/);
 assert.match(composition,/createDatabaseCore\(\{dbPath,id,sha,now,fail\}\)/);
 assert.match(stateRoutes,/await beginStateSnapshot\(user\)/);
 assert.match(stateRoutes,/endStateSnapshot\(\)/);
 assert.doesNotMatch(server,/CREATE TABLE IF NOT EXISTS users/);
 assert.doesNotMatch(server,/const migrateRelations=/);
 assert.doesNotMatch(server,/const migrateCompletion=/);
});