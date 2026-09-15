import test from 'node:test';
import assert from 'node:assert/strict';
import {mediaStorageFeatures} from '../media-storage.mjs';
import {mediaAccessFeatures} from '../media-access.mjs';

const fail=(status,message)=>{throw Object.assign(Error(message),{status});};

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

test('9.3E resuelve metadata y variante del visor con una sola consulta',async()=>{
 const dbCalls=[],downloads=[];
 const db={prepare(sql){return {get:(...params)=>{dbCalls.push({sql,params});return {id:'photo-1',owner:'other',mime:'image/jpeg',variantExists:false};}};}};
 const objectStore={preferStorage:true,download:async key=>{downloads.push(key);return Buffer.from('image');},diagnostics:()=>({})};
 const access=mediaAccessFeatures({db,all:()=>[],objectStore,appearance:{publicMedia:()=>false},team:{media:()=>false},purchases:{media:()=>false},fieldwork:{media:()=>false},closure:{media:()=>false},staffMessages:()=>[],canAccessRequest:()=>false,canAccessWork:()=>false,clientChatIds:()=>new Set(),fail});
 const headers={},res={setHeader:(name,value)=>{headers[name]=value;},writeHead:()=>{},end:body=>{res.body=body;}};
 const handled=await access.serve({user:{id:'admin-1',role:'admin'},p:'/media/photo-1',method:'GET',req:{url:'/media/photo-1?view=1',headers:{}},res});
 assert.equal(handled,true);
 assert.equal(dbCalls.length,1);
 assert.match(dbCalls[0].sql,/EXISTS\(SELECT 1 FROM files variant WHERE variant.id=\?\) AS variantExists/);
 assert.deepEqual(dbCalls[0].params,['photo-1-view','photo-1']);
 assert.deepEqual(downloads,['photo-1']);
 assert.equal(headers['Content-Type'],'image/jpeg');
 assert.equal(String(res.body),'image');
});
