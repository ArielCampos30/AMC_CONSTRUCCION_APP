import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {quotePersistentDocument,quoteContentVersion} from '../public/quote-persistence.js';
import {createQuoteSaveController,parseQuoteClientRef,resolveQuoteClientRef,buildDirectRequestPayload,validateQuoteDraft,queueAutomaticQuotePdf} from '../public/quote-save-controller.js';

test('controlador Guardar/Enviar usa API canónica y delega el PDF automático al generador existente',()=>{
 const controller=readFileSync(new URL('../public/quote-save-controller.js',import.meta.url),'utf8');
 const wrapper=readFileSync(new URL('../public/features-ui.js',import.meta.url),'utf8');
 assert.match(wrapper,/createQuoteSaveController/);
 assert.match(wrapper,/generatePdf:legacy\.generatePdf/);
 assert.match(controller,/\/api\/admin\/requests/);
 assert.match(controller,/\/api\/quotes/);
 assert.match(controller,/quotePersistentDocument/);
 assert.match(controller,/quoteContentVersion/);
 assert.match(controller,/queueAutomaticQuotePdf/);
 assert.match(controller,/Generando PDF automáticamente/);
 assert.match(controller,/dataset\.qwSaveQuote/);
 assert.match(controller,/presupuesto-admin\//);
 assert.match(controller,/new MutationObserver/);
 assert.match(controller,/hostObserver\.observe\(host,\{childList:true,subtree:true\}\)/);
 assert.match(controller,/button\.textContent!==label/);
 assert.match(controller,/button\.disabled!==disabled/);
 assert.doesNotMatch(controller,/presupuestos-bridge/);
 assert.doesNotMatch(controller,/createAndAttach|generatePendingPdf|pdfId/);
});

test('PDF automático se solicita una sola vez sólo cuando todavía falta',()=>{
 const calls=[];
 const generatePdf=(requestId,quoteId)=>calls.push([requestId,quoteId]);
 assert.equal(queueAutomaticQuotePdf({saved:{id:'q-1',requestId:'r-fallback',pdf:''},requestId:'r-1',generatePdf}),true);
 assert.deepEqual(calls,[['r-1','q-1']]);
 assert.equal(queueAutomaticQuotePdf({saved:{id:'q-2',requestId:'r-2',pdf:'/media/listo'},requestId:'r-2',generatePdf}),false);
 assert.equal(queueAutomaticQuotePdf({saved:{id:'q-3',requestId:'r-3',pdf:''},requestId:'r-3'}),false);
 assert.equal(calls.length,1);
});

test('referencia de cliente conserva el id completo aunque contenga separadores históricos',()=>{
 assert.deepEqual(parseQuoteClientRef('lead:legacy:cliente-1'),{kind:'lead',id:'legacy:cliente-1'});
 assert.deepEqual(parseQuoteClientRef('user:usuario-1'),{kind:'user',id:'usuario-1'});
 assert.deepEqual(parseQuoteClientRef('invalida'),{kind:'',id:''});
});

test('resuelve la ficha real y normaliza prefijos históricos incluso sin agenda cargada',()=>{
 const clients=[{id:'cliente-1',name:'Externo',hasAccount:0},{id:'usuario-1',name:'Registrado',hasAccount:1}];
 assert.deepEqual(resolveQuoteClientRef('lead:lead:cliente-1',clients),{kind:'lead',id:'cliente-1',client:clients[0]});
 assert.deepEqual(resolveQuoteClientRef('legacy:lead:cliente-1',clients),{kind:'lead',id:'cliente-1',client:clients[0]});
 assert.deepEqual(resolveQuoteClientRef('user:usuario-1',clients),{kind:'user',id:'usuario-1',client:clients[1]});
 assert.deepEqual(resolveQuoteClientRef('lead:lead:cliente-2',[]),{kind:'lead',id:'cliente-2',client:null});
});

test('payload directo prueba ambas fuentes de cliente sin perder validaciones del trabajo',()=>{
 const clients=[{id:'cliente-1',name:'Externo',hasAccount:0}];
 const payload=buildDirectRequestPayload({draft:{stage:4,clientRef:'legacy:lead:cliente-1',works:[{description:'Revoque fino',tariffRubric:'Albañilería'}],finalPrice:120000},clients,externalId:'qw-12345678'});
 assert.equal(payload.userId,'cliente-1');
 assert.equal(payload.leadId,'cliente-1');
 assert.equal(payload.service,'Albañilería');
 assert.equal(payload.description,'Presupuesto iniciado por Administración.');
 assert.match(payload.idempotencyKey,/^quote-direct-/);
});

test('validaciones previas distinguen cada dato obligatorio del presupuesto',()=>{
 const valid={stage:4,clientRef:'lead:cliente-1',works:[{description:'Pintura'}],finalPrice:100000};
 assert.equal(validateQuoteDraft(valid),true);
 assert.throws(()=>validateQuoteDraft({...valid,stage:3}),/Revisá el presupuesto/);
 assert.throws(()=>validateQuoteDraft({...valid,clientRef:''}),/Elegí un cliente/);
 assert.throws(()=>validateQuoteDraft({...valid,works:[]}),/al menos un trabajo/);
 assert.throws(()=>validateQuoteDraft({...valid,works:[{description:' '}]}),/Todos los trabajos/);
 assert.throws(()=>validateQuoteDraft({...valid,finalPrice:0}),/precio final mayor a cero/);
});

test('revisión reactiva Enviar presupuesto después de cada repintado del wizard',()=>{
 const previousDocument=globalThis.document;
 const previousMutationObserver=globalThis.MutationObserver;
 const previousRequestAnimationFrame=globalThis.requestAnimationFrame;
 let observerCallback=null,summary=null;
 const button={dataset:{},disabled:true,textContent:'Guardar / enviar · siguiente bloque'};
 const context={
  querySelector(selector){return selector==='[data-qw-save-summary]'?summary:null;},
  append(node){summary=node;}
 };
 const host={querySelector(selector){if(selector==='.quote-wizard-controls .primary')return button;if(selector==='.quote-review-context')return context;return null;}};
 try{
  globalThis.document={
   querySelector(selector){return selector==='.quote-wizard-host'?host:null;},
   createElement(){return {className:'',dataset:{},innerHTML:''};},
   addEventListener(){}
  };
  globalThis.MutationObserver=class{
   constructor(callback){observerCallback=callback;}
   observe(){}
   disconnect(){}
  };
  globalThis.requestAnimationFrame=callback=>{callback();return 1;};
  const draft={stage:4,requestId:'req-1',clientRef:'user:u1',works:[{description:'Revoque'}],finalPrice:955000};
  const controller=createQuoteSaveController({
   getState:()=>({requests:[{id:'req-1',userId:'u1',name:'Cliente'}],agendaClients:[{id:'u1',hasAccount:1,name:'Cliente'}],quotes:[]}),
   api:async()=>({}),refresh:async()=>{},navigate(){},toast(){},wizard:{getDraft:()=>draft}
  });
  controller.afterRender('cotizador');
  assert.equal(button.disabled,false);
  assert.equal(button.textContent,'Enviar presupuesto');
  assert.equal(button.dataset.qwSaveQuote,'1');
  assert.ok(summary);
  button.dataset={};button.disabled=true;button.textContent='Guardar / enviar · siguiente bloque';
  observerCallback?.([]);
  assert.equal(button.disabled,false);
  assert.equal(button.textContent,'Enviar presupuesto');
  assert.equal(button.dataset.qwSaveQuote,'1');
 }finally{
  if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;
  if(previousMutationObserver===undefined)delete globalThis.MutationObserver;else globalThis.MutationObserver=previousMutationObserver;
  if(previousRequestAnimationFrame===undefined)delete globalThis.requestAnimationFrame;else globalThis.requestAnimationFrame=previousRequestAnimationFrame;
 }
});

test('documento persistente y hash cambian sólo con contenido persistente',async()=>{
 const base={requestId:'req-1',externalId:'ext-1',number:'AMC-1',works:[{id:'w1',description:'Revoque grueso interior',quantity:12,quantityExplicit:true,unit:'m²',materials:1000,tools:200,other:300,labor:0,costsConfirmed:true,workers:2,days:1,hours:8,tariffKey:'revoque',tariffTask:'Revoque grueso interior',tariffRubric:'Albañilería',tariffUnit:'m²',tariffPrice:10000,tariffKind:'tariff'}],travel:500,employeeDay:25000,finalPrice:120000,finalPriceManual:false,desiredMargin:30,payment:'50%',notes:'',snapshot:{internalCost:52000,gain:68000}};
 const one=quotePersistentDocument(base),two=quotePersistentDocument(structuredClone(base));
 assert.deepEqual(one,two);
 assert.equal(await quoteContentVersion(one),await quoteContentVersion(two));
 const changed=quotePersistentDocument({...base,finalPrice:125000,snapshot:{internalCost:52000,gain:73000}});
 assert.notEqual(await quoteContentVersion(one),await quoteContentVersion(changed));
 assert.equal(one.adminModel.works[0].description,'Revoque grueso interior');
 assert.equal(one.total,120000);
 assert.equal(one.adminModel.finalPrice,120000);
});