import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createAdminChatUI} from '../public/admin-chat-ui.js';

test('chat de equipo del Admin carga mensajes y lectura sólo al pedirlos',async()=>{
 const state={user:{id:'admin-1',role:'admin'},employees:[{id:'employee-1',name:'Operario',role:'employee',active:true}],staffMessages:[],staffReadByEmployee:{}};
 let selected='',calls=0;
 const ui=createAdminChatUI({
  getState:()=>state,getTab:()=>'Equipo',getEmployee:()=>selected,setEmployee:value=>selected=value,
  renderClientMessages:()=>'',heading:()=>'',esc:String,date:String,
  fetchStaffChat:async employeeId=>{calls++;assert.equal(employeeId,'employee-1');return {messages:[{id:'m1',employeeId:'employee-1',senderRole:'admin',text:'Hola equipo',date:'2030-01-01T10:00:00.000Z'}],readAt:'2030-01-01T11:00:00.000Z'};}
 });
 await ui.refreshStaffChat('employee-1');
 const html=ui.render();
 assert.equal(calls,1);
 assert.match(html,/Hola equipo/);
 assert.match(html,/message-check read/);
});

test('api state conserva placeholders sin consultar todo el chat del equipo para Admin',async()=>{
 const [stateSource,uiSource,chatSource]=await Promise.all([
  readFile(new URL('../state-routes.mjs',import.meta.url),'utf8'),
  readFile(new URL('../public/admin-chat-ui.js',import.meta.url),'utf8'),
  readFile(new URL('../chat-core.mjs',import.meta.url),'utf8')
 ]);
 assert.match(stateSource,/staffMessages:\[\]/);
 assert.match(stateSource,/staffReadByEmployee:user\.role==='admin'\?\{\}:undefined/);
 assert.doesNotMatch(stateSource,/staffMessages:user\.role==='admin'\?staffMessages\(user\):\[\]/);
 assert.doesNotMatch(stateSource,/staffReadByEmployee:user\.role==='admin'\?staffReadByEmployee\(\):undefined/);
 assert.match(uiSource,/\/api\/staff-chat\/messages\?employeeId=/);
 assert.match(uiSource,/credentials:'same-origin'/);
 assert.match(chatSource,/readAt=user\.role==='admin'/);
});
