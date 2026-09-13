import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('rutas históricas y actuales de chat abren el chat flotante del cliente',async()=>{
 const [compat,index]=await Promise.all([
  source('public/chat-route-compat.js'),
  source('public/index.html')
 ]);
 assert.match(index,/chat-route-compat\.js[^]*app\.js/);
 assert.match(compat,/\(\?:chat\|chat-admin\|chat-user\|conversacion\)/);
 assert.match(compat,/AMCOpenChatRequest/);
 assert.match(compat,/chat-cliente/);
 assert.match(compat,/floating-chat-button/);
 assert.match(compat,/history\.replaceState\(null,'','#'\+target\.fallback\)/);
});

test('la navegación principal de cliente no conserva una sección Chat separada',async()=>{
 const compat=await source('public/chat-route-compat.js');
 assert.match(compat,/\[data-nav="chat-cliente"\]/);
 assert.match(compat,/\.bottom-nav a\[href="#chat-cliente"\]/);
 assert.match(compat,/node=>node\.remove\(\)/);
});
