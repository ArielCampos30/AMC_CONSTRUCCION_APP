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
 const [system,features,legacy]=await Promise.all([
  source('public/admin-system-ui.js'),
  source('public/features-ui.js'),
  source('public/admin-chat-ui.js')
 ]);
 assert.doesNotMatch(system,/\['chat-admin','Chat'\]/);
 assert.match(system,/\['clientes','Clientes'\].*\['empleados','Empleados'\]/s);
 assert.match(features,/floatingEmployeeContacts\(\).*filter\(e=>e\.role==='employee'&&e\.active!==false\)/s);
 assert.match(legacy,/const staff=state=>\(state\.employees\|\|\[\]\)\.filter\(item=>item\.role==='employee'&&item\.active!==false\)/);
});

test('chat flotante de empleado muestra carga real y no reabre teclado móvil al enviar',async()=>{
 const floating=await source('public/floating-chat.js');
 assert.match(floating,/chat-send-spinner/);
 assert.match(floating,/send\.dataset\.sending='1'/);
 assert.match(floating,/aria-busy/);
 assert.match(floating,/if\(mobile&&document\.activeElement===textarea\)textarea\.blur\(\)/);
 assert.match(floating,/if\(mobile\)textarea\.blur\(\);else textarea\.focus/);
 assert.match(floating,/font-size:16px/);
});
