import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {estimatorPageRoutes} from '../estimator-page-routes.mjs';

test('la ruta histórica de presupuestos queda como compatibilidad hacia el Cotizador canónico',async()=>{
 const [server,moduleSource]=await Promise.all([
  readFile(new URL('../server.mjs',import.meta.url),'utf8'),
  readFile(new URL('../estimator-page-routes.mjs',import.meta.url),'utf8')
 ]);
 assert.match(server,/import \{estimatorPageRoutes\} from '\.\/estimator-page-routes\.mjs'/);
 assert.match(server,/const handleEstimatorPage=estimatorPageRoutes\(/);
 assert.match(server,/if\(handleEstimatorPage\(\{p,method,user,session,res\}\)\)return/);
 assert.doesNotMatch(server,/if\(p==='\/presupuestos'\)\{/);
 assert.match(moduleSource,/p!=='\/presupuestos'/);
 assert.match(moduleSource,/Location:'\/#cotizador'/);
 assert.doesNotMatch(moduleSource,/presupuestos-original|AMCStored|presupuestos-bridge|estimator-steps|readFileSync/);
});

test('la compatibilidad preserva login, autorización admin y redirección al Cotizador nuevo',()=>{
 let adminChecked=false;
 const route=estimatorPageRoutes({requireAdmin:user=>{adminChecked=user.role==='admin';}});
 assert.equal(route({p:'/otra',user:null,res:{}}),false);
 let redirectStatus=0,redirectHeaders=null,redirectEnded=false;
 assert.equal(route({p:'/presupuestos',user:null,res:{writeHead:(status,headers)=>{redirectStatus=status;redirectHeaders=headers;},end:()=>{redirectEnded=true;}}}),true);
 assert.equal(redirectStatus,302);
 assert.deepEqual(redirectHeaders,{Location:'/#ingresar'});
 assert.equal(redirectEnded,true);
 redirectStatus=0;redirectHeaders=null;redirectEnded=false;
 const user={id:'admin-1',role:'admin'};
 assert.equal(route({p:'/presupuestos',user,res:{writeHead:(status,headers)=>{redirectStatus=status;redirectHeaders=headers;},end:()=>{redirectEnded=true;}}}),true);
 assert.equal(adminChecked,true);
 assert.equal(redirectStatus,302);
 assert.deepEqual(redirectHeaders,{Location:'/#cotizador'});
 assert.equal(redirectEnded,true);
});
