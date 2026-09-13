import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=name=>readFile(new URL('../'+name,import.meta.url),'utf8');

test('chat por cliente muestra feedback propio sólo cuando el envío realmente demora',async()=>{
 const [features,busy]=await Promise.all([
  source('public/chat-features.js'),
  source('public/amc-busy.js')
 ]);
 assert.match(features,/const PENDING_INDICATOR_DELAY=450/);
 assert.match(features,/item\.showSpinner=false;item\.spinnerTimer=setTimeout/);
 assert.match(features,/if\(!pending\.has\(item\.id\)\|\|item\.state!=='Enviando'\)return/);
 assert.match(features,/item\.showSpinner=true;paintPending\(item\)/);
 assert.match(features,/item\.state='Enviado';clearPendingIndicator\(item\);item\.showSpinner=false/);
 assert.match(busy,/function chatOwnsFeedback\(\)/);
 assert.match(busy,/#amc-chat-dialog\[open\] \.message-log/);
 assert.match(busy,/body\.full-chat-page \.message-log/);
 assert.match(busy,/\.message-form\[data-client\]\[data-sending="1"\]/);
 assert.match(busy,/if\(!count\|\|chatOwnsFeedback\(\)\|\|overlay\.open\)return/);
 assert.match(busy,/const MIN_VISIBLE=420/);
});
