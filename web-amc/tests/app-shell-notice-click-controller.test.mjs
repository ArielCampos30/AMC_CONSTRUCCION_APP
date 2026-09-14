import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createAppShellNoticeClickController} from '../public/app-shell-notice-click-controller.js';

const documentStub=()=>({
 listeners:[],
 cards:[],
 count:{textContent:'2',hidden:false},
 alert:{cleared:false,replaceChildren(){this.cleared=true;}},
 app:{},
 addEventListener(type,handler){this.listeners.push([type,handler]);},
 querySelectorAll(selector){return selector==='[data-notice-card]'?this.cards:[];},
 querySelector(selector){
  if(selector==='#notice-count')return this.count;
  if(selector==='#app')return this.app;
  if(selector.startsWith('[data-notice-card="')){const id=selector.match(/^\[data-notice-card="(.+)"\]$/)?.[1];return this.cards.find(card=>card.dataset.noticeCard===id)||null;}
  if(selector.startsWith('#amc-live-alert['))return this.alert;
  return null;
 },
});
const eventTarget=({link=null,button=null}={})=>({closest:selector=>selector==='[data-notice]'?link:selector==='[data-maintenance-action="delete-notice"]'?button:null});
const addCard=(documentRef,id,{unread=true}={})=>{
 const parent={isConnected:true,insertBefore(node){if(!documentRef.cards.includes(node))documentRef.cards.push(node);node.isConnected=true;node.parentNode=this;}};
 const card={
  dataset:{noticeCard:id},
  classList:{contains:name=>name==='unread'&&unread},
  parentNode:parent,
  nextSibling:null,
  isConnected:true,
  remove(){this.isConnected=false;documentRef.cards=documentRef.cards.filter(item=>item!==this);},
 };
 documentRef.cards.push(card);
 const button={dataset:{id},disabled:false,isConnected:true,closest:selector=>selector==='[data-notice-card]'?card:null};
 return {card,button,parent};
};
const base=(overrides={})=>{
 const documentRef=overrides.documentRef||documentStub(),calls=[];
 const locationRef=overrides.locationRef||{href:'https://amc.test/#avisos',hash:'#avisos'};
 const controller=createAppShellNoticeClickController({
  documentRef,
  locationRef,
  api:async(path,body)=>{calls.push(['api',path,body]);return {noticeIds:['n1']};},
  applyNoticeRead:ids=>calls.push(['read',ids]),
  onError:error=>calls.push(['error',error.message]),
  createMutationObserver:()=>null,
  ...overrides,
 });
 return {controller,documentRef,locationRef,calls};
};

test('attach registra un listener click y observa el shell sin subtree',()=>{
 let observed=null;
 const documentRef=documentStub();
 const {controller}=base({documentRef,createMutationObserver:callback=>({observe(node,options){observed={node,options,callback};}})});
 controller.attach();
 assert.deepEqual(documentRef.listeners,[['click',controller.handleClick]]);
 assert.equal(observed.node,documentRef.app);
 assert.deepEqual(observed.options,{childList:true});
});

test('click de aviso marca leído, evita navegación nativa y conserva el hash de destino',async()=>{
 const {controller,locationRef,calls}=base();
 const link={dataset:{notice:'n7'},href:'https://amc.test/#presupuesto-admin/q1'};
 let prevented=false;
 await controller.handleClick({target:eventTarget({link}),preventDefault(){prevented=true;}});
 assert.equal(prevented,true);
 assert.deepEqual(calls,[['api','/api/notices/read',{id:'n7'}],['read',['n1']]]);
 assert.equal(locationRef.hash,'#presupuesto-admin/q1');
 assert.equal('reading' in link.dataset,false);
});

test('respuesta sin noticeIds conserva fallback al aviso clickeado',async()=>{
 const calls=[];
 const {controller}=base({api:async()=>({}),applyNoticeRead:ids=>calls.push(ids)});
 const link={dataset:{notice:'n9'},href:'https://amc.test/'};
 await controller.handleClick({target:eventTarget({link}),preventDefault(){}});
 assert.deepEqual(calls,[['n9']]);
});

test('doble click mientras está leyendo no repite API y mantiene preventDefault',async()=>{
 const {controller,calls}=base();
 const link={dataset:{notice:'n2',reading:'1'},href:'https://amc.test/#avisos'};
 let prevented=false;
 await controller.handleClick({target:eventTarget({link}),preventDefault(){prevented=true;}});
 assert.equal(prevented,true);
 assert.deepEqual(calls,[]);
 assert.equal(link.dataset.reading,'1');
});

test('errores de lectura se delegan y siempre liberan el bloqueo reading',async()=>{
 const {controller,calls,locationRef}=base({api:async()=>{throw new Error('boom');}});
 const link={dataset:{notice:'n3'},href:'https://amc.test/#inicio'};
 await controller.handleClick({target:eventTarget({link}),preventDefault(){}});
 assert.deepEqual(calls,[['error','boom']]);
 assert.equal('reading' in link.dataset,false);
 assert.equal(locationRef.hash,'#avisos');
});

test('borrar aviso es optimista, no confirma, actualiza contador y limpia alerta flotante',async()=>{
 const timers=[];
 const {controller,documentRef,calls}=base({setTimeoutRef:(callback,delay)=>{timers.push([callback,delay]);}});
 const {card,button}=addCard(documentRef,'n5');
 let prevented=false,stopped=false,immediate=false;
 await controller.handleClick({target:eventTarget({button}),preventDefault(){prevented=true;},stopPropagation(){stopped=true;},stopImmediatePropagation(){immediate=true;}});
 assert.equal(prevented,true);
 assert.equal(stopped,true);
 assert.equal(immediate,true);
 assert.equal(card.isConnected,false);
 assert.equal(documentRef.cards.length,0);
 assert.equal(documentRef.count.textContent,'0');
 assert.equal(documentRef.count.hidden,true);
 assert.equal(documentRef.alert.cleared,true);
 assert.deepEqual(calls,[['api','/api/notices/read',{deleteId:'n5'}]]);
 assert.equal(timers.length,1);
 assert.equal(timers[0][1],15000);
});

test('un render intermedio no vuelve a mostrar un aviso borrado mientras la API ya confirmó',async()=>{
 const {controller,documentRef}=base({setTimeoutRef:()=>{}});
 const {button}=addCard(documentRef,'n6');
 await controller.handleClick({target:eventTarget({button}),preventDefault(){},stopPropagation(){},stopImmediatePropagation(){}});
 const {card:rerendered}=addCard(documentRef,'n6');
 controller.pruneDeletedNotices();
 assert.equal(rerendered.isConnected,false);
 assert.equal(documentRef.cards.length,0);
});

test('si falla borrar aviso restaura la tarjeta, el contador y delega el error',async()=>{
 const {controller,documentRef,calls}=base({api:async()=>{throw new Error('no se pudo');}});
 const {card,button}=addCard(documentRef,'n8');
 await controller.handleClick({target:eventTarget({button}),preventDefault(){},stopPropagation(){},stopImmediatePropagation(){}});
 assert.equal(card.isConnected,true);
 assert.equal(documentRef.cards.includes(card),true);
 assert.equal(documentRef.count.textContent,'1');
 assert.equal(documentRef.count.hidden,false);
 assert.deepEqual(calls,[['error','no se pudo']]);
 assert.equal(button.disabled,false);
});

test('sin tarjetas fuera de Avisos no pisa el contador global existente',()=>{
 const documentRef=documentStub(),locationRef={href:'https://amc.test/#inicio',hash:'#inicio'};
 documentRef.count.textContent='4';documentRef.count.hidden=false;
 const {controller}=base({documentRef,locationRef});
 controller.syncNoticeCount();
 assert.equal(documentRef.count.textContent,'4');
 assert.equal(documentRef.count.hidden,false);
});

test('click ajeno a avisos no hace nada',async()=>{
 const {controller,calls}=base();
 let prevented=false;
 await controller.handleClick({target:eventTarget(),preventDefault(){prevented=true;}});
 assert.equal(prevented,false);
 assert.deepEqual(calls,[]);
});

test('app.js delega lectura y borrado individual al controlador especializado',async()=>{
 const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
 assert.match(app,/createAppShellNoticeClickController/);
 assert.match(app,/shellNoticeClickController\.attach\(\)/);
 assert.doesNotMatch(app,/document\.addEventListener\('click',async e=>\{const link=e\.target\.closest\('\[data-notice\]'\)/);
});
