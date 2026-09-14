import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {adminStaffMessageRows} from '../public/app-admin-staff-chat-runtime.js';

test('chat flotante admin ordena mensajes y conserva recibos de lectura',()=>{
 const rows=adminStaffMessageRows([
  {id:'m2',senderRole:'admin',senderName:'AMC',text:'Segundo',date:'2030-01-01T10:05:00.000Z'},
  {id:'m1',senderRole:'employee',senderName:'Operario',text:'Primero',date:'2030-01-01T10:00:00.000Z'},
  {id:'m3',senderRole:'admin',senderName:'AMC',text:'Tercero',date:'2030-01-01T10:10:00.000Z'},
 ],'2030-01-01T10:06:00.000Z');
 assert.deepEqual(rows.map(row=>row.id),['m1','m2','m3']);
 assert.equal(rows[0].mine,false);
 assert.equal(rows[0].senderName,'Operario');
 assert.equal(rows[1].mine,true);
 assert.equal(rows[1].read,true);
 assert.equal(rows[2].read,false);
});

test('runtime dedicado conserva hidratación y hooks móviles con shell flotante propio',async()=>{
 const [runtime,mobile,index,floating]=await Promise.all([
  readFile(new URL('../public/app-admin-staff-chat-runtime.js',import.meta.url),'utf8'),
  readFile(new URL('../public/mobile-runtime-fixes.js',import.meta.url),'utf8'),
  readFile(new URL('../public/index.html',import.meta.url),'utf8'),
  readFile(new URL('../public/floating-chat.js',import.meta.url),'utf8'),
 ]);
 assert.match(runtime,/message\.optimistic,.message\[data-message-id\]/);
 assert.match(runtime,/staff-chat\/messages\?employeeId=/);
 assert.match(runtime,/credentials:'same-origin'/);
 assert.match(runtime,/dialog\.open/);
 assert.match(runtime,/dialog\.contains\(form\)/);
 assert.match(runtime,/scrollTop=log\.scrollHeight/);
 assert.match(runtime,/addEventListener\('pointerdown'/);
 assert.match(runtime,/addEventListener\('submit'/);
 assert.match(floating,/getBoundingClientRect\(\)/);
 assert.match(floating,/onOutsidePointerDown/);
 assert.doesNotMatch(floating,/!important/);
 assert.match(mobile,/floating-staff-message/);
 assert.match(mobile,/selectedFloatingContact/);
 assert.match(index,/mobile-runtime-fixes\.js[\s\S]*app-admin-staff-chat-runtime\.js[\s\S]*app-employee-staff-chat-runtime\.js/);
 assert.doesNotMatch(index,/admin-maintenance-ui\.js/);
});
