import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createAppShellClickController} from '../public/app-shell-click-controller.js';

const target=map=>({closest:selector=>map[selector]||null});
const documentStub=(menus=[])=>({
 listeners:[],
 addEventListener(type,handler,options){this.listeners.push([type,handler,options]);},
 querySelectorAll(selector){return selector==='.admin-v3-actions details[open]'?menus:[];},
 querySelector(){return null;},
});
const base=(overrides={})=>{
 const documentRef=documentStub();
 const calls=[];
 const controller=createAppShellClickController({
  documentRef,
  render:()=>calls.push(['render']),
  navigate:value=>calls.push(['navigate',value]),
  api:(path,body)=>{calls.push(['api',path,body]);return Promise.resolve({noticeIds:['n1']});},
  applyNoticeRead:ids=>calls.push(['read',ids]),
  teamClick:()=>false,
  planningClick:async()=>false,
  reload:async()=>calls.push(['reload']),
  onAdminFilter:(kind,value)=>calls.push(['filter',kind,value]),
  onAdminChatTab:value=>calls.push(['tab',value]),
  onAdminEmployee:value=>calls.push(['employee',value]),
  setDirty:value=>calls.push(['dirty',value]),
  onAction:async button=>calls.push(['action',button.dataset.action]),
  onError:error=>calls.push(['error',error.message]),
  onMessage:text=>calls.push(['message',text]),
  ...overrides,
 });
 return {controller,documentRef,calls};
};

test('attach registra mantenimiento de presupuestos en captura y listener general del shell',()=>{
 const {controller,documentRef}=base();
 controller.attach();
 assert.equal(documentRef.listeners.length,2);
 assert.deepEqual(documentRef.listeners[0],['click',controller.quoteMaintenanceController.handleClick,true]);
 assert.deepEqual(documentRef.listeners[1],['click',controller.handleClick,undefined]);
});

test('quitar foto conserva archivos restantes y dispara change burbujeante',async()=>{
 const files=['a','b','c'],dispatched=[];
 const input={files,dispatchEvent:event=>dispatched.push(event)};
 const form={elements:{photos:input}};
 const remove={dataset:{removeRequestPhoto:'photos:1'},closest:selector=>selector==='form'?form:null};
 const transfer={items:{values:[],add(file){this.values.push(file);}},get files(){return this.items.values;}};
 const {controller,calls}=base({createDataTransfer:()=>transfer,createEvent:(type,options)=>({type,...options})});
 await controller.handleClick({target:target({'[data-remove-request-photo]':remove})});
 assert.deepEqual(input.files,['a','c']);
 assert.deepEqual(dispatched,[{type:'change',bubbles:true}]);
 assert.deepEqual(calls,[]);
});

test('filtros, pestaña y empleado conservan delegación y lectura de chat',async()=>{
 const {controller,calls}=base();
 const filter={dataset:{adminFilter:'quote',value:'Pendientes'}};
 await controller.handleClick({target:target({'[data-admin-filter]':filter})});
 const tab={dataset:{adminChat:'Equipo'}};
 await controller.handleClick({target:target({'[data-admin-chat]':tab})});
 const employee={dataset:{adminEmployee:'emp-7'}};
 await controller.handleClick({target:target({'[data-admin-employee]':employee})});
 await Promise.resolve();
 assert.deepEqual(calls,[
  ['filter','quote','Pendientes'],['render'],
  ['tab','Equipo'],['render'],
  ['employee','emp-7'],['render'],
  ['api','/api/staff-chat/read',{employeeId:'emp-7'}],['read',['n1']],
 ]);
});

test('menús Admin conservan cierre exterior, exclusión del actual y dirty',async()=>{
 const current={removed:false,removeAttribute(){this.removed=true;}},other={removed:false,removeAttribute(){this.removed=true;}};
 const documentRef=documentStub([current,other]),calls=[];
 const controller=createAppShellClickController({documentRef,setDirty:value=>calls.push(value)});
 const summary={parentElement:current};
 await controller.handleClick({target:target({'.admin-v3-actions details':current,'.admin-v3-actions details>summary':summary})});
 assert.equal(current.removed,false);
 assert.equal(other.removed,true);
 assert.deepEqual(calls,[true]);
 const outside={removed:false,removeAttribute(){this.removed=true;}};
 documentRef.querySelectorAll=()=>[outside];
 await controller.handleClick({target:target({})});
 assert.equal(outside.removed,true);
});

test('data-nav navega y no ejecuta data-action',async()=>{
 const {controller,calls}=base();
 const nav={dataset:{nav:'presupuestos'}};
 const button={dataset:{action:'favorite'}};
 await controller.handleClick({target:target({'[data-nav]':nav,'[data-action]':button})});
 assert.deepEqual(calls,[['navigate','presupuestos']]);
});

test('team y planning conservan prioridad, render y cancelación con reload',async()=>{
 const calls=[];
 const team=createAppShellClickController({
  documentRef:documentStub(),render:()=>calls.push('render'),teamClick:(action,value)=>{calls.push(['team',action,value]);return true;},planningClick:async()=>{calls.push('planning');return true;},onAction:()=>calls.push('action'),
 });
 await team.handleClick({target:target({'[data-action]':{dataset:{action:'x',value:'v'}}})});
 assert.deepEqual(calls,[['team','x','v'],'render']);
 calls.length=0;
 const planning=createAppShellClickController({
  documentRef:documentStub(),render:()=>calls.push('render'),teamClick:()=>false,planningClick:async(action,id)=>{calls.push(['planning',action,id]);return true;},reload:async()=>calls.push('reload'),setDirty:value=>calls.push(['dirty',value]),onAction:()=>calls.push('action'),
 });
 await planning.handleClick({target:target({'[data-action]':{dataset:{action:'calendar-cancel',id:'w1'}}})});
 assert.deepEqual(calls,[['planning','calendar-cancel','w1'],'reload',['dirty',false],'render']);
});

test('acciones normales se delegan una vez y los errores mantienen el filtro AbortError',async()=>{
 const {controller,calls}=base({onAction:async button=>{calls.push(['delegated',button.dataset.action]);throw new Error('boom');}});
 await controller.handleClick({target:target({'[data-action]':{dataset:{action:'share'}}})});
 assert.deepEqual(calls,[['delegated','share'],['error','boom']]);
 calls.length=0;
 const abort=Object.assign(new Error('cancelado'),{name:'AbortError'});
 const quiet=createAppShellClickController({documentRef:documentStub(),teamClick:()=>false,planningClick:async()=>false,onAction:async()=>{throw abort;},onError:error=>calls.push(error)});
 await quiet.handleClick({target:target({'[data-action]':{dataset:{action:'share'}}})});
 assert.deepEqual(calls,[]);
});

test('app.js delega el listener principal sin absorber clicks especializados',async()=>{
 const [app,shell,index]=await Promise.all([
  readFile(new URL('../public/app.js',import.meta.url),'utf8'),
  readFile(new URL('../public/app-shell-click-controller.js',import.meta.url),'utf8'),
  readFile(new URL('../public/index.html',import.meta.url),'utf8'),
 ]);
 assert.match(app,/createAppShellClickController/);
 assert.match(app,/shellClickController\.attach\(\)/);
 assert.doesNotMatch(app,/document\.addEventListener\('click',async e=>\{const removePhoto=/);
 assert.match(app,/createAppShellNoticeClickController/);
 assert.match(app,/shellNoticeClickController\.attach\(\)/);
 assert.doesNotMatch(app,/document\.addEventListener\('click',async e=>\{const link=e\.target\.closest\('\[data-notice\]'\)/);
 assert.match(app,/share-quote-whatsapp/);
 assert.match(shell,/createAdminQuoteMaintenanceController/);
 assert.match(shell,/quoteMaintenanceController\.attach\(\)/);
 assert.doesNotMatch(index,/admin-maintenance-ui\.js/);
});
