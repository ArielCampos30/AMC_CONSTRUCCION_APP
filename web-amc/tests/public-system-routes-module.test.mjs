import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {publicSystemRoutes} from '../public-system-routes.mjs';

test('salud y configuración pública quedan fuera del router principal',async()=>{
 const [server,routes]=await Promise.all([
  readFile(new URL('../server.mjs',import.meta.url),'utf8'),
  readFile(new URL('../public-system-routes.mjs',import.meta.url),'utf8')
 ]);
 assert.match(server,/import \{publicSystemRoutes\} from '\.\/public-system-routes\.mjs'/);
 assert.match(server,/const handlePublicSystem=publicSystemRoutes\(/);
 assert.match(server,/if\(handlePublicSystem\(\{p,method,res\}\)\)return/);
 assert.doesNotMatch(server,/p==='\/healthz'/);
 assert.doesNotMatch(server,/p==='\/api\/config'/);
 assert.match(routes,/database:'available'/);
 assert.match(routes,/errors5xx15m/);
 assert.match(routes,/webPushKey:keys\.publicKey/);
});

test('rutas públicas conservan respuesta de salud y configuración',()=>{
 const sent=[];
 const route=publicSystemRoutes({
  db:{prepare:sql=>({get:()=>{assert.equal(sql,'SELECT 1 AS ok');return {ok:1};}})},
  remoteUrl:'postgres://db',version:'abc1234',recentErrorCount:()=>2,
  backupHealth:()=>({backup:'ok'}),startedAt:Date.now()-5000,demo:false,
  keys:{publicKey:'push-key'},services:['Pintura'],
  send:(res,status,data)=>sent.push({res,status,data})
 });
 assert.equal(route({p:'/healthz',method:'GET',res:'health'}),true);
 assert.equal(sent[0].status,200);assert.equal(sent[0].data.database,'available');assert.equal(sent[0].data.driver,'postgresql');assert.equal(sent[0].data.version,'abc1234');assert.equal(sent[0].data.errors5xx15m,2);assert.equal(sent[0].data.backup,'ok');
 assert.equal(route({p:'/api/config',method:'GET',res:'config'}),true);
 assert.deepEqual(sent[1],{res:'config',status:200,data:{demo:false,webPushKey:'push-key',services:['Pintura'],version:'abc1234'}});
 assert.equal(route({p:'/otro',method:'GET',res:'none'}),false);
});
