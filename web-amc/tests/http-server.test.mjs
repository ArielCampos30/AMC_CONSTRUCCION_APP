import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHttpServer} from '../http-server.mjs';

const send=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
const listen=server=>new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const close=server=>new Promise(resolve=>server.close(resolve));

test('servidor HTTP conserva request id, timeouts y registra latencia',async()=>{
 const recent=[],samples=[];
 const server=createHttpServer({handle:async(_req,res)=>res.end('ok'),send,recentServerErrors:recent,recentErrorCount:()=>recent.length,recordPerformance:(path,duration,status)=>samples.push({path,duration,status})});
 assert.equal(server.requestTimeout,30000);
 assert.equal(server.headersTimeout,10000);
 await listen(server);
 try{
  const response=await fetch('http://127.0.0.1:'+server.address().port+'/demo');
  assert.equal(response.status,200);
  assert.equal(await response.text(),'ok');
  assert.match(response.headers.get('x-request-id')||'',/^[0-9a-f]{16}$/);
  assert.equal(samples.length,1);assert.equal(samples[0].path,'/demo');assert.equal(samples[0].status,200);assert.ok(samples[0].duration>=0);
 }finally{await close(server);}
});

test('servidor HTTP conserva respuesta 503 ante rechazo no manejado',async()=>{
 const server=createHttpServer({handle:async()=>{throw Object.assign(new Error('fallo'),{code:'TEST_FAILURE'});},send,recentServerErrors:[],recentErrorCount:()=>0});
 const original=console.error;console.error=()=>{};
 await listen(server);
 try{
  const response=await fetch('http://127.0.0.1:'+server.address().port+'/falla');
  assert.equal(response.status,503);
  assert.deepEqual(await response.json(),{error:'No pudimos confirmar la operación. Revisá la conexión y el estado antes de repetirla.'});
  assert.ok(response.headers.get('x-request-id'));
 }finally{console.error=original;await close(server);}
});

test('server delega bootstrap HTTP sin duplicarlo',async()=>{
 const server=await readFile(new URL('../server.mjs',import.meta.url),'utf8');
 const runtime=await readFile(new URL('../http-server.mjs',import.meta.url),'utf8');
 const composition=await readFile(new URL('../app-composition.mjs',import.meta.url),'utf8');
 assert.match(composition,/from '.\/http-server\.mjs'/);
 assert.match(composition,/createHttpServer\(\{handle,send,recentServerErrors,recentErrorCount,recordPerformance:performance\.record\}\)/);
 assert.doesNotMatch(server,/from 'node:http'/);
 assert.doesNotMatch(server,/randomBytes/);
 assert.doesNotMatch(server,/http\.createServer/);
 assert.doesNotMatch(server,/requestTimeout=30000/);
 assert.match(runtime,/X-Request-ID/);
 assert.match(runtime,/durationMs/);
 assert.match(runtime,/recordPerformance\(pathname,durationMs,res\.statusCode\)/);
 assert.match(runtime,/status:503/);
});
