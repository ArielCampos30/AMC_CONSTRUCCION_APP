import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('admin More exposes Portada pública',async()=>{
 const [index,extras]=await Promise.all([
  readFile(new URL('../public/index.html',import.meta.url),'utf8'),
  readFile(new URL('../public/admin-menu-extras.js',import.meta.url),'utf8')
 ]);
 assert.match(index,/admin-menu-extras\.js/);
 assert.match(extras,/href='#portada'/);
 assert.match(extras,/Portada pública/);
 assert.match(extras,/Herramientas/);
});
