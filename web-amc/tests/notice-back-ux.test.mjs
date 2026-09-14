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

test('avisos transitorios normales duran tres segundos y el patch UX queda dedicado a toasts',async()=>{
 const runtime=await source('public/ux-runtime-fixes.js');
 assert.match(runtime,/const TRANSIENT_MS=3000/);
 assert.match(runtime,/borrad\[oa\]s\?/);
 assert.match(runtime,/toast\.classList\.remove\('show'\)/);
 assert.doesNotMatch(runtime,/\[data-maintenance-action="delete-notice"\]/);
 assert.doesNotMatch(runtime,/deletedNoticeIds/);
 assert.doesNotMatch(runtime,/function deleteNotice/);
 assert.doesNotMatch(runtime,/data-global-back|fallbackBackRoute|routeStack|hashchange/);
});

test('el controlador de avisos preserva el contador global fuera de la bandeja',async()=>{
 const controller=await source('public/app-shell-notice-click-controller.js');
 assert.match(controller,/if\(!cards\.length&&currentRoute\(\)!=='avisos'\)return;/);
 assert.match(controller,/const unread=cards\.filter\(card=>card\.classList\?\.contains\('unread'\)\)\.length/);
});

test('volver global vive en su controlador, no toca portada y no se duplica con el volver propio',async()=>{
 const [controller,runtime,index]=await Promise.all([source('public/app-shell-back-controller.js'),source('public/ux-runtime-fixes.js'),source('public/index.html')]);
 assert.match(index,/app-shell-back-controller\.js/);
 assert.match(index,/app-shell-back-controller\.js[\s\S]*ux-runtime-fixes\.js/);
 assert.match(controller,/const authenticatedShell=/);
 assert.match(controller,/if\(!authenticatedShell\(\)\)\{existing\?\.remove\(\);return;\}/);
 assert.match(controller,/observer\?\.observe\(app,\{childList:true\}\)/);
 assert.doesNotMatch(controller,/subtree:true/);
 assert.match(controller,/closest\?\.\('\[data-global-back\]'\)/);
 assert.match(controller,/if\(main\.querySelector\('\[data-action="back"\]'\)\)return true;/);
 assert.match(controller,/if\(hasOwnBack\(main\)\)\{existing\?\.remove\(\);return;\}/);
 assert.match(controller,/if\(existing\)return;/);
 assert.match(controller,/function fallbackBackRoute/);
 assert.doesNotMatch(runtime,/data-global-back|fallbackBackRoute|routeStack|hashchange/);
});
