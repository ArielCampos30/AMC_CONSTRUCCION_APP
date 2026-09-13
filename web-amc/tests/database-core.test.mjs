import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {createDatabaseCore} from '../database-core.mjs';

const id=()=>randomUUID();
const sha=value=>createHash('sha256').update(value).digest('hex');
const now=()=>new Date().toISOString();
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};

test('database core initializes schema, storage helpers, snapshots and migrations',()=>{
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
  core.put('message','client-snapshot',{id:'m-snapshot',userId:'client-snapshot',requestId:'r1',senderId:'admin',date:'2026-09-12T20:00:00.000Z'});
  core.put('chatRead','client-snapshot',{id:'read-snapshot',requestId:'r1',lastMessageId:'m-snapshot'});
  core.put('post','',{id:'p1',title:'Uno'});
  core.beginStateSnapshot();
  assert.equal(core.activeUsers('client').some(user=>user.id==='client-snapshot'),true);
  assert.ok(core.docPosition('m-snapshot')>0);
  assert.equal(core.allEntries('chatRead').find(entry=>entry.value.id==='read-snapshot')?.owner,'client-snapshot');
  core.put('post','',{id:'p2',title:'Dos'});
  assert.deepEqual(core.all('post').map(p=>p.id),['p1']);
  core.endStateSnapshot();
  assert.deepEqual(new Set(core.all('post').map(p=>p.id)),new Set(['p1','p2']));
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
 assert.match(server,/from '.\/database-core\.mjs'/);
 assert.match(server,/createDatabaseCore\(\{dbPath,id,sha,now,fail\}\)/);
 assert.match(stateRoutes,/beginStateSnapshot\(\)/);
 assert.match(stateRoutes,/endStateSnapshot\(\)/);
 assert.doesNotMatch(server,/CREATE TABLE IF NOT EXISTS users/);
 assert.doesNotMatch(server,/const migrateRelations=/);
 assert.doesNotMatch(server,/const migrateCompletion=/);
});
