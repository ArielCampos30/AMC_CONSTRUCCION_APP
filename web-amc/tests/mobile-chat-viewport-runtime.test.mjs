import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=name=>readFile(new URL('../public/'+name,import.meta.url),'utf8');

test('G-C separa viewport/teclado de push nativo sin cambiar el contrato móvil',async()=>{
 const [shell,viewport,styles]=await Promise.all([
  source('mobile-runtime-fixes.js'),
  source('mobile-chat-viewport-runtime.js'),
  source('mobile-chat.css')
 ]);
 assert.match(shell,/import '\.\/active-chat-route-runtime\.js'/);
 assert.match(shell,/import '\.\/mobile-chat-viewport-runtime\.js'/);
 assert.match(shell,/function refreshNativePushRegistration\(\)/);
 assert.match(shell,/refreshPushToken/);
 assert.doesNotMatch(shell,/visualViewport|amc-keyboard-open|--amc-vv-top|--amc-vv-height|dismissComposerAfterSend/);

 assert.match(viewport,/let mobileViewportBaseline=Math\.max\(window\.visualViewport\?\.height/);
 assert.match(viewport,/mobileViewportBaseline-currentHeight>110/);
 assert.match(viewport,/dialog\.classList\.toggle\('amc-keyboard-open',keyboardOpen\)/);
 assert.match(viewport,/--amc-vv-top/);
 assert.match(viewport,/--amc-vv-height/);
 assert.match(viewport,/window\.visualViewport\?\.addEventListener\('resize'/);
 assert.match(viewport,/window\.visualViewport\?\.addEventListener\('scroll'/);
 assert.match(viewport,/window\.addEventListener\('orientationchange'/);
 assert.match(viewport,/window\.addEventListener\('pageshow'/);
 assert.match(viewport,/document\.addEventListener\('focusin'/);
 assert.match(viewport,/document\.addEventListener\('focusout'/);
 assert.match(viewport,/export function dismissComposerAfterSend\(form\)/);
 assert.match(viewport,/textarea\.blur\(\)/);
 assert.match(viewport,/attributeFilter:\['disabled'\]/);
 assert.doesNotMatch(viewport,/refreshPushToken|AMCNative|amcActiveChatRoute|setActiveChatRoute/);
 assert.doesNotMatch(viewport,/!important|createElement\(['"]style['"]\)|style\.textContent|document\.head\.append/);

 assert.match(styles,/#amc-chat-dialog\.amc-keyboard-open/);
 assert.match(styles,/--amc-vv-top/);
 assert.match(styles,/--amc-vv-height/);
 assert.doesNotMatch(styles,/!important/);
});
