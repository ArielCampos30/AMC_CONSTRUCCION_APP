import test from 'node:test';
import assert from 'node:assert/strict';
import {createSupabaseFileStore,fileStorageConfig} from '../storage-supabase.mjs';

const env={
 AMC_FILE_STORAGE_MODE:'prefer-storage',
 AMC_SUPABASE_URL:'https://project.supabase.co/',
 AMC_SUPABASE_FILES_KEY:'sb_secret_test_only',
 AMC_FILES_BUCKET:'amc-files'
};

test('Object Storage stays disabled by default and requires server secrets when enabled',()=>{
 assert.deepEqual(fileStorageConfig({}),{mode:'off',base:'',key:'',bucket:'amc-files'});
 assert.throws(()=>fileStorageConfig({AMC_FILE_STORAGE_MODE:'mirror'}),/Faltan AMC_SUPABASE_URL/);
 assert.throws(()=>fileStorageConfig({AMC_FILE_STORAGE_MODE:'invalid'}),/off, mirror o prefer-storage/);
});

test('Supabase file store uploads, downloads and removes only through the private bucket',async()=>{
 const calls=[],download=Buffer.from([1,2,3,4]);
 const fetchImpl=async(url,options={})=>{
  calls.push({url:String(url),method:options.method||'GET',headers:options.headers,body:options.body});
  if((options.method||'GET')==='GET')return new Response(download,{status:200,headers:{'Content-Type':'image/jpeg'}});
  return new Response('{}',{status:200,headers:{'Content-Type':'application/json'}});
 };
 const store=createSupabaseFileStore({env,fetchImpl});
 assert.equal(store.mode,'prefer-storage');assert.equal(store.writeEnabled,true);assert.equal(store.preferStorage,true);
 await store.upload('abc-123','image/jpeg',Buffer.from([255,216,255]));
 assert.equal(calls[0].url,'https://project.supabase.co/storage/v1/object/amc-files/files/abc-123');
 assert.equal(calls[0].method,'POST');
 assert.equal(calls[0].headers.Authorization,'Bearer sb_secret_test_only');
 assert.equal(calls[0].headers.apikey,'sb_secret_test_only');
 assert.equal(calls[0].headers['x-upsert'],'true');
 const bytes=await store.download('abc-123');
 assert.deepEqual(bytes,download);
 assert.equal(calls[1].url,'https://project.supabase.co/storage/v1/object/authenticated/amc-files/files/abc-123');
 await store.remove(['abc-123','abc-123-thumb']);
 assert.equal(calls[2].url,'https://project.supabase.co/storage/v1/object/amc-files');
 assert.equal(calls[2].method,'DELETE');
 assert.deepEqual(JSON.parse(calls[2].body),{prefixes:['files/abc-123','files/abc-123-thumb']});
 assert.deepEqual(store.diagnostics(),{readFailures:0,readCircuitOpen:false,readCircuitUntil:null});
});

test('upload retries one transient Storage failure using the same idempotent object path',async()=>{
 const calls=[];
 const fetchImpl=async(url,options={})=>{
  calls.push({url:String(url),headers:options.headers});
  if(calls.length===1)return new Response('temporary',{status:503});
  return new Response('{}',{status:200});
 };
 const store=createSupabaseFileStore({env,fetchImpl,timeouts:{writeRetryDelayMs:1}});
 assert.equal(await store.upload('retry-safe','image/jpeg',Buffer.from([255,216,255])),true);
 assert.equal(calls.length,2);
 assert.equal(calls[0].url,calls[1].url);
 assert.equal(calls[0].headers['x-upsert'],'true');
 assert.equal(calls[1].headers['x-upsert'],'true');
});

test('upload hard deadline returns even when fetch ignores AbortSignal completely',async()=>{
 let calls=0;
 const fetchImpl=()=>{calls++;return new Promise(()=>{});};
 const store=createSupabaseFileStore({env,fetchImpl,timeouts:{writeAttemptMs:15,writeTotalMs:45,writeRetryDelayMs:1}});
 const started=Date.now();
 await assert.rejects(store.upload('never-settles','image/jpeg',Buffer.from([255,216,255])),error=>{
  assert.equal(error.code,'AMC_STORAGE');
  assert.equal(error.storageOperation,'upload');
  assert.equal(error.storageReason,'timeout');
  assert.equal(error.storageAttempts,2);
  assert.equal(error.storageRetryable,true);
  assert.match(error.message,/demorando demasiado/);
  return true;
 });
 assert.equal(calls,2);
 assert.ok(Date.now()-started<180,'AMC debe cortar el upload colgado sin esperar al fetch subyacente');
});

test('private storage read reports 404 without exposing credentials',async()=>{
 const store=createSupabaseFileStore({env,fetchImpl:async()=>new Response('missing',{status:404})});
 await assert.rejects(store.download('missing-file'),error=>error.status===404&&error.code==='AMC_STORAGE_NOT_FOUND'&&error.storageOperation==='download'&&error.storageReason==='not-found'&&!error.message.includes('sb_secret'));
});

test('Storage failures expose safe operation metadata without leaking secrets',async()=>{
 let now=1000;
 const store=createSupabaseFileStore({env,clock:()=>now,fetchImpl:async()=>{now+=37;return new Response('unavailable',{status:503});}});
 await assert.rejects(store.download('abc-503'),error=>{
  assert.equal(error.code,'AMC_STORAGE');
  assert.equal(error.storageOperation,'download');
  assert.equal(error.storageReason,'http');
  assert.equal(error.storageHttpStatus,503);
  assert.equal(error.storageDurationMs,37);
  assert.equal(error.message.includes('sb_secret_test_only'),false);
  return true;
 });
});

test('two transient read failures open a short circuit and avoid repeated remote waits',async()=>{
 let now=1000,calls=0,healthy=false;
 const fetchImpl=async()=>{
  calls++;
  if(!healthy)throw Object.assign(Error('socket reset'),{code:'ECONNRESET'});
  return new Response(Buffer.from([7,8,9]),{status:200});
 };
 const store=createSupabaseFileStore({env,fetchImpl,clock:()=>now});
 await assert.rejects(store.download('first'),error=>error.storageReason==='network');
 now+=10;
 await assert.rejects(store.download('second'),error=>error.storageReason==='network');
 const opened=store.diagnostics();
 assert.equal(opened.readFailures,2);
 assert.equal(opened.readCircuitOpen,true);
 const callsBefore=calls;
 await assert.rejects(store.download('third'),error=>error.code==='AMC_STORAGE'&&error.storageReason==='circuit-open'&&Number.isFinite(error.storageRetryAt));
 assert.equal(calls,callsBefore,'el circuito abierto no debe volver a llamar a Supabase');
 now+=30001;healthy=true;
 assert.deepEqual(await store.download('recovered'),Buffer.from([7,8,9]));
 assert.equal(calls,callsBefore+1);
 assert.deepEqual(store.diagnostics(),{readFailures:0,readCircuitOpen:false,readCircuitUntil:null});
});
