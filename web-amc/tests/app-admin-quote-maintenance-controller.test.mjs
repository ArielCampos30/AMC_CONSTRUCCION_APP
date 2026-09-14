import test from 'node:test';
import assert from 'node:assert/strict';
import {createAdminQuoteMaintenanceController} from '../public/app-admin-quote-maintenance-controller.js';

const documentStub=()=>({
 listeners:[],
 toast:{textContent:'',classList:{values:new Set(),add(value){this.values.add(value);}}},
 addEventListener(type,handler,options){this.listeners.push([type,handler,options]);},
 querySelector(selector){return selector==='#toast'?this.toast:null;},
});
const createCard=id=>{
 const parent={isConnected:true,children:[],insertBefore(node,next){const index=next?this.children.indexOf(next):-1;if(index>=0)this.children.splice(index,0,node);else this.children.push(node);node.parentNode=this;node.isConnected=true;}};
 const card={id,parentNode:parent,nextSibling:null,isConnected:true,remove(){this.isConnected=false;parent.children=parent.children.filter(item=>item!==this);}};
 parent.children.push(card);
 const button={dataset:{id,maintenanceAction:''},disabled:false,isConnected:true,closest:selector=>selector==='.admin-v3-card'?card:null};
 return {parent,card,button};
};
const eventFor=button=>({
 target:{closest:selector=>selector==='[data-maintenance-action]'?button:null},
 prevented:false,stopped:false,
 preventDefault(){this.prevented=true;},
 stopImmediatePropagation(){this.stopped=true;},
});
const base=(overrides={})=>{
 const documentRef=overrides.documentRef||documentStub(),calls=[];
 const controller=createAdminQuoteMaintenanceController({
  documentRef,
  api:async(path,body)=>{calls.push(['api',path,body]);return {};},
  onSuccess:text=>calls.push(['success',text]),
  onError:error=>calls.push(['error',error.message]),
  confirmAction:async(message,title,label)=>{calls.push(['confirm',message,title,label]);return true;},
  ...overrides,
 });
 return {controller,documentRef,calls};
};

test('attach conserva listener click en fase de captura',()=>{
 const {controller,documentRef}=base();
 controller.attach();
 assert.deepEqual(documentRef.listeners,[['click',controller.handleClick,true]]);
});

test('archivar confirma, retira la tarjeta de forma optimista y usa endpoint central',async()=>{
 const {controller,calls}=base();
 const {card,button}=createCard('q 1');button.dataset.maintenanceAction='archive-quote';
 const event=eventFor(button);
 const handled=await controller.handleClick(event);
 assert.equal(handled,true);
 assert.equal(event.prevented,true);
 assert.equal(event.stopped,true);
 assert.equal(card.isConnected,false);
 assert.equal(button.disabled,false);
 assert.deepEqual(calls,[
  ['confirm','El presupuesto saldrá de Pendientes y quedará disponible en Archivados.','Archivar presupuesto','Archivar'],
  ['api','/api/quotes/q%201/archive',{}],
  ['success','Presupuesto archivado.'],
 ]);
});

test('recuperar no pide confirmación y conserva respuesta optimista',async()=>{
 const {controller,calls}=base();
 const {card,button}=createCard('q2');button.dataset.maintenanceAction='unarchive-quote';
 await controller.handleClick(eventFor(button));
 assert.equal(card.isConnected,false);
 assert.deepEqual(calls,[
  ['api','/api/quotes/q2/unarchive',{}],
  ['success','Presupuesto recuperado.'],
 ]);
});

test('eliminar definitivamente conserva confirmación y endpoint actual',async()=>{
 const {controller,calls}=base();
 const {button}=createCard('q3');button.dataset.maintenanceAction='delete-quote';
 await controller.handleClick(eventFor(button));
 assert.deepEqual(calls,[
  ['confirm','¿Eliminar definitivamente este presupuesto archivado? Sólo se permite si no creó una obra.','Eliminar presupuesto','Eliminar definitivamente'],
  ['api','/api/quotes/q3/delete',{}],
  ['success','Presupuesto eliminado.'],
 ]);
});

test('cancelar confirmación no modifica DOM ni llama API',async()=>{
 const calls=[];
 const {controller}=base({confirmAction:async(...args)=>{calls.push(['confirm',...args]);return false;},api:async()=>{calls.push(['api']);}});
 const {card,button}=createCard('q4');button.dataset.maintenanceAction='archive-quote';
 await controller.handleClick(eventFor(button));
 assert.equal(card.isConnected,true);
 assert.equal(button.disabled,false);
 assert.equal(calls.length,1);
 assert.equal(calls[0][0],'confirm');
});

test('si falla la API restaura la tarjeta en su posición y delega el error',async()=>{
 const calls=[];
 const {controller}=base({api:async()=>{throw new Error('falló');},onError:error=>calls.push(error.message)});
 const {parent,card,button}=createCard('q5');button.dataset.maintenanceAction='unarchive-quote';
 const sibling={id:'next',parentNode:parent,isConnected:true};parent.children.push(sibling);card.nextSibling=sibling;
 await controller.handleClick(eventFor(button));
 assert.equal(card.isConnected,true);
 assert.deepEqual(parent.children,[card,sibling]);
 assert.deepEqual(calls,['falló']);
 assert.equal(button.disabled,false);
});

test('vista detalle sin admin-v3-card ejecuta API sin inventar navegación ni remoción',async()=>{
 const {controller,calls}=base();
 const button={dataset:{id:'q6',maintenanceAction:'unarchive-quote'},disabled:false,isConnected:true,closest:()=>null};
 await controller.handleClick(eventFor(button));
 assert.deepEqual(calls,[['api','/api/quotes/q6/unarchive',{}],['success','Presupuesto recuperado.']]);
 assert.equal(button.disabled,false);
});

test('botón ya bloqueado no duplica operación y clicks ajenos quedan libres',async()=>{
 const {controller,calls}=base();
 const {button}=createCard('q7');button.dataset.maintenanceAction='archive-quote';button.disabled=true;
 assert.equal(await controller.handleClick(eventFor(button)),true);
 assert.deepEqual(calls,[]);
 const unrelated={target:{closest:()=>null}};
 assert.equal(await controller.handleClick(unrelated),false);
});
