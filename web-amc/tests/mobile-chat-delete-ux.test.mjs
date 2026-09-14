import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=name=>readFile(new URL('../'+name,import.meta.url),'utf8');

test('chat móvil sólo se expande cuando el teclado reduce realmente el viewport',async()=>{
 const viewport=await source('public/mobile-chat-viewport-runtime.js');
 assert.match(viewport,/mobileViewportBaseline-currentHeight>110/);
 assert.doesNotMatch(viewport,/keyboardOpen=focused&&narrow;/);
 assert.match(viewport,/dialog\.classList\.toggle\('amc-keyboard-open',keyboardOpen\)/);
});

test('enviar desde chat flotante móvil cierra el teclado y no lo reabre al terminar',async()=>{
 const viewport=await source('public/mobile-chat-viewport-runtime.js');
 assert.match(viewport,/function dismissComposerAfterSend\(form\)/);
 assert.match(viewport,/textarea\.blur\(\)/);
 assert.match(viewport,/MutationObserver/);
 assert.match(viewport,/attributeFilter:\['disabled'\]/);
});

test('estado de envío muestra icono sin porcentaje',async()=>{
 const [mobileStyles,features]=await Promise.all([source('public/mobile-chat.css'),source('public/chat-features.js')]);
 assert.match(features,/message-upload-spinner/);
 assert.match(mobileStyles,/\.upload-state\s*>\s*span:not\(\.message-upload-spinner\)\s*\{\s*display:\s*none/);
 assert.match(mobileStyles,/\.upload-state \.message-upload-spinner\s*\{\s*display:\s*inline-block/);
});

test('avisos, presupuestos y apariencia conservan respuestas optimistas sin refrescar toda la pantalla',async()=>{
 const [noticeController,quoteController,appearanceController,index]=await Promise.all([
  source('public/app-shell-notice-click-controller.js'),
  source('public/app-admin-quote-maintenance-controller.js'),
  source('public/app-admin-appearance-controller.js'),
  source('public/index.html')
 ]);
 assert.match(noticeController,/const deleteNotice=async\(button,event\)=>/);
 assert.match(noticeController,/const deleteScope=async\(button,event,scope\)=>/);
 assert.match(noticeController,/card\?\.remove\(\)/);
 assert.match(noticeController,/await api\('\/api\/notices\/read',\{deleteId:id\}\)/);
 assert.match(noticeController,/await api\('\/api\/notices\/read',\{deleteScope:scope\}\)/);
 assert.match(noticeController,/parent\.insertBefore\(card/);
 assert.match(quoteController,/const detachCard=button=>/);
 assert.match(quoteController,/await api\('\/api\/quotes\/'\+encodeURIComponent\(button\.dataset\.id\)\+'\/archive',\{\}\)/);
 assert.match(quoteController,/await api\('\/api\/quotes\/'\+encodeURIComponent\(button\.dataset\.id\)\+'\/unarchive',\{\}\)/);
 assert.match(quoteController,/await api\('\/api\/quotes\/'\+encodeURIComponent\(button\.dataset\.id\)\+'\/delete',\{\}\)/);
 assert.match(quoteController,/parent\.insertBefore\(card/);
 assert.match(appearanceController,/action!=='restore-appearance'/);
 assert.match(appearanceController,/await api\('\/api\/appearance\/restore',\{versionAt:button\.dataset\.version\}\)/);
 assert.match(appearanceController,/refreshWithoutReload\(\)/);
 assert.doesNotMatch(index,/admin-maintenance-ui\.js/);
});
