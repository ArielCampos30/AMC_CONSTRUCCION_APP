import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHttpServer} from '../http-server.mjs';

const send=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
const listen=server=>new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const close=server=>new Promise(resolve=>server.close(resolve));

test('servidor HTTP conserva request id y timeouts',async()=>{
 const recent=[];
 const server=createHttpServer({handle:async(_req,res)=>res.end('ok'),send,recentServerErrors:recent,recentErrorCount:()=>recent.length});
 assert.equal(server.requestTimeout,30000);
 assert.equal(server.headersTimeout,10000);
 await listen(server);
 try{
  const response=await fetch('http://127.0.0.1:'+server.address().port+'/demo');
  assert.equal(response.status,200);
  assert.equal(await response.text(),'ok');
  assert.match(response.headers.get('x-request-id')||'',/^[0-9a-f]{16}$/);
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
 assert.match(server,/from '.\/http-server\.mjs'/);
 assert.match(server,/createHttpServer\(\{handle,send,recentServerErrors,recentErrorCount\}\)/);
 assert.doesNotMatch(server,/from 'node:http'/);
 assert.doesNotMatch(server,/randomBytes/);
 assert.doesNotMatch(server,/http\.createServer/);
 assert.doesNotMatch(server,/requestTimeout=30000/);
 assert.match(runtime,/X-Request-ID/);
 assert.match(runtime,/durationMs/);
 assert.match(runtime,/status:503/);
});
