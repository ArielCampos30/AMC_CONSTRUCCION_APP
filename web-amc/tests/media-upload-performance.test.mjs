import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('9.3D reduce payload multimedia y round-trips PostgreSQL sin cambiar el visor',async()=>{
 const [ui,storage,viewer,access]=await Promise.all([
  readFile(new URL('../public/media-upload-ui.js',import.meta.url),'utf8'),
  readFile(new URL('../media-storage.mjs',import.meta.url),'utf8'),
  readFile(new URL('../public/media-viewer.js',import.meta.url),'utf8'),
  readFile(new URL('../media-access.mjs',import.meta.url),'utf8')
 ]);
 assert.match(ui,/renderJpegVariant\(source,width,height,long,320,\.62\)/);
 assert.match(ui,/Promise\.all\(\[\s*outputPromise,\s*renderJpegVariant\(source,width,height,long,320,\.62\)/s);
 assert.doesNotMatch(ui,/renderJpegVariant\(source,width,height,long,1080/);
 assert.doesNotMatch(ui,/data\.append\('viewer'/);
 assert.match(ui,/viewerBytes:0/);
 assert.match(ui,/payloadBytes/);
 assert.match(storage,/const remoteDatabase=/);
 assert.match(storage,/SELECT coalesce\(sum\(length\(body\)\),0\) AS total, coalesce\(sum\(CASE WHEN owner=\? THEN length\(body\) ELSE 0 END\),0\) AS used FROM files/);
 assert.match(storage,/WITH inserted AS \(INSERT INTO files\(id,owner,mime,body\) VALUES \$\{values\} RETURNING id\)/);
 assert.match(storage,/WHERE EXISTS \(SELECT 1 FROM inserted\)/);
 assert.match(storage,/event:'media-upload-performance'/);
 assert.match(storage,/quotaMs,storageMs,dbMs,totalMs/);
 assert.match(access,/params\.has\('view'\)\?'view'/);
 assert.match(viewer,/url\.searchParams\.set\('view','1'\)/);
 assert.doesNotMatch(viewer,/Mejorando calidad/);
});
