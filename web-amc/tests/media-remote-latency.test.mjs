import test from 'node:test';
import assert from 'node:assert/strict';
import {mediaStorageFeatures} from '../media-storage.mjs';
import {mediaAccessFeatures} from '../media-access.mjs';
import {PostgresDatabase} from '../postgres-db.mjs';

const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
const testUrl=process.env.AMC_TEST_DATABASE_URL;

test('9.3E integra cuota remota y persistencia en una sola consulta PostgreSQL',async t=>{
 const previous=process.env.AMC_DATABASE_URL;
 process.env.AMC_DATABASE_URL='postgres://latency-test';
 t.after(()=>{if(previous===undefined)delete process.env.AMC_DATABASE_URL;else process.env.AMC_DATABASE_URL=previous;});
 const sqlCalls=[],uploads=[];
 const db={prepare(sql){return {get:(...params)=>{sqlCalls.push({sql,params});return {state:'ok',inserted:2,metadata:1};}};}};
 const objectStore={writeEnabled:true,upload:async(key,mime,body)=>{uploads.push({key,mime,size:body.length});return true;},remove:async()=>0};
 const storage=mediaStorageFeatures({db,all:()=>[],put:()=>{},transaction:fn=>fn(),objectStore,text:v=>String(v??''),fail,id:()=> 'latency-id',now:()=> '2026-09-15T12:00:00.000Z'});
 const result=await storage.upload({id:'u1'},{mime:'image/jpeg',bytes:Buffer.from([255,216,255]),thumbnail:Buffer.from([255,216,255])});
 assert.equal(result.id,'latency-id');
 assert.equal(sqlCalls.length,1);
 assert.match(sqlCalls[0].sql,/WITH usage AS/);
 assert.match(sqlCalls[0].sql,/quota_state AS/);
 assert.match(sqlCalls[0].sql,/CAST\(\? AS bytea\)/);
 assert.match(sqlCalls[0].sql,/inserted AS \(INSERT INTO files/);
 assert.match(sqlCalls[0].sql,/stored_meta AS \(INSERT INTO docs/);
 assert.equal(uploads.length,2);
});

test('9.3E limpia Storage si la cuota remota rechaza el paquete',async t=>{
 const previous=process.env.AMC_DATABASE_URL;
 process.env.AMC_DATABASE_URL='postgres://latency-test';
 t.after(()=>{if(previous===undefined)delete process.env.AMC_DATABASE_URL;else process.env.AMC_DATABASE_URL=previous;});
 const removed=[];
 const db={prepare(){return {get:()=>({state:'user',inserted:0,metadata:0})};}};
 const objectStore={writeEnabled:true,upload:async()=>true,remove:async keys=>{removed.push(...keys);return keys.length;}};
 const storage=mediaStorageFeatures({db,all:()=>[],put:()=>{},transaction:fn=>fn(),objectStore,text:v=>String(v??''),fail,id:()=> 'quota-id',now:()=> '2026-09-15T12:00:00.000Z'});
 await assert.rejects(()=>storage.upload({id:'u1'},{mime:'image/jpeg',bytes:Buffer.from([255,216,255]),thumbnail:Buffer.from([255,216,255])}),error=>error.status===413&&/límite/.test(error.message));
 assert.deepEqual(removed.sort(),['quota-id','quota-id-thumb']);
});

test('9.3E persiste Buffer como bytea a través del adaptador PostgreSQL real',{skip:!testUrl},async()=>{
 const schema='amc_media93e_'+process.pid+'_'+Date.now().toString(36),db=new PostgresDatabase(testUrl,{schema,test:true,caFile:process.env.AMC_DATABASE_CA_FILE});
 try{
  db.exec('CREATE TEMP TABLE files(id TEXT PRIMARY KEY,owner TEXT NOT NULL,mime TEXT NOT NULL,body BLOB NOT NULL)');
  db.exec('CREATE TEMP TABLE docs(id TEXT PRIMARY KEY,kind TEXT NOT NULL,owner TEXT NOT NULL,body TEXT NOT NULL)');
  const storage=mediaStorageFeatures({db,all:()=>[],put:()=>{},transaction:fn=>fn(),objectStore:{writeEnabled:false},text:v=>String(v??''),fail,id:()=> 'real-bytea-id',now:()=> '2026-09-15T12:00:00.000Z'});
  const result=await storage.upload({id:'real-user'},{mime:'image/jpeg',bytes:Buffer.from([255,216,255,1]),thumbnail:Buffer.from([255,216,255,2])});
  assert.equal(result.id,'real-bytea-id');
  assert.equal(db.prepare('SELECT length(body) AS n FROM files WHERE id=?').get('real-bytea-id').n,4);
  assert.equal(db.prepare('SELECT length(body) AS n FROM files WHERE id=?').get('real-bytea-id-thumb').n,4);
  assert.equal(db.prepare("SELECT count(*) AS n FROM docs WHERE id=? AND kind='fileUpload'").get('upload-real-bytea-id').n,1);
 }finally{db.close();}
});

test('9.3E resuelve metadata y variante del visor con una sola consulta',async()=>{
 const dbCalls=[],downloads=[];
 const db={prepare(sql){return {get:(...params)=>{dbCalls.push({sql,params});return {id:'photo-1',owner:'other',mime:'image/jpeg',variantExists:false};}};}};
 const objectStore={preferStorage:true,download:async key=>{downloads.push(key);return Buffer.from('image');},diagnostics:()=>({})};
 const access=mediaAccessFeatures({db,all:()=>[],objectStore,appearance:{publicMedia:()=>false},team:{media:()=>false},purchases:{media:()=>false},fieldwork:{media:()=>false},closure:{media:()=>false},staffMessages:()=>[],canAccessRequest:()=>false,canAccessWork:()=>false,clientChatIds:()=>new Set(),fail});
 const headers={},res={setHeader:(name,value)=>{headers[name]=value;},writeHead:()=>{},end:body=>{res.body=body;}};
 const handled=await access.serve({user:{id:'admin-1',role:'admin'},p:'/media/photo-1',method:'GET',req:{url:'/media/photo-1?view=1',headers:{}},res});
 assert.equal(handled,true);
 assert.equal(dbCalls.length,1);
 assert.match(dbCalls[0].sql,/EXISTS\(SELECT 1 FROM files variant WHERE variant.id=\?\) AS "variantExists"/);
 assert.deepEqual(dbCalls[0].params,['photo-1-view','photo-1']);
 assert.deepEqual(downloads,['photo-1']);
 assert.equal(headers['Content-Type'],'image/jpeg');
 assert.equal(String(res.body),'image');
});

test('11.1 modo mirror evita la espera de Storage y sirve el blob persistido en base',async()=>{
 const dbCalls=[],downloads=[];
 const db={prepare(sql){return {get:(...params)=>{
  dbCalls.push({sql,params});
  if(sql.includes('SELECT id,owner,mime,EXISTS'))return {id:'photo-1',owner:'admin-1',mime:'image/jpeg',variantExists:false};
  if(sql==='SELECT body FROM files WHERE id=?')return {body:Buffer.from('db-image')};
  throw Error('Consulta inesperada: '+sql);
 }};}};
 const objectStore={preferStorage:false,download:async key=>{downloads.push(key);return Buffer.from('storage-image');},diagnostics:()=>({})};
 const access=mediaAccessFeatures({db,all:()=>[],objectStore,appearance:{publicMedia:()=>false},team:{media:()=>false},purchases:{media:()=>false},fieldwork:{media:()=>false},closure:{media:()=>false},staffMessages:()=>[],canAccessRequest:()=>false,canAccessWork:()=>false,clientChatIds:()=>new Set(),fail});
 const res={setHeader:()=>{},writeHead:()=>{},end:body=>{res.body=body;}};
 const handled=await access.serve({user:{id:'admin-1',role:'admin'},p:'/media/photo-1',method:'GET',req:{url:'/media/photo-1',headers:{}},res});
 assert.equal(handled,true);
 assert.equal(downloads.length,0,'mirror no debe esperar una lectura remota de Storage');
 assert.equal(dbCalls.length,2);
 assert.equal(String(res.body),'db-image');
});
