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
});

test('private storage read reports 404 without exposing credentials',async()=>{
 const store=createSupabaseFileStore({env,fetchImpl:async()=>new Response('missing',{status:404})});
 await assert.rejects(store.download('missing-file'),error=>error.status===404&&error.code==='AMC_STORAGE_NOT_FOUND'&&!error.message.includes('sb_secret'));
});
