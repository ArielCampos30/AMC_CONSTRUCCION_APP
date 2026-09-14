import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=name=>readFile(new URL('../public/'+name,import.meta.url),'utf8');

test('G-D separa sincronización push nativa del agregador móvil sin cambiar su contrato',async()=>{
 const [shell,pushRuntime,viewportRuntime,routeRuntime]=await Promise.all([
  source('app-mobile-runtime.js'),
  source('native-push-registration-runtime.js'),
  source('mobile-chat-viewport-runtime.js'),
  source('active-chat-route-runtime.js')
 ]);

 assert.equal(shell.trim(),[
  "import './active-chat-route-runtime.js';",
  "import './mobile-chat-viewport-runtime.js';",
  "import './native-push-registration-runtime.js';"
 ].join('\n'));
 assert.doesNotMatch(shell,/refreshPushToken|visualViewport|amc-keyboard-open|setActiveChatRoute/);

 assert.match(pushRuntime,/export function refreshNativePushRegistration\(\)/);
 assert.match(pushRuntime,/window\.AMCNative\?\.refreshPushToken\?\.\(\)/);
 assert.match(pushRuntime,/window\.addEventListener\('hashchange'/);
 assert.match(pushRuntime,/window\.addEventListener\('pageshow'/);
 assert.match(pushRuntime,/window\.addEventListener\('focus'/);
 assert.match(pushRuntime,/document\.addEventListener\('visibilitychange'/);
 assert.match(pushRuntime,/if\(!document\.hidden\)/);
 assert.match(pushRuntime,/setTimeout\(refreshNativePushRegistration,500\)/);
 assert.doesNotMatch(pushRuntime,/visualViewport|amc-keyboard-open|setActiveChatRoute|amcActiveChatRoute|!important/);
 assert.doesNotMatch(viewportRuntime,/refreshPushToken|AMCNative/);
 assert.doesNotMatch(routeRuntime,/refreshPushToken/);
});
