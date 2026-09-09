import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('photo viewer always fits large images inside the visible viewport',async()=>{
 const source=await readFile(new URL('../public/media-viewer.js',import.meta.url),'utf8');
 assert.match(source,/\.amc-photo-viewer\{box-sizing:border-box/);
 assert.match(source,/\.amc-viewer-stage\{box-sizing:border-box;width:100%;height:calc\(100dvh - 64px\);min-width:0;min-height:0;padding:12px/);
 assert.match(source,/width:auto!important;height:auto!important/);
 assert.match(source,/max-width:calc\(100vw - 24px\)!important/);
 assert.match(source,/max-height:calc\(100dvh - 88px\)!important/);
 assert.match(source,/object-fit:contain/);
});
