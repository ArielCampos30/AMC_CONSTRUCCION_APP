import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequestRuntime} from '../request-runtime.mjs';

const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const request=chunks=>({async *[Symbol.asyncIterator](){for(const chunk of chunks)yield Buffer.from(chunk);}});

test('send conserva la respuesta JSON del servidor',()=>{
 const {send}=createRequestRuntime({fail});
 const calls=[];
 const res={writeHead:(status,headers)=>calls.push({status,headers}),end:body=>calls.push({body})};
 send(res,201,{ok:true});
 assert.deepEqual(calls[0],{status:201,headers:{'Content-Type':'application/json; charset=utf-8'}});
 assert.equal(calls[1].body,'{"ok":true}');
});

test('readRaw concatena y mantiene el límite original',async()=>{
 const {readRaw}=createRequestRuntime({fail});
 assert.equal((await readRaw(request(['ab','cd']),4)).toString(),'abcd');
 await assert.rejects(()=>readRaw(request(['abc','de']),4),error=>error.status===413&&error.message==='El archivo es demasiado grande.');
});

test('readBody conserva objeto vacío y error JSON 400',async()=>{
 const {readBody}=createRequestRuntime({fail});
 assert.deepEqual(await readBody(request([])),{});
 assert.deepEqual(await readBody(request(['{"a":1}'])),{a:1});
 await assert.rejects(()=>readBody(request(['{mal'])),error=>error.status===400&&error.message==='Datos inválidos.');
});

test('rate limiter mantiene contador por clave y mensaje 429',()=>{
 const {checkRate,rate}=createRequestRuntime({fail});
 assert.doesNotThrow(()=>checkRate('u:api',2));
 assert.doesNotThrow(()=>checkRate('u:api',2));
 assert.throws(()=>checkRate('u:api',2),error=>error.status===429&&error.message==='Demasiados intentos. Probá en unos minutos.');
 assert.equal(rate.get('u:api').count,3);
 assert.doesNotThrow(()=>checkRate('otra:api',1));
});

test('server delega utilidades HTTP sin duplicarlas',async()=>{
 const server=await readFile(new URL('../server.mjs',import.meta.url),'utf8');
 assert.match(server,/from '.\/request-runtime\.mjs'/);
 assert.match(server,/createRequestRuntime\(\{fail\}\)/);
 assert.match(server,/createMediaUploadParser\(\{readRaw,text,fail\}\)/);
 assert.doesNotMatch(server,/const readRaw=async/);
 assert.doesNotMatch(server,/const readBody=async/);
 assert.doesNotMatch(server,/const rate=new Map\(\)/);
 assert.doesNotMatch(server,/const checkRate=\(key,limit\)=>/);
});
