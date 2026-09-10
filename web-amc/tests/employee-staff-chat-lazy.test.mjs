import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {renderEmployeeStaffMessages} from '../public/employee-staff-chat-lazy.js';

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

test('estado general del empleado conserva placeholders y el historial se obtiene sólo desde su endpoint',async()=>{
 const [stateSource,lazySource,indexSource]=await Promise.all([
  readFile(new URL('../state-routes.mjs',import.meta.url),'utf8'),
  readFile(new URL('../public/employee-staff-chat-lazy.js',import.meta.url),'utf8'),
  readFile(new URL('../public/index.html',import.meta.url),'utf8')
 ]);
 assert.match(stateSource,/staffMessages:\[\],staffUnread:staffUnread\(user\),staffReadByAdmin:''/);
 assert.doesNotMatch(stateSource,/staffMessages:staffMessages\(user\),staffUnread:staffUnread\(user\),staffReadByAdmin:staffReadByAdmin\(user\.id\)/);
 assert.match(lazySource,/fetchImpl\('\/api\/staff-chat\/messages',\{credentials:'same-origin'\}\)/);
 assert.match(lazySource,/MutationObserver/);
 assert.match(indexSource,/employee-staff-chat-lazy\.js/);
});
