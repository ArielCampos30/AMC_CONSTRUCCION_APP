import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('admin More exposes one canonical Portada pública entry',async()=>{
 const [index,system,extras]=await Promise.all([
  readFile(new URL('../public/index.html',import.meta.url),'utf8'),
  readFile(new URL('../public/admin-system-ui.js',import.meta.url),'utf8'),
  readFile(new URL('../public/admin-menu-extras.js',import.meta.url),'utf8')
 ]);
 assert.match(index,/admin-menu-extras\.js/);
 assert.match(system,/\['Sitio público',\[\['portada','Portada pública'\]\]\]/);
 assert.match(extras,/a\[href="#portada"\]/);
 assert.match(extras,/links\.slice\(1\)\.forEach\(link=>link\.remove\(\)\)/);
 assert.doesNotMatch(extras,/createElement\(['"]a['"]\)/);
 assert.doesNotMatch(extras,/append\(link\)/);
});
