import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {renderEmployeeStaffMessages,hydrateEmployeeStaffChat} from '../public/employee-staff-chat-view.js';

test('chat del empleado renderiza historial diferido y recibo de lectura',()=>{
 const html=renderEmployeeStaffMessages([
  {id:'m2',senderRole:'employee',text:'Recibido',date:'2030-01-01T10:05:00.000Z'},
  {id:'m1',senderRole:'admin',text:'Hola equipo',date:'2030-01-01T10:00:00.000Z'}
 ],'2030-01-01T10:10:00.000Z');
 assert.ok(html.indexOf('Hola equipo')<html.indexOf('Recibido'));
 assert.match(html,/message mine/);
 assert.match(html,/message-check read/);
 assert.match(html,/title="Leído"/);
});

test('vista del chat hidrata sólo desde el endpoint dedicado y lleva el log al final',async()=>{
 const log={innerHTML:'',scrollTop:0,scrollHeight:240};
 const root={querySelector:selector=>selector==='.employee-message-log'?log:null};
 const calls=[];
 const ok=await hydrateEmployeeStaffChat(root,async(url,options)=>{
  calls.push([url,options]);
  return {ok:true,json:async()=>({messages:[{id:'m1',senderRole:'admin',text:'Mensaje remoto',date:'2030-01-01T10:00:00.000Z'}],readAt:''})};
 });
 assert.equal(ok,true);
 assert.deepEqual(calls,[['/api/staff-chat/messages',{credentials:'same-origin'}]]);
 assert.match(log.innerHTML,/Mensaje remoto/);
 assert.equal(log.scrollTop,240);
});

test('estado general conserva placeholders y el índice carga los runtimes oficiales en orden',async()=>{
 const [stateSource,runtimeSource,viewSource,indexSource]=await Promise.all([
  readFile(new URL('../state-routes.mjs',import.meta.url),'utf8'),
  readFile(new URL('../public/app-employee-staff-chat-runtime.js',import.meta.url),'utf8'),
  readFile(new URL('../public/employee-staff-chat-view.js',import.meta.url),'utf8'),
  readFile(new URL('../public/index.html',import.meta.url),'utf8')
 ]);
 assert.match(stateSource,/staffMessages:\[\],staffUnread:staffUnread\(user\),staffReadByAdmin:''/);
 assert.doesNotMatch(stateSource,/staffMessages:staffMessages\(user\),staffUnread:staffUnread\(user\),staffReadByAdmin:staffReadByAdmin\(user\.id\)/);
 assert.match(viewSource,/fetchImpl\('\/api\/staff-chat\/messages',\{credentials:'same-origin'\}\)/);
 assert.match(runtimeSource,/new MutationObserverRef\(hydrateVisible\)\.observe\(target,\{childList:true\}\)/);
 assert.match(indexSource,/employee-v4\.css[\s\S]*employee-staff-chat\.css[\s\S]*client-v5\.css/);
 assert.match(indexSource,/app-mobile-runtime\.js[\s\S]*app-admin-staff-chat-runtime\.js[\s\S]*app-employee-staff-chat-runtime\.js[\s\S]*app-shell-back-controller\.js/);
 assert.doesNotMatch(indexSource,/mobile-runtime-fixes\.js|admin-maintenance-ui\.js|employee-staff-chat-lazy\.js/);
});

test('runtime conserva lógica y delega toda la presentación al stylesheet formal',async()=>{
 const [runtimeSource,cssSource]=await Promise.all([
  readFile(new URL('../public/app-employee-staff-chat-runtime.js',import.meta.url),'utf8'),
  readFile(new URL('../public/employee-staff-chat.css',import.meta.url),'utf8')
 ]);
 assert.match(runtimeSource,/employee-send-spinner/);
 assert.match(runtimeSource,/dataset\.amcSending='1'/);
 assert.match(runtimeSource,/visualViewport\?\.addEventListener\('resize'/);
 assert.match(runtimeSource,/textarea\.blur\(\)/);
 assert.match(runtimeSource,/restoreComposer/);
 assert.match(runtimeSource,/focus\(\{preventScroll:true\}\)/);
 assert.match(runtimeSource,/documentRef\.addEventListener\('submit',onSubmit,\{capture:true\}\)/);
 assert.doesNotMatch(runtimeSource,/createElement\('style'\)|STYLE_TEXT|font-size:16px|!important/);
 assert.match(cssSource,/@keyframes amc-employee-spin/);
 assert.match(cssSource,/employee-send-spinner/);
 assert.match(cssSource,/form\.staff-message textarea\[name="text"\]\{font-size:16px;scroll-margin-bottom:140px\}/);
 assert.doesNotMatch(cssSource,/!important/);
});
