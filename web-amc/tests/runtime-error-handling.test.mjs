import test from 'node:test';
import assert from 'node:assert/strict';
import {createAppSyncRuntime} from '../public/app-sync-runtime.js';
import {createEmployeeStaffChatRuntime} from '../public/app-employee-staff-chat-runtime.js';
import {createQuoteViewTracker} from '../public/quote-view-tracker.js';
import {createAppShellClickController} from '../public/app-shell-click-controller.js';

const flush=async()=>{await Promise.resolve();await Promise.resolve();};

test('sincronización informa sólo después de tres fallos consecutivos y registra recuperación',async()=>{
 let now=100000,timer,attempts=0;
 const issues=[],recoveries=[];
 const runtime=createAppSyncRuntime({
  reload:async()=>{},getState:()=>({user:{role:'admin'}}),getPage:()=> 'inicio',isDirty:()=>false,isLoggingOut:()=>false,isHidden:()=>false,hasEstimator:()=>false,stateSignature:()=>'',syncChatAccess:()=>{},render:()=>{},
  pollState:async()=>{attempts++;if(attempts<=3)throw Error('sin red');},
  windowTarget:{addEventListener(){}},documentTarget:{addEventListener(){}},schedule:(handler,delay)=>{timer={handler,delay};return timer;},now:()=>now,
  onSyncIssue:(error,meta)=>issues.push([error.message,meta]),onSyncRecovered:meta=>recoveries.push(meta),issueThreshold:3,
 });
 runtime.startPolling();
 for(let i=0;i<3;i++){await timer.handler();now+=15000;}
 assert.equal(issues.length,1);
 assert.equal(issues[0][0],'sin red');
 assert.deepEqual(issues[0][1],{phase:'poll',consecutiveFailures:3});
 assert.deepEqual(runtime.diagnostics(),{consecutiveFailures:3,issueOpen:true,lastFailurePhase:'poll'});
 await timer.handler();
 assert.equal(recoveries.length,1);
 assert.equal(runtime.diagnostics().issueOpen,false);
 assert.equal(runtime.diagnostics().consecutiveFailures,0);
});

test('chat del empleado muestra error y hace un único reintento automático',async()=>{
 let calls=0,errorVisible=false,retryHandler=null;
 const errorNotice={remove(){errorVisible=false;}};
 const log={innerHTML:'',scrollTop:0,scrollHeight:120,querySelector:selector=>selector==='[data-staff-chat-load-error]'&&errorVisible?errorNotice:null,insertAdjacentHTML(){errorVisible=true;}};
 const root={dataset:{},querySelector:selector=>selector==='.employee-message-log'?log:selector==='[data-staff-chat-load-error]'&&errorVisible?errorNotice:null};
 const errors=[];
 const runtime=createEmployeeStaffChatRuntime({
  documentRef:{querySelector:selector=>selector==='.employee-staff-chat'?root:null},requestAnimationFrameRef:handler=>handler(),setTimeoutRef:handler=>{retryHandler=handler;return 1;},clearTimeoutRef:()=>{},fetchImpl:async()=>{calls++;if(calls===1)throw Error('chat sin conexión');return {ok:true,json:async()=>({messages:[{id:'m1',senderRole:'admin',text:'Recuperado',date:'2030-01-01T10:00:00.000Z'}],readAt:''})};},onHydrationError:error=>errors.push(error.message),retryDelayMs:1,
 });
 runtime.hydrateVisible();await flush();
 assert.equal(calls,1);assert.equal(errorVisible,true);assert.equal(root.dataset.staffChatError,'1');assert.deepEqual(errors,['chat sin conexión']);assert.equal(typeof retryHandler,'function');
 retryHandler();await flush();
 assert.equal(calls,2);assert.equal(errorVisible,false);assert.equal(root.dataset.staffChatError,undefined);assert.match(log.innerHTML,/Recuperado/);
});

test('marcado automático de presupuesto visto reintenta tras fallo transitorio',async()=>{
 const previousObserver=globalThis.IntersectionObserver,previousDocument=globalThis.document;
 let callback,scheduled,observes=0,calls=0;
 const target={dataset:{quoteId:'q1'},isConnected:true};
 const quote={id:'q1',seenAt:''},errors=[],read=[];
 globalThis.IntersectionObserver=class{constructor(handler){callback=handler;}observe(){observes++;}unobserve(){}disconnect(){}};
 globalThis.document={querySelectorAll:()=>[target]};
 try{
  const tracker=createQuoteViewTracker({getState:()=>({quotes:[quote]}),isAdmin:()=>false,api:async()=>{calls++;if(calls===1)throw Error('vista no guardada');return {noticeIds:['n1']};},onNoticesRead:ids=>read.push(...ids),schedule:handler=>{scheduled=handler;},retryDelayMs:1,onError:error=>errors.push(error.message)});
  tracker.afterRender('presupuestos');
  callback([{isIntersecting:true,target}]);await flush();
  assert.equal(calls,1);assert.deepEqual(errors,['vista no guardada']);assert.equal(typeof scheduled,'function');
  scheduled();assert.ok(observes>=2);
  callback([{isIntersecting:true,target}]);await flush();
  assert.equal(calls,2);assert.ok(quote.seenAt);assert.deepEqual(read,['n1']);
 }finally{globalThis.IntersectionObserver=previousObserver;globalThis.document=previousDocument;}
});

test('lectura de chat del equipo entrega el error al controlador en lugar de ocultarlo',async()=>{
 const errors=[];
 const controller=createAppShellClickController({
  documentRef:{querySelectorAll:()=>[],querySelector:()=>null},render:()=>{},onAdminEmployee:()=>{},api:async()=>{throw Error('no se pudo marcar leído');},onError:error=>errors.push(error.message),
 });
 const employee={dataset:{adminEmployee:'emp-1'}};
 const target={closest:selector=>selector==='[data-admin-employee]'?employee:null};
 await controller.handleClick({target});await flush();
 assert.deepEqual(errors,['no se pudo marcar leído']);
});
