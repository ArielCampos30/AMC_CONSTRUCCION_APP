import test from 'node:test';
import assert from 'node:assert/strict';
import {access,readFile} from 'node:fs/promises';

const publicUrl=name=>new URL('../public/'+name,import.meta.url);

test('8.8H usa un entrypoint móvil formal y retira el nombre legacy',async()=>{
 const [entrypoint,index]=await Promise.all([
  readFile(publicUrl('app-mobile-runtime.js'),'utf8'),
  readFile(publicUrl('index.html'),'utf8')
 ]);
 assert.equal(entrypoint.trim(),[
  "import './active-chat-route-runtime.js';",
  "import './mobile-chat-viewport-runtime.js';",
  "import './native-push-registration-runtime.js';"
 ].join('\n'));
 assert.match(index,/type="module" src="\/app-mobile-runtime\.js"/);
 assert.doesNotMatch(index,/mobile-runtime-fixes\.js/);
 await assert.rejects(access(publicUrl('mobile-runtime-fixes.js')));
 assert.doesNotMatch(entrypoint,/function\s|addEventListener|AMCNative|visualViewport|MutationObserver|setTimeout/);
});
