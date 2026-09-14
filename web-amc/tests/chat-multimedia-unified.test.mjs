import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('empleado usa sólo chat flotante con Administración y conserva ruta histórica',async()=>{
 const [chat,navigation,router,route]=await Promise.all([
  readFile(new URL('../public/chat-features.js',import.meta.url),'utf8'),
  readFile(new URL('../public/app-shell-navigation.js',import.meta.url),'utf8'),
  readFile(new URL('../public/app-page-router.js',import.meta.url),'utf8'),
  readFile(new URL('../public/active-chat-route-runtime.js',import.meta.url),'utf8'),
 ]);
 assert.doesNotMatch(navigation,/EMPLOYEE_LINKS=.*chat-equipo/);
 assert.match(router,/page==='chat-equipo'.*page:'inicio-empleado'.*legacyEmployeeChat:true/s);
 assert.match(chat,/name:'AMC \/ Administración'/);
 assert.match(chat,/role\(\)==='employee'.*floatingEmployeeContacts/s);
 assert.match(chat,/openEmployeeAdminChat/);
 assert.match(chat,/a\[href="#chat-equipo"\]/);
 assert.match(route,/staffForm\?\.dataset\.employee\|\|selectedFloatingContact/);
});

test('chat flotante de equipo permite texto, galería, cámara y hasta cuatro fotos reutilizando upload existente',async()=>{
 const [chat,floating,backend]=await Promise.all([
  readFile(new URL('../public/chat-features.js',import.meta.url),'utf8'),
  readFile(new URL('../public/floating-chat.js',import.meta.url),'utf8'),
  readFile(new URL('../chat-core.mjs',import.meta.url),'utf8'),
 ]);
 assert.match(chat,/floating-staff-message/);
 assert.match(chat,/name="photos" type="file" multiple accept="image\/jpeg,image\/png,image\/webp"/);
 assert.match(chat,/files\.length>4/);
 assert.match(chat,/await upload\(file,/);
 assert.match(chat,/\/api\/staff-chat\/messages/);
 assert.match(chat,/photos,idempotencyKey/);
 assert.match(floating,/Sacar foto/);
 assert.match(floating,/capture','environment'/);
 assert.match(floating,/existing\.length>=4/);
 assert.match(backend,/p==='\/api\/staff-chat\/messages'.*photos=.*slice\(0,4\).*safeFile/s);
});

test('fotos de chat usan thumbnails y el visor abre preview antes de precargar original',async()=>{
 const [viewer,employeeView,adminRuntime,adminUI,app]=await Promise.all([
  readFile(new URL('../public/media-viewer.js',import.meta.url),'utf8'),
  readFile(new URL('../public/employee-staff-chat-view.js',import.meta.url),'utf8'),
  readFile(new URL('../public/app-admin-staff-chat-runtime.js',import.meta.url),'utf8'),
  readFile(new URL('../public/admin-chat-ui.js',import.meta.url),'utf8'),
  readFile(new URL('../public/app.js',import.meta.url),'utf8'),
 ]);
 assert.match(app,/src="\$\{esc\(url\)\}\?thumb=1"/);
 assert.match(employeeView,/\?thumb=1/);
 assert.doesNotMatch(employeeView,/target="_blank"/);
 assert.match(adminRuntime,/url\+'\?thumb=1'/);
 assert.match(adminUI,/\?thumb=1/);
 assert.match(viewer,/currentSrc\|\|thumb\?\.src\|\|source/);
 assert.match(viewer,/img\.src=preview/);
 assert.match(viewer,/const original=new Image\(\)/);
 assert.match(viewer,/original\.src=source/);
 assert.match(viewer,/pointermove/);
 assert.match(viewer,/dblclick/);
});
