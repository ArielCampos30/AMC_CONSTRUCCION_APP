import test from 'node:test';
import assert from 'node:assert/strict';
import {PostgresDatabase} from '../postgres-db.mjs';

const testUrl=process.env.AMC_TEST_DATABASE_URL;

async function killBackend(db,killer){
 const before=db.prepare('SELECT pg_backend_pid() AS pid').get();
 await killer.connect();
 const terminated=await killer.query('SELECT pg_terminate_backend($1) AS killed',[before.pid]);
 assert.equal(terminated.rows[0].killed,true);
 await new Promise(resolve=>setTimeout(resolve,100));
 return before;
}

test('PostgreSQL no continúa una transacción en otra conexión si la sesión se pierde',{skip:!testUrl},async()=>{
 const schema=`amc_txguard_${process.pid}_${Date.now()}`;
 const {default:pg}=await import('pg');
 const killer=new pg.Client({connectionString:testUrl,ssl:false});
 let db;
 try{
  db=new PostgresDatabase(testUrl,{schema,test:true});
  db.exec('BEGIN IMMEDIATE');
  const before=await killBackend(db,killer);

  assert.throws(()=>db.prepare('SELECT 1 AS unsafe').get(),error=>error.status===503&&error.code==='AMC_TRANSACTION_CONNECTION');
  db.exec('ROLLBACK');
  const after=db.prepare('SELECT pg_backend_pid() AS pid, 1 AS ok').get();
  assert.equal(after.ok,1);
  assert.notEqual(after.pid,before.pid);
 }finally{
  try{db?.close();}catch{}
  try{await killer.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);}catch{}
  try{await killer.end();}catch{}
 }
});

test('PostgreSQL protege también la transacción READ ONLY usada por los backups',{skip:!testUrl},async()=>{
 const schema=`amc_txbackup_${process.pid}_${Date.now()}`;
 const {default:pg}=await import('pg');
 const killer=new pg.Client({connectionString:testUrl,ssl:false});
 let db;
 try{
  db=new PostgresDatabase(testUrl,{schema,test:true});
  db.exec('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const before=await killBackend(db,killer);

  assert.throws(()=>db.prepare('SELECT 1 AS unsafe').get(),error=>error.status===503&&error.code==='AMC_TRANSACTION_CONNECTION');
  db.exec('ROLLBACK');
  const after=db.prepare('SELECT pg_backend_pid() AS pid, 1 AS ok').get();
  assert.equal(after.ok,1);
  assert.notEqual(after.pid,before.pid);
 }finally{
  try{db?.close();}catch{}
  try{await killer.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);}catch{}
  try{await killer.end();}catch{}
 }
});
