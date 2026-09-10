import test from 'node:test';
import assert from 'node:assert/strict';
import {PostgresDatabase} from '../postgres-db.mjs';

const testUrl=process.env.AMC_TEST_DATABASE_URL;

test('PostgreSQL recupera el worker si termina entre operaciones sin reintentar la anterior',{skip:!testUrl},async()=>{
 const schema=`amc_worker_recovery_${process.pid}_${Date.now()}`;
 const {default:pg}=await import('pg');
 const cleanup=new pg.Client({connectionString:testUrl,ssl:false});
 let db;
 try{
  db=new PostgresDatabase(testUrl,{schema,test:true});
  const before=db.prepare('SELECT pg_backend_pid() AS pid, 1 AS ok').get();
  assert.equal(before.ok,1);

  await db.worker.terminate();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(db.failed,true);

  const after=db.prepare('SELECT pg_backend_pid() AS pid, 1 AS ok').get();
  assert.equal(after.ok,1);
  assert.notEqual(after.pid,before.pid);
  assert.equal(db.failed,false);
 }finally{
  try{db?.close();}catch{}
  try{
   await cleanup.connect();
   await cleanup.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  }catch{}finally{try{await cleanup.end();}catch{}}
 }
});

test('PostgreSQL no recupera el worker muerto mientras una transacción sigue abierta',{skip:!testUrl},async()=>{
 const schema=`amc_worker_transaction_${process.pid}_${Date.now()}`;
 const {default:pg}=await import('pg');
 const cleanup=new pg.Client({connectionString:testUrl,ssl:false});
 let db;
 try{
  db=new PostgresDatabase(testUrl,{schema,test:true});
  const before=db.prepare('SELECT pg_backend_pid() AS pid, 1 AS ok').get();
  assert.equal(before.ok,1);
  db.exec('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');

  const failedWorker=db.worker;
  await failedWorker.terminate();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(db.failed,true);

  assert.throws(()=>db.prepare('SELECT 1 AS unsafe').get(),error=>error.status===503&&error.code==='AMC_TRANSACTION_CONNECTION');
  assert.equal(db.worker,failedWorker);

  const rollback=db.exec('ROLLBACK');
  assert.deepEqual(rollback,{rows:[],changes:0});
  assert.equal(db.worker,failedWorker);
  assert.equal(db.failed,true);

  const after=db.prepare('SELECT pg_backend_pid() AS pid, 1 AS ok').get();
  assert.equal(after.ok,1);
  assert.notEqual(after.pid,before.pid);
  assert.notEqual(db.worker,failedWorker);
  assert.equal(db.failed,false);
 }finally{
  try{db?.close();}catch{}
  try{
   await cleanup.connect();
   await cleanup.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  }catch{}finally{try{await cleanup.end();}catch{}}
 }
});
