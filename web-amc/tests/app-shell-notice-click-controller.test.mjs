import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createAppShellNoticeClickController} from '../public/app-shell-notice-click-controller.js';

const documentStub=()=>({
 listeners:[],
 addEventListener(type,handler){this.listeners.push([type,handler]);},
});
const target=link=>({closest:selector=>selector==='[data-notice]'?link:null});
const base=(overrides={})=>{
 const documentRef=documentStub(),calls=[];
 const locationRef={href:'https://amc.test/#avisos',hash:'#avisos'};
 const controller=createAppShellNoticeClickController({
  documentRef,
  locationRef,
  api:async(path,body)=>{calls.push(['api',path,body]);return {noticeIds:['n1']};},
  applyNoticeRead:ids=>calls.push(['read',ids]),
  onError:error=>calls.push(['error',error.message]),
  ...overrides,
 });
 return {controller,documentRef,locationRef,calls};
};

test('attach registra exactamente un listener click especializado',()=>{
 const {controller,documentRef}=base();
 controller.attach();
 assert.deepEqual(documentRef.listeners,[['click',controller.handleClick]]);
});

test('click de aviso marca leído, evita navegación nativa y conserva el hash de destino',async()=>{
 const {controller,locationRef,calls}=base();
 const link={dataset:{notice:'n7'},href:'https://amc.test/#presupuesto-admin/q1'};
 let prevented=false;
 await controller.handleClick({target:target(link),preventDefault(){prevented=true;}});
 assert.equal(prevented,true);
 assert.deepEqual(calls,[['api','/api/notices/read',{id:'n7'}],['read',['n1']]]);
 assert.equal(locationRef.hash,'#presupuesto-admin/q1');
 assert.equal('reading' in link.dataset,false);
});

test('respuesta sin noticeIds conserva fallback al aviso clickeado',async()=>{
 const calls=[];
 const {controller}=base({
  api:async()=>({}),
  applyNoticeRead:ids=>calls.push(ids),
 });
 const link={dataset:{notice:'n9'},href:'https://amc.test/'};
 await controller.handleClick({target:target(link),preventDefault(){}});
 assert.deepEqual(calls,[['n9']]);
});

test('doble click mientras está leyendo no repite API y mantiene preventDefault',async()=>{
 const {controller,calls}=base();
 const link={dataset:{notice:'n2',reading:'1'},href:'https://amc.test/#avisos'};
 let prevented=false;
 await controller.handleClick({target:target(link),preventDefault(){prevented=true;}});
 assert.equal(prevented,true);
 assert.deepEqual(calls,[]);
 assert.equal(link.dataset.reading,'1');
});

test('errores se delegan y siempre liberan el bloqueo reading',async()=>{
 const {controller,calls,locationRef}=base({api:async()=>{throw new Error('boom');}});
 const link={dataset:{notice:'n3'},href:'https://amc.test/#inicio'};
 await controller.handleClick({target:target(link),preventDefault(){}});
 assert.deepEqual(calls,[['error','boom']]);
 assert.equal('reading' in link.dataset,false);
 assert.equal(locationRef.hash,'#avisos');
});

test('click ajeno a avisos no hace nada',async()=>{
 const {controller,calls}=base();
 let prevented=false;
 await controller.handleClick({target:target(null),preventDefault(){prevented=true;}});
 assert.equal(prevented,false);
 assert.deepEqual(calls,[]);
});

test('app.js delega los clicks de aviso al controlador especializado',async()=>{
 const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
 assert.match(app,/createAppShellNoticeClickController/);
 assert.match(app,/shellNoticeClickController\.attach\(\)/);
 assert.doesNotMatch(app,/document\.addEventListener\('click',async e=>\{const link=e\.target\.closest\('\[data-notice\]'\)/);
});
