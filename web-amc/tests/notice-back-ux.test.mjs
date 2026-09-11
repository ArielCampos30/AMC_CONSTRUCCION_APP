import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=name=>readFile(new URL('../'+name,import.meta.url),'utf8');

test('avisos internos no reciclan avisos viejos y duran tres segundos',async()=>{
 const notices=await source('public/notice-ui.js');
 assert.match(notices,/const LIVE_NOTICE_MS=3000/);
 assert.match(notices,/notices\(\)\.some\(n=>n\.id===notice\.id\)/);
 assert.match(notices,/notice\.read\|\|alreadyKnown/);
 assert.match(notices,/liveAlertTimer=setTimeout\(close,LIVE_NOTICE_MS\)/);
});

test('avisos transitorios normales duran tres segundos y borrar no muestra confirmación negra de éxito',async()=>{
 const runtime=await source('public/ux-runtime-fixes.js');
 assert.match(runtime,/const TRANSIENT_MS=3000/);
 assert.match(runtime,/borrad\[oa\]s\?/);
 assert.match(runtime,/toast\.classList\.remove\('show'\)/);
 assert.match(runtime,/\[data-maintenance-action="delete-notice"\]/);
 assert.match(runtime,/deletedNoticeIds\.add\(id\)/);
 assert.match(runtime,/await deleteNotice\(id\)/);
});

test('volver global no toca la portada pública ni intercepta el volver nativo',async()=>{
 const [runtime,index]=await Promise.all([source('public/ux-runtime-fixes.js'),source('public/index.html')]);
 assert.match(index,/ux-runtime-fixes\.js/);
 assert.match(runtime,/function authenticatedShell/);
 assert.match(runtime,/if\(!authenticatedShell\(\)\)\{existing\?\.remove\(\);return;\}/);
 assert.match(runtime,/new MutationObserver\(requestUiSync\)\.observe\(app,\{childList:true\}\)/);
 assert.doesNotMatch(runtime,/observe\(app,\{childList:true,subtree:true\}\)/);
 assert.match(runtime,/closest\?\.\('\[data-global-back\]'\)/);
 assert.doesNotMatch(runtime,/\[data-global-back\],\[data-action="back"\]/);
 assert.match(runtime,/function fallbackBackRoute/);
});
