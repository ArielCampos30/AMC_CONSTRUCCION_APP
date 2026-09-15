import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('photo viewer fits images and uses formal shared-transition presentation',async()=>{
 const [source,styles,index]=await Promise.all([
  readFile(new URL('../public/media-viewer.js',import.meta.url),'utf8'),
  readFile(new URL('../public/media-viewer.css',import.meta.url),'utf8'),
  readFile(new URL('../public/index.html',import.meta.url),'utf8')
 ]);
 assert.match(index,/href="\/media-viewer\.css"/);
 assert.doesNotMatch(source,/document\.createElement\('style'\)/);
 assert.match(styles,/\.amc-photo-viewer\{box-sizing:border-box/);
 assert.match(styles,/\.amc-viewer-stage\{box-sizing:border-box;width:100%;height:calc\(100dvh - 68px\)/);
 assert.match(styles,/\.amc-photo-viewer \.amc-viewer-image\{display:block;width:auto;height:auto/);
 assert.match(styles,/max-width:calc\(100vw - 24px\)/);
 assert.match(styles,/object-fit:contain/);
 assert.match(styles,/\.amc-viewer-flight\{/);
 assert.doesNotMatch(styles,/!important/);
 assert.match(source,/animateFlight\(preview,from,to,\{opening:true\}\)/);
 assert.match(source,/animateFlight\(src,from,to,\{opening:false\}\)/);
 assert.match(source,/fittedRect\(stage,ratio\)/);
});
