import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('filtros admin y chat se adaptan a pantallas angostas',async()=>{
  const [admin,float]=await Promise.all([
    readFile(new URL('../public/admin-v3.css',import.meta.url),'utf8'),
    readFile(new URL('../public/floating-chat.js',import.meta.url),'utf8')
  ]);
  assert.match(admin,/@media\(max-width:430px\)[\s\S]*\.admin-v3-chips\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(admin,/\.admin-v3-chips button\{width:100%;white-space:normal/);
  assert.doesNotMatch(float,/chat-photo-preview,#amc-chat-dialog \.chat-connection\{grid-column:1\/-1;grid-row:1/);
  assert.match(float,/@media\(max-width:560px\)[\s\S]*#amc-chat-dialog\{width:calc\(100vw - 12px\)/);
  assert.match(float,/height:min\(430px,58dvh\)/);
  assert.match(float,/max-height:58dvh/);
});
