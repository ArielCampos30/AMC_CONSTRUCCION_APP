import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {ROLE_ASSETS,syncRoleAssets} from '../public/app-role-assets.js';

const source=name=>readFile(new URL('../public/'+name,import.meta.url),'utf8');

function fakeDocument(){
 const links=[];
 const documentRef={
  head:{append(link){links.push(link);queueMicrotask(()=>link.onload?.());}},
  createElement(tag){
   assert.equal(tag,'link');
   const link={tagName:'LINK',rel:'',href:'',dataset:{},getAttribute(name){return name==='href'?this.href:name==='rel'?this.rel:null;},remove(){const index=links.indexOf(this);if(index>=0)links.splice(index,1);}};
   return link;
  },
  querySelectorAll(selector){return selector==='link[rel="stylesheet"]'?links.filter(link=>link.rel==='stylesheet'):[];},
 };
 return {documentRef,links};
}

test('mapa de assets mantiene separación estricta entre Admin, Empleado, Cliente y público',()=>{
 assert.deepEqual(ROLE_ASSETS.admin.styles,['/admin-v3.css','/admin-appearance.css']);
 assert.deepEqual(ROLE_ASSETS.admin.modules,['./app-admin-staff-chat-runtime.js']);
 assert.deepEqual(ROLE_ASSETS.employee.styles,['/employee-v4.css','/employee-staff-chat.css']);
 assert.deepEqual(ROLE_ASSETS.employee.modules,['./app-admin-staff-chat-runtime.js','./app-employee-staff-chat-runtime.js']);
 assert.deepEqual(ROLE_ASSETS.client.styles,['/client-v5.css']);
 assert.deepEqual(ROLE_ASSETS.client.modules,[]);
 assert.deepEqual(ROLE_ASSETS.public.styles,[]);
 assert.deepEqual(ROLE_ASSETS.public.modules,[]);
});

test('carga sólo el rol activo, limpia al salir y puede reinsertar CSS sin reimportar módulos',async()=>{
 const {documentRef,links}=fakeDocument(),imports=[];
 const importModule=async specifier=>{imports.push(specifier);return {specifier};};
 await syncRoleAssets('employee',{documentRef,importModule,logger:null});
 assert.deepEqual(links.map(link=>link.href).sort(),['/employee-staff-chat.css','/employee-v4.css']);
 assert.deepEqual(imports,['./app-admin-staff-chat-runtime.js','./app-employee-staff-chat-runtime.js']);
 await syncRoleAssets('employee',{documentRef,importModule,logger:null});
 assert.equal(links.length,2);
 assert.equal(imports.length,2);
 await syncRoleAssets(null,{documentRef,importModule,logger:null});
 assert.equal(links.length,0);
 await syncRoleAssets('employee',{documentRef,importModule,logger:null});
 assert.deepEqual(links.map(link=>link.href).sort(),['/employee-staff-chat.css','/employee-v4.css']);
 assert.equal(imports.length,2);
 await syncRoleAssets('client',{documentRef,importModule,logger:null});
 assert.deepEqual(links.map(link=>link.href),['/client-v5.css']);
 assert.equal(imports.length,2);
});

test('HTML y runtime inicial ya no descargan los assets de todos los roles',async()=>{
 const [html,bootstrap,stateRuntime,sw]=await Promise.all([source('index.html'),source('app-bootstrap.js'),source('app-state-runtime.js'),source('sw.js')]);
 assert.match(html,/src="__AMC_ASSET_BASE__\/app-bootstrap\.js"/);
 assert.doesNotMatch(html,/href="\/(?:admin-v3|admin-appearance|employee-v4|employee-staff-chat|client-v5)\.css"/);
 assert.doesNotMatch(html,/src="\/(?:app-admin|app-employee)-staff-chat-runtime\.js"/);
 assert.doesNotMatch(html,/src="\/app\.js"/);
 assert.match(bootstrap,/getAttribute\?\.\('href'\)==='\/admin-v3\.css'/);
 assert.match(bootstrap,/!node\.dataset\?\.amcRoleStyle/);
 assert.match(bootstrap,/await import\('\.\/app\.js'\)/);
 assert.match(bootstrap,/delete head\.append/);
 assert.match(stateRuntime,/import \{syncRoleAssets\} from '\.\/app-role-assets\.js'/);
 assert.match(stateRuntime,/await syncRoleAssets\(next\?\.user\?\.role\)[\s\S]*applyState\(next\)/);
 assert.match(sw,/AMC-offline-shell-v12/);
 assert.match(sw,/__AMC_ASSET_BASE__/);
 assert.doesNotMatch(sw,/admin-v3\.css|admin-appearance\.css|employee-v4\.css|employee-staff-chat\.css|client-v5\.css/);
});
