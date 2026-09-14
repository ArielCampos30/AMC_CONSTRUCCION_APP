import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=name=>readFile(new URL('../public/'+name,import.meta.url),'utf8');

test('la presentación móvil del chat tiene ownership CSS formal sin !important',async()=>{
 const [runtime,styles,index,floating]=await Promise.all([
  source('mobile-runtime-fixes.js'),
  source('mobile-chat.css'),
  source('index.html'),
  source('floating-chat.js')
 ]);
 assert.match(index,/<link rel="stylesheet" href="\/mobile-chat\.css">/);
 assert.match(styles,/#amc-chat-dialog \.compact-composer/);
 assert.match(styles,/#amc-chat-dialog\.amc-keyboard-open/);
 assert.match(styles,/--amc-vv-top/);
 assert.match(styles,/--amc-vv-height/);
 assert.match(styles,/\.upload-state \.message-upload-spinner/);
 assert.doesNotMatch(styles,/!important/);
 assert.doesNotMatch(runtime,/createElement\(['"]style['"]\)|style\.textContent|document\.head\.append/);
 assert.match(runtime,/function pageChatRoute\(\)/);
 assert.match(runtime,/function floatingChatRoute\(\)/);
 assert.match(runtime,/window\.AMCNative\?\.setActiveChatRoute/);
 assert.match(runtime,/window\.visualViewport\?\.addEventListener\('resize'/);
 assert.match(runtime,/function refreshNativePushRegistration\(\)/);
 assert.match(runtime,/function dismissComposerAfterSend\(form\)/);
 assert.match(floating,/document\.addEventListener\('pointerdown',onOutsidePointerDown,true\)/);
});
