import test from 'node:test';
import assert from 'node:assert/strict';
import {PostgresDatabase} from '../postgres-db.mjs';

const testUrl=process.env.AMC_TEST_DATABASE_URL;

test('PostgreSQL recupera una conexión caída antes de una operación nueva sin reintentar la anterior',{skip:!testUrl},async()=>{
 const schema=`amc_reconnect_${process.pid}_${Date.now()}`;
 const {default:pg}=await import('pg');
 const killer=new pg.Client({connectionString:testUrl,ssl:false});
 let db;
 try{
  db=new PostgresDatabase(testUrl,{schema,test:true});
  const before=db.prepare('SELECT pg_backend_pid() AS pid').get();
  await killer.connect();
  const terminated=await killer.query('SELECT pg_terminate_backend($1) AS killed',[before.pid]);
  assert.equal(terminated.rows[0].killed,true);
  await new Promise(resolve=>setTimeout(resolve,100));

  let after;
  try{after=db.prepare('SELECT pg_backend_pid() AS pid, 1 AS ok').get();}
  catch(error){
   assert.equal(error.status,503);
   after=db.prepare('SELECT pg_backend_pid() AS pid, 1 AS ok').get();
  }
  assert.equal(after.ok,1);
  assert.notEqual(after.pid,before.pid);
 }finally{
  try{db?.close();}catch{}
  try{await killer.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);}catch{}
  try{await killer.end();}catch{}
 }
});
