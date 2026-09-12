import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=name=>readFile(new URL('../'+name,import.meta.url),'utf8');

test('portada pública no usa observadores profundos que se autoalimentan',async()=>{
 const [maintenance,extras]=await Promise.all([
  source('public/admin-maintenance-ui.js'),
  source('public/admin-menu-extras.js')
 ]);
 assert.doesNotMatch(maintenance,/observe\(document\.documentElement,\{subtree:true,childList:true\}\)/);
 assert.match(maintenance,/observe\(appRoot,\{childList:true\}\)/);
 assert.match(maintenance,/badge&&badge\.textContent!==next/);
 assert.doesNotMatch(extras,/subtree:true/);
 assert.match(extras,/observe\(app,\{childList:true\}\)/);
});

test('Más deja un único chat global y no duplica la bandeja completa',async()=>{
 const [system,features,adminChat]=await Promise.all([
  source('public/admin-system-ui.js'),
  source('public/chat-features.js'),
  source('public/admin-chat-ui.js')
 ]);
 assert.doesNotMatch(system,/\['chat-admin','Chat'\]/);
 assert.match(system,/\['clientes','Clientes'\].*\['empleados','Empleados'\]/s);
 assert.match(features,/floatingEmployeeContacts\(\).*filter\(e=>e\.role==='employee'&&e\.active!==false\)/s);
 assert.match(adminChat,/const staff=state=>\(state\.employees\|\|\[\]\)\.filter\(item=>item\.role==='employee'&&item\.active!==false\)/);
});

test('chat flotante de empleado muestra el spinner dentro del mensaje y no reabre teclado móvil',async()=>{
 const floating=await source('public/floating-chat.js');
 assert.match(floating,/message-meta upload-state/);
 assert.match(floating,/message-upload-spinner/);
 assert.match(floating,/bubble\.querySelector\('\.upload-state'\)\?\.remove\(\)/);
 assert.doesNotMatch(floating,/send\.dataset\.sending='1'/);
 assert.doesNotMatch(floating,/send\.replaceChildren\(Object\.assign/);
 assert.match(floating,/send\.setAttribute\('aria-busy','true'\)/);
 assert.match(floating,/if\(mobile&&document\.activeElement===textarea\)textarea\.blur\(\)/);
 assert.match(floating,/if\(mobile\)textarea\.blur\(\);else textarea\.focus/);
 assert.match(floating,/font-size:16px/);
});
