import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {createDatabaseCore} from '../database-core.mjs';
import {createDatabaseIntegrity} from '../database-integrity.mjs';

const id=()=>randomUUID();
const sha=value=>createHash('sha256').update(value).digest('hex');
const now=()=>new Date().toISOString();
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};

test('integrity health validates the active SQLite or PostgreSQL schema',()=>{
 const core=createDatabaseCore({dbPath:':memory:',id,sha,now,fail});
 try{
  core.put('post','',{id:'integrity-doc',title:'Integridad'});
  const integrity=createDatabaseIntegrity({db:core.db,remoteUrl:core.remoteUrl});
  const result=integrity.health();
  assert.equal(result.status,'ok');
  assert.deepEqual(result.issues,[]);
  assert.equal(result.tables.docs.duplicateRowids,0);
  assert.equal(result.tables.delivery.duplicateRowids,0);
  if(core.remoteUrl){
   assert.ok(result.tables.docs.sequenceNextValue>result.tables.docs.maxRowid);
   assert.ok(result.tables.delivery.sequenceNextValue>result.tables.delivery.maxRowid);
  }else{
   assert.equal(result.tables.docs.sequenceNextValue,null);
   assert.equal(result.tables.delivery.sequenceNextValue,null);
  }
 }finally{core.db.close();}
});

test('integrity health detects a sequence behind data and duplicate rowids',()=>{
 const fakeDb={prepare(sql){return {get(){
  if(sql.includes('FROM docs_rowid_seq'))return {lastValue:2,isCalled:true};
  if(sql.includes('FROM delivery_rowid_seq'))return {lastValue:10,isCalled:true};
  if(sql.includes('FROM docs'))return {rows:12,maxRowid:12,duplicateRowids:1};
  if(sql.includes('FROM delivery'))return {rows:4,maxRowid:4,duplicateRowids:0};
  throw Error('Consulta inesperada: '+sql);
 }};}};
 const integrity=createDatabaseIntegrity({db:fakeDb,remoteUrl:'postgresql://example'});
 const result=integrity.health();
 assert.equal(result.status,'failed');
 assert.deepEqual(result.issues,['docs:duplicate-rowid','docs:sequence-behind']);
 assert.equal(result.tables.docs.sequenceLastValue,2);
 assert.equal(result.tables.docs.sequenceNextValue,3);
 assert.equal(result.tables.docs.sequenceBehind,true);
 assert.equal(result.tables.delivery.sequenceBehind,false);
 assert.deepEqual(integrity.publicHealth(),{databaseIntegrityStatus:'failed',databaseIntegrityIssues:2});
});

test('integrity health reports unknown instead of mutating data when the check cannot run',()=>{
 const db={prepare(){throw Error('offline');}};
 const integrity=createDatabaseIntegrity({db,remoteUrl:'postgresql://example'});
 assert.deepEqual(integrity.health(),{status:'unknown',issues:['integrity-check-failed'],tables:{}});
});
