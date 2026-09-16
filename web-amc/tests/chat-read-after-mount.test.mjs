import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const view=readFileSync(new URL('../public/chat-view.js',import.meta.url),'utf8');
const features=readFileSync(new URL('../public/chat-features.js',import.meta.url),'utf8');

test('el viewport vuelve a evaluar lectura después de asentarse al final',()=>{
 assert.match(view,/const settled=\(\)=>\{bottom\(\);log\.dispatchEvent\(new Event\('scroll'\)\);\}/);
 assert.match(view,/new ResizeObserver\(settled\)/);
 assert.match(view,/requestAnimationFrame\(\(\)=>\{settled\(\)/);
 assert.match(features,/document\.addEventListener\('scroll',event=>\{if\(event\.target\.matches\?\.\('\.message-log'\)\)markRead\(\);\},\{capture:true,passive:true\}\)/);
 assert.match(features,/api\('\/api\/client-chat\/read',\{clientId:isAdmin\(\)\?contact\.id:undefined,lastMessageId:last\}\)/);
});
