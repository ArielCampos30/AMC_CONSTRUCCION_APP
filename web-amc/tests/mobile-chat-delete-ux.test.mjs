import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=name=>readFile(new URL('../'+name,import.meta.url),'utf8');

test('chat móvil sólo se expande cuando el teclado reduce realmente el viewport',async()=>{
 const mobile=await source('public/mobile-runtime-fixes.js');
 assert.match(mobile,/mobileViewportBaseline-currentHeight>110/);
 assert.doesNotMatch(mobile,/keyboardOpen=focused&&narrow;/);
 assert.match(mobile,/dialog\.classList\.toggle\('amc-keyboard-open',keyboardOpen\)/);
});

test('enviar desde chat flotante móvil cierra el teclado y no lo reabre al terminar',async()=>{
 const mobile=await source('public/mobile-runtime-fixes.js');
 assert.match(mobile,/function dismissComposerAfterSend\(form\)/);
 assert.match(mobile,/textarea\.blur\(\)/);
 assert.match(mobile,/MutationObserver/);
 assert.match(mobile,/attributeFilter:\['disabled'\]/);
});

test('estado de envío muestra icono sin porcentaje',async()=>{
 const [mobile,features]=await Promise.all([source('public/mobile-runtime-fixes.js'),source('public/chat-features.js')]);
 assert.match(features,/message-upload-spinner/);
 assert.match(mobile,/upload-state>span:not\(\.message-upload-spinner\)\{display:none!important\}/);
});

test('borrar avisos y archivar presupuesto conservan respuestas optimistas sin refrescar toda la pantalla',async()=>{
 const [maintenance,noticeController,appearanceController]=await Promise.all([
  source('public/admin-maintenance-ui.js'),
  source('public/app-shell-notice-click-controller.js'),
  source('public/app-admin-appearance-controller.js')
 ]);
 assert.match(maintenance,/let csrfValue='',csrfPending=null/);
 assert.match(maintenance,/queueMicrotask\(\(\)=>csrf\(\)\.catch/);
 assert.match(maintenance,/function detachNodes\(nodes\)/);
 assert.match(maintenance,/optimisticTargets\(action,button\)/);
 assert.match(maintenance,/action==='archive-quote'[\s\S]*detachNodes/);
 assert.doesNotMatch(maintenance,/action==='delete-notice'/);
 assert.match(noticeController,/const deleteNotice=async\(button,event\)=>/);
 assert.match(noticeController,/card\?\.remove\(\)/);
 assert.match(noticeController,/await api\('\/api\/notices\/read',\{deleteId:id\}\)/);
 assert.match(noticeController,/parent\.insertBefore\(card/);
 assert.doesNotMatch(maintenance,/restore-appearance|refreshWithoutReload/);
 assert.match(appearanceController,/action!=='restore-appearance'/);
 assert.match(appearanceController,/await api\('\/api\/appearance\/restore',\{versionAt:button\.dataset\.version\}\)/);
 assert.match(appearanceController,/refreshWithoutReload\(\)/);
});
