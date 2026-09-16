import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {migrateHistoricalFiles} from '../file-storage-migration.mjs';

const checksum=value=>createHash('md5').update(value).digest('hex');
const fakeDb=rows=>({prepare(sql){
 if(sql==='SELECT id,mime,length(body) AS bytes FROM files ORDER BY id')return {all:()=>rows.map(row=>({id:row.id,mime:row.mime,bytes:row.body.length}))};
 if(sql==='SELECT body FROM files WHERE id=?')return {get:id=>{const row=rows.find(item=>item.id===id);return row?{body:row.body}:undefined;}};
 assert.fail('Consulta inesperada en migración: '+sql);
}});
const inventory=remote=>[...remote.entries()].map(([id,body])=>({name:id,metadata:{size:body.length,eTag:'"'+checksum(body)+'"'}}));

test('historical storage migration verifies matching objects from metadata and downloads only newly written files',async()=>{
 const rows=[
  {id:'present',mime:'image/jpeg',body:Buffer.from([1,2,3])},
  {id:'missing',mime:'application/pdf',body:Buffer.from([4,5,6,7])}
 ];
 const remote=new Map([['present',Buffer.from([1,2,3])]]),uploads=[],downloads=[];
 const objectStore={
  writeEnabled:true,
  async list(){return inventory(remote);},
  async download(id){downloads.push(id);if(!remote.has(id))throw Object.assign(Error('missing'),{status:404,code:'AMC_STORAGE_NOT_FOUND'});return remote.get(id);},
  async upload(id,mime,body){uploads.push({id,mime,body:Buffer.from(body)});remote.set(id,Buffer.from(body));return true;}
 };
 const result=await migrateHistoricalFiles({db:fakeDb(rows),objectStore});
 assert.equal(result.total,2);
 assert.equal(result.bytes,7);
 assert.equal(result.remoteListed,1);
 assert.equal(result.alreadyPresent,1);
 assert.equal(result.migrated,1);
 assert.equal(result.repaired,0);
 assert.equal(result.verified,2);
 assert.deepEqual(uploads.map(item=>item.id),['missing']);
 assert.deepEqual(downloads,['missing']);
 assert.deepEqual(remote.get('missing'),Buffer.from([4,5,6,7]));
});

test('historical storage migration repairs an object whose ETag does not match PostgreSQL',async()=>{
 const rows=[{id:'different',mime:'image/webp',body:Buffer.from([9,8,7,6])}];
 const remote=new Map([['different',Buffer.from([9,8,0,6])]]),uploads=[],downloads=[];
 const objectStore={
  writeEnabled:true,
  async list(){return inventory(remote);},
  async download(id){downloads.push(id);return remote.get(id);},
  async upload(id,mime,body){uploads.push({id,mime});remote.set(id,Buffer.from(body));return true;}
 };
 const result=await migrateHistoricalFiles({db:fakeDb(rows),objectStore});
 assert.equal(result.migrated,0);
 assert.equal(result.repaired,1);
 assert.equal(result.verified,1);
 assert.deepEqual(uploads,[{id:'different',mime:'image/webp'}]);
 assert.deepEqual(downloads,['different']);
 assert.deepEqual(remote.get('different'),Buffer.from([9,8,7,6]));
});

test('historical storage migration accepts list metadata names with files prefix',async()=>{
 const body=Buffer.from([3,1,4,1,5]),rows=[{id:'prefixed',mime:'image/jpeg',body}];
 const objectStore={writeEnabled:true,async list(){return [{name:'files/prefixed',metadata:{size:body.length,eTag:checksum(body)}}];},async upload(){assert.fail('matching prefixed object must not upload');},async download(){assert.fail('matching prefixed object must not download');}};
 const result=await migrateHistoricalFiles({db:fakeDb(rows),objectStore});
 assert.equal(result.alreadyPresent,1);
 assert.equal(result.verified,1);
});

test('historical storage migration refuses to run with external storage disabled',async()=>{
 await assert.rejects(migrateHistoricalFiles({db:fakeDb([]),objectStore:{writeEnabled:false}}),/Object Storage debe estar activo/);
});

test('historical storage migration fails closed when post-upload verification differs',async()=>{
 const rows=[{id:'bad-verify',mime:'image/jpeg',body:Buffer.from([1,1,1])}];
 const objectStore={
  writeEnabled:true,
  async list(){return [];},
  async download(){return Buffer.from([2,2,2]);},
  async upload(){return true;}
 };
 await assert.rejects(migrateHistoricalFiles({db:fakeDb(rows),objectStore}),error=>error.code==='AMC_STORAGE_VERIFY'&&error.fileId==='bad-verify');
});

test('historical storage migration aborts if the PostgreSQL source changes during the run',async()=>{
 const row={id:'changed',mime:'image/jpeg',body:Buffer.from([1,2,3])};
 const db={prepare(sql){
  if(sql==='SELECT id,mime,length(body) AS bytes FROM files ORDER BY id')return {all:()=>[{id:row.id,mime:row.mime,bytes:3}]};
  if(sql==='SELECT body FROM files WHERE id=?')return {get:()=>({body:Buffer.from([1,2,3,4])})};
  assert.fail('Consulta inesperada: '+sql);
 }};
 await assert.rejects(migrateHistoricalFiles({db,objectStore:{writeEnabled:true,list:async()=>[]}}),error=>error.code==='AMC_STORAGE_SOURCE_CHANGED'&&error.fileId==='changed');
});
