import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('la ruta activa del chat tiene ownership dedicado y conserva su contrato real',async()=>{
 const [routeRuntime,mobileRuntime,compat,notices,activity]=await Promise.all([
  source('public/active-chat-route-runtime.js'),
  source('public/mobile-runtime-fixes.js'),
  source('public/chat-route-compat.js'),
  source('public/notice-ui.js'),
  source('../app/src/main/java/com/amc/construcciones/MainActivity.java')
 ]);
 assert.match(mobileRuntime,/^import '\.\/active-chat-route-runtime\.js';/);
 assert.doesNotMatch(mobileRuntime,/function (?:pageChatRoute|floatingChatRoute|publishActiveChatRoute)|amcActiveChatRoute|setActiveChatRoute|amc-active-chat-change/);
 assert.match(routeRuntime,/^export function pageChatRoute\(\)/m);
 assert.match(routeRuntime,/^export function floatingChatRoute\(\)/m);
 assert.match(routeRuntime,/^export function publishActiveChatRoute\(\)/m);
 for(const route of ['chat-user','chat-admin','chat-equipo','chat'])assert.match(routeRuntime,new RegExp(route));
 assert.match(routeRuntime,/root\.dataset\.amcActiveChatRoute=route/);
 assert.match(routeRuntime,/delete root\.dataset\.amcActiveChatRoute/);
 assert.match(routeRuntime,/window\.AMCNative\?\.setActiveChatRoute\?\.\(route\)/);
 assert.match(routeRuntime,/new CustomEvent\('amc-active-chat-change',\{detail:\{route\}\}\)/);
 for(const event of ['pointerdown','click','close','focusin','hashchange','pageshow','focus','visibilitychange'])assert.match(routeRuntime,new RegExp("addEventListener\\('"+event+"'"));
 assert.match(routeRuntime,/new MutationObserver\(\(\)=>queueMicrotask\(publishActiveChatRoute\)\)/);
 assert.doesNotMatch(routeRuntime,/visualViewport|amc-keyboard-open|refreshPushToken|dismissComposerAfterSend/);
 assert.match(compat,/\(\?:chat\|chat-admin\|chat-user\|conversacion\)/);
 assert.match(compat,/AMCOpenChatRequest/);
 assert.match(notices,/document\.documentElement\?\.dataset\.amcActiveChatRoute/);
 assert.match(activity,/setActiveChatRoute\(String route\)/);
 assert.match(activity,/route\.startsWith\("\/#chat"\)/);
});
