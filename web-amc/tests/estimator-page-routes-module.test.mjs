import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {estimatorPageRoutes} from '../estimator-page-routes.mjs';

test('el cotizador privado queda fuera del router principal',async()=>{
 const [server,moduleSource]=await Promise.all([
  readFile(new URL('../server.mjs',import.meta.url),'utf8'),
  readFile(new URL('../estimator-page-routes.mjs',import.meta.url),'utf8')
 ]);
 assert.match(server,/import \{estimatorPageRoutes\} from '\.\/estimator-page-routes\.mjs'/);
 assert.match(server,/const handleEstimatorPage=estimatorPageRoutes\(/);
 assert.match(server,/if\(handleEstimatorPage\(\{p,method,user,session,res\}\)\)return/);
 assert.doesNotMatch(server,/if\(p==='\/presupuestos'\)\{/);
 assert.match(moduleSource,/p!=='\/presupuestos'/);
 assert.match(moduleSource,/private\/presupuestos-original\.html/);
 assert.match(moduleSource,/window\.AMCStored/);
 assert.match(moduleSource,/presupuestos-bridge\.js/);
});

test('el módulo conserva acceso, redirección e inyección del cotizador',()=>{
 let adminChecked=false;
 const route=estimatorPageRoutes({
  ROOT:'/app',
  all:()=>[{id:'draft-1',note:'<seguro>'}],
  requireAdmin:user=>{adminChecked=user.role==='admin';},
  readFileSync:()=>'<html><head></head><body>Cotizador</body></html>',
  path:{join:(...parts)=>parts.join('/')}
 });
 assert.equal(route({p:'/otra',user:null,session:null,res:{}}),false);
 let redirectStatus=0,redirectHeaders=null,redirectEnded=false;
 assert.equal(route({p:'/presupuestos',user:null,session:null,res:{writeHead:(status,headers)=>{redirectStatus=status;redirectHeaders=headers;},end:()=>{redirectEnded=true;}}}),true);
 assert.equal(redirectStatus,302);
 assert.deepEqual(redirectHeaders,{Location:'/#ingresar'});
 assert.equal(redirectEnded,true);
 let contentType='',body='';
 const user={id:'admin-1',role:'admin'};
 assert.equal(route({p:'/presupuestos',user,session:{csrf:'csrf-1'},res:{setHeader:(name,value)=>{if(name==='Content-Type')contentType=value;},end:value=>{body=value;}}}),true);
 assert.equal(adminChecked,true);
 assert.equal(contentType,'text/html; charset=utf-8');
 assert.match(body,/window\.AMCStored=/);
 assert.match(body,/"csrf":"csrf-1"/);
 assert.match(body,/\\u003cseguro>/);
 assert.match(body,/amc-busy\.js/);
 assert.match(body,/estimator-steps\.js/);
});
