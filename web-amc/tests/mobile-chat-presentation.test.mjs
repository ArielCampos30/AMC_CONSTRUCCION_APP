import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=name=>readFile(new URL('../public/'+name,import.meta.url),'utf8');

test('la presentación móvil del chat tiene ownership CSS formal sin !important',async()=>{
 const [runtime,pushRuntime,viewportRuntime,routeRuntime,styles,index,floating]=await Promise.all([
  source('app-mobile-runtime.js'),
  source('native-push-registration-runtime.js'),
  source('mobile-chat-viewport-runtime.js'),
  source('active-chat-route-runtime.js'),
  source('mobile-chat.css'),
  source('index.html'),
  source('floating-chat.js')
 ]);
 assert.match(index,/<link rel="stylesheet" href="__AMC_ASSET_BASE__\/mobile-chat\.css">/);
 assert.doesNotMatch(index,/<link rel="stylesheet" href="\/mobile-chat\.css">/);
 assert.match(index,/__AMC_ASSET_BASE__\/app-mobile-runtime\.js/);
 assert.doesNotMatch(index,/mobile-runtime-fixes\.js/);
 assert.match(styles,/#amc-chat-dialog \.compact-composer/);
 assert.match(styles,/#amc-chat-dialog\.amc-keyboard-open/);
 assert.match(styles,/--amc-vv-top/);
 assert.match(styles,/--amc-vv-height/);
 assert.match(styles,/\.upload-state \.message-upload-spinner/);
 assert.doesNotMatch(styles,/!important/);
 assert.doesNotMatch(runtime,/createElement\(['"]style['"]\)|style\.textContent|document\.head\.append/);
 assert.match(runtime,/import '\.\/active-chat-route-runtime\.js'/);
 assert.match(runtime,/import '\.\/mobile-chat-viewport-runtime\.js'/);
 assert.match(runtime,/import '\.\/native-push-registration-runtime\.js'/);
 assert.match(routeRuntime,/function pageChatRoute\(\)/);
 assert.match(routeRuntime,/function floatingChatRoute\(\)/);
 assert.match(routeRuntime,/window\.AMCNative\?\.setActiveChatRoute/);
 assert.match(viewportRuntime,/window\.visualViewport\?\.addEventListener\('resize'/);
 assert.match(viewportRuntime,/function dismissComposerAfterSend\(form\)/);
 assert.match(pushRuntime,/function refreshNativePushRegistration\(\)/);
 assert.match(pushRuntime,/refreshPushToken/);
 assert.doesNotMatch(runtime,/window\.visualViewport|dismissComposerAfterSend|amc-keyboard-open|refreshPushToken/);
 assert.doesNotMatch(viewportRuntime,/refreshPushToken|AMCNative/);
 assert.doesNotMatch(pushRuntime,/visualViewport|amc-keyboard-open|setActiveChatRoute/);
 assert.match(floating,/document\.addEventListener\('pointerdown',onOutsidePointerDown,true\)/);
});
