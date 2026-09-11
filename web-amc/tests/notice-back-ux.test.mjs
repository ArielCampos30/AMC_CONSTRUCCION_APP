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

test('avisos transitorios generales duran tres segundos',async()=>{
 const runtime=await source('public/ux-runtime-fixes.js');
 assert.match(runtime,/const TRANSIENT_MS=3000/);
 assert.match(runtime,/toast\.classList\.remove\('show'\)/);
});

test('todas las pantallas secundarias reciben volver sin duplicarlo',async()=>{
 const [runtime,index]=await Promise.all([source('public/ux-runtime-fixes.js'),source('public/index.html')]);
 assert.match(index,/ux-runtime-fixes\.js/);
 assert.match(runtime,/data-global-back/);
 assert.match(runtime,/data-action="back"/);
 assert.match(runtime,/function fallbackBackRoute/);
 assert.match(runtime,/if\(route===home\)/);
 assert.match(runtime,/if\(hasOwnBack\(main\)\)return/);
});
