import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createAppShellBackController} from '../public/app-shell-back-controller.js';

const classList=(...values)=>({contains:value=>values.includes(value)});
const basicDocument=role=>({body:{classList:classList(role)},querySelector(){return null;},addEventListener(){},createElement(){throw new Error('No debería crear DOM en esta prueba');}});
const controllerFor=(role,hash='#inicio')=>createAppShellBackController({documentRef:basicDocument(role),windowRef:{addEventListener(){}},locationRef:{hash},queueMicrotaskRef:fn=>fn(),createMutationObserver:()=>null});

test('fallbacks de Volver preservan rutas de Admin',()=>{
 const controller=controllerFor('admin-v3');
 assert.equal(controller.fallbackBackRoute('presupuesto-admin/q1'),'presupuestos');
 assert.equal(controller.fallbackBackRoute('obra-admin/w1'),'obras');
 assert.equal(controller.fallbackBackRoute('cliente/c1'),'clientes');
 assert.equal(controller.fallbackBackRoute('chat-admin/c1'),'chat-admin');
 assert.equal(controller.fallbackBackRoute('chat-equipo/e1'),'chat-admin');
 assert.equal(controller.fallbackBackRoute('calendario'),'inicio');
});

test('fallbacks de Cliente y Empleado preservan sus raíces y detalles',()=>{
 const client=controllerFor('client-v5');
 assert.equal(client.fallbackBackRoute('mi-trabajo/r1'),'mis-trabajos-cliente');
 assert.equal(client.fallbackBackRoute('solicitud/r1'),'mis-trabajos-cliente');
 assert.equal(client.fallbackBackRoute('presupuesto/q1'),'mis-trabajos-cliente');
 assert.equal(client.fallbackBackRoute('obra/w1'),'mis-trabajos-cliente');
 assert.equal(client.fallbackBackRoute('perfil'),'inicio');
 const employee=controllerFor('employee-v4');
 assert.equal(employee.fallbackBackRoute('trabajo/w1'),'mis-trabajos');
 assert.equal(employee.fallbackBackRoute('chat-equipo/e1'),'chat-equipo');
 assert.equal(employee.fallbackBackRoute('cotizador'),'inicio-empleado');
});

test('goBack usa primero el historial interno y no sólo el fallback',()=>{
 const locationRef={hash:'#inicio'},controller=createAppShellBackController({documentRef:basicDocument('admin-v3'),windowRef:{addEventListener(){}},locationRef,queueMicrotaskRef:fn=>fn(),createMutationObserver:()=>null});
 locationRef.hash='#presupuestos';controller.handleHashChange();
 locationRef.hash='#presupuesto-admin/q1';controller.handleHashChange();
 assert.deepEqual(controller.routeStack,['inicio','presupuestos','presupuesto-admin/q1']);
 assert.equal(controller.goBack(),'presupuestos');
 assert.equal(locationRef.hash,'presupuestos');
 controller.handleHashChange();
 assert.deepEqual(controller.routeStack,['inicio','presupuestos']);
});

test('syncBackButton no crea Volver en público, raíz o pantalla con Volver propio',()=>{
 let created=0;
 const makeMain=ownBack=>({
  querySelector(selector){if(selector==='[data-action="back"]')return ownBack?{}:null;return null;},
  querySelectorAll(){return [];},
  prepend(){created++;},
 });
 const publicDoc={body:{classList:classList()},querySelector:selector=>selector==='#app main'?makeMain(false):null,createElement(){created++;return {};}};
 createAppShellBackController({documentRef:publicDoc,windowRef:{},locationRef:{hash:'#servicios'},queueMicrotaskRef:fn=>fn(),createMutationObserver:()=>null}).syncBackButton();
 assert.equal(created,0);
 const rootDoc={body:{classList:classList('admin-v3')},querySelector:selector=>selector==='#app main'?makeMain(false):null,createElement(){created++;return {};}};
 createAppShellBackController({documentRef:rootDoc,windowRef:{},locationRef:{hash:'#inicio'},queueMicrotaskRef:fn=>fn(),createMutationObserver:()=>null}).syncBackButton();
 assert.equal(created,0);
 const ownDoc={body:{classList:classList('admin-v3')},querySelector:selector=>selector==='#app main'?makeMain(true):null,createElement(){created++;return {};}};
 createAppShellBackController({documentRef:ownDoc,windowRef:{},locationRef:{hash:'#presupuesto-admin/q1'},queueMicrotaskRef:fn=>fn(),createMutationObserver:()=>null}).syncBackButton();
 assert.equal(created,0);
});

test('syncBackButton crea exactamente un Volver contextual cuando corresponde',()=>{
 let nav=null,prepends=0;
 const main={querySelector(){return null;},querySelectorAll(){return [];},prepend(value){nav=value;prepends++;}};
 const documentRef={
  body:{classList:classList('admin-v3')},
  querySelector:selector=>selector==='#app main'?main:null,
  createElement(tag){assert.equal(tag,'nav');return {className:'',setAttribute(name,value){this[name]=value;},innerHTML:''};},
 };
 const controller=createAppShellBackController({documentRef,windowRef:{},locationRef:{hash:'#presupuestos'},queueMicrotaskRef:fn=>fn(),createMutationObserver:()=>null});
 controller.syncBackButton();
 assert.equal(prepends,1);
 assert.equal(nav.className,'section-navigation contextual amc-global-back-nav');
 assert.equal(nav['aria-label'],'Volver');
 assert.match(nav.innerHTML,/data-global-back/);
});

test('attach conserva observer liviano, click en captura y hashchange',()=>{
 const documentListeners=[],windowListeners=[],observed=[];
 const app={};
 const documentRef={body:{classList:classList('client-v5')},querySelector:selector=>selector==='#app'?app:null,addEventListener:(...args)=>documentListeners.push(args),createElement(){return {};}};
 const windowRef={addEventListener:(...args)=>windowListeners.push(args)};
 const controller=createAppShellBackController({documentRef,windowRef,locationRef:{hash:'#inicio'},queueMicrotaskRef:()=>{},createMutationObserver:callback=>({observe:(node,options)=>observed.push([node,options,callback])})});
 controller.attach();
 assert.equal(documentListeners.length,1);
 assert.equal(documentListeners[0][0],'click');
 assert.equal(documentListeners[0][2],true);
 assert.equal(windowListeners.length,1);
 assert.equal(windowListeners[0][0],'hashchange');
 assert.deepEqual(observed[0].slice(0,2),[app,{childList:true}]);
});

test('el índice conserva Volver y carga después el runtime oficial de toasts sin el patch UX',async()=>{
 const [toastRuntime,index]=await Promise.all([
  readFile(new URL('../public/app-toast-runtime.js',import.meta.url),'utf8'),
  readFile(new URL('../public/index.html',import.meta.url),'utf8'),
 ]);
 assert.match(index,/app-shell-back-controller\.js/);
 assert.match(index,/app-shell-back-controller\.js[\s\S]*app-toast-runtime\.js/);
 assert.doesNotMatch(index,/ux-runtime-fixes\.js/);
 assert.match(toastRuntime,/export const TRANSIENT_MS=3000/);
});
