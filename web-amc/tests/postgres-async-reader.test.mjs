import test from 'node:test';
import assert from 'node:assert/strict';
import {PostgresDatabase} from '../postgres-db.mjs';

const testUrl=process.env.AMC_TEST_DATABASE_URL;

test('lector PostgreSQL asíncrono no bloquea el event loop y usa una conexión separada',{skip:!testUrl},async()=>{
 const schema=`amc_async_read_${process.pid}_${Date.now()}`;
 const {default:pg}=await import('pg');
 const cleanup=new pg.Client({connectionString:testUrl,ssl:false});
 let db;
 try{
  db=new PostgresDatabase(testUrl,{schema,test:true});
  const writer=db.prepare('SELECT pg_backend_pid() AS pid').get();
  let timerFired=false;
  const pending=db.queryAsync('SELECT pg_backend_pid() AS pid, pg_sleep(0.15), 1 AS ok');
  await new Promise(resolve=>setTimeout(()=>{timerFired=true;resolve();},30));
  assert.equal(timerFired,true,'la lectura remota no debe congelar timers del proceso Node');
  const result=await pending;
  assert.equal(result.rows[0].ok,1);
  assert.notEqual(result.rows[0].pid,writer.pid,'lecturas de estado deben usar una conexión distinta a las transacciones legacy');
  await assert.rejects(db.queryAsync('DELETE FROM users'),error=>error.code==='AMC_ASYNC_READ_ONLY');
 }finally{
  try{db?.close();}catch{}
  await new Promise(resolve=>setTimeout(resolve,20));
  try{await cleanup.connect();await cleanup.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);}catch{}
  try{await cleanup.end();}catch{}
 }
});
