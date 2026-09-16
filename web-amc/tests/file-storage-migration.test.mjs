import test from 'node:test';
import assert from 'node:assert/strict';
import {migrateHistoricalFiles} from '../file-storage-migration.mjs';

const fakeDb=rows=>({prepare(sql){assert.equal(sql,'SELECT id,mime,body FROM files ORDER BY id');return {all:()=>rows};}});

test('historical storage migration uploads only missing files and verifies every byte',async()=>{
 const rows=[
  {id:'present',mime:'image/jpeg',body:Buffer.from([1,2,3])},
  {id:'missing',mime:'application/pdf',body:Buffer.from([4,5,6,7])}
 ];
 const remote=new Map([['present',Buffer.from([1,2,3])]]),uploads=[];
 const objectStore={
  writeEnabled:true,
  async download(id){if(!remote.has(id))throw Object.assign(Error('missing'),{status:404,code:'AMC_STORAGE_NOT_FOUND'});return remote.get(id);},
  async upload(id,mime,body){uploads.push({id,mime,body:Buffer.from(body)});remote.set(id,Buffer.from(body));return true;}
 };
 const result=await migrateHistoricalFiles({db:fakeDb(rows),objectStore});
 assert.equal(result.total,2);
 assert.equal(result.bytes,7);
 assert.equal(result.alreadyPresent,1);
 assert.equal(result.migrated,1);
 assert.equal(result.repaired,0);
 assert.equal(result.verified,2);
 assert.deepEqual(uploads.map(item=>item.id),['missing']);
 assert.deepEqual(remote.get('missing'),Buffer.from([4,5,6,7]));
});

test('historical storage migration repairs a mismatched remote object from PostgreSQL source',async()=>{
 const rows=[{id:'different',mime:'image/webp',body:Buffer.from([9,8,7,6])}];
 const remote=new Map([['different',Buffer.from([9,8,0,6])]]),uploads=[];
 const objectStore={
  writeEnabled:true,
  async download(id){return remote.get(id);},
  async upload(id,mime,body){uploads.push({id,mime});remote.set(id,Buffer.from(body));return true;}
 };
 const result=await migrateHistoricalFiles({db:fakeDb(rows),objectStore});
 assert.equal(result.migrated,0);
 assert.equal(result.repaired,1);
 assert.equal(result.verified,1);
 assert.deepEqual(uploads,[{id:'different',mime:'image/webp'}]);
 assert.deepEqual(remote.get('different'),Buffer.from([9,8,7,6]));
});

test('historical storage migration refuses to run with external storage disabled',async()=>{
 await assert.rejects(migrateHistoricalFiles({db:fakeDb([]),objectStore:{writeEnabled:false}}),/Object Storage debe estar activo/);
});

test('historical storage migration fails closed when post-upload verification differs',async()=>{
 const rows=[{id:'bad-verify',mime:'image/jpeg',body:Buffer.from([1,1,1])}];
 let first=true;
 const objectStore={
  writeEnabled:true,
  async download(){if(first){first=false;throw Object.assign(Error('missing'),{status:404});}return Buffer.from([2,2,2]);},
  async upload(){return true;}
 };
 await assert.rejects(migrateHistoricalFiles({db:fakeDb(rows),objectStore}),error=>error.code==='AMC_STORAGE_VERIFY'&&error.fileId==='bad-verify');
});
