import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('photo viewer is compact, stable and keeps floating chat open',async()=>{
 const [source,styles,index,floatingChat]=await Promise.all([
  readFile(new URL('../public/media-viewer.js',import.meta.url),'utf8'),
  readFile(new URL('../public/media-viewer.css',import.meta.url),'utf8'),
  readFile(new URL('../public/index.html',import.meta.url),'utf8'),
  readFile(new URL('../public/floating-chat.js',import.meta.url),'utf8')
 ]);
 assert.match(index,/href="\/media-viewer\.css"/);
 assert.doesNotMatch(source,/document\.createElement\('style'\)/);
 assert.match(styles,/\.amc-photo-viewer\{box-sizing:border-box;width:min\(96vw,1400px\)/);
 assert.match(styles,/\.amc-photo-viewer\[open\]\{display:flex;flex-direction:column\}/);
 assert.match(styles,/\.amc-viewer-stage\{box-sizing:border-box;width:100%;min-width:0;min-height:0;flex:1/);
 assert.match(styles,/\.amc-photo-viewer \.amc-viewer-image\{display:block;width:auto;height:auto;max-width:100%;max-height:100%/);
 assert.match(styles,/@media\(max-width:560px\)\{\.amc-photo-viewer\{width:calc\(100vw - 12px\)/);
 assert.match(styles,/\.amc-viewer-flight\{/);
 assert.doesNotMatch(styles,/!important/);
 assert.match(source,/let openingStarted=false,openingPromise=Promise\.resolve\(\)/);
 assert.match(source,/if\(!animateFrom\|\|openingStarted\|\|token!==loadToken\)return openingPromise/);
 assert.match(source,/await revealOnce\(\);if\(token!==loadToken\)return;img\.src=source/);
 assert.match(source,/animateFlight\(preview,from,to,\{opening:true\}\)/);
 assert.match(source,/animateFlight\(src,from,to,\{opening:false\}\)/);
 assert.match(source,/currentLink\(\)\?\.focus\?\.\(\{preventScroll:true\}\)/);
 assert.match(floatingChat,/event\.target\?\.closest\?\.\('\.amc-photo-viewer'\)/);
 assert.doesNotMatch(floatingChat,/!important/);
});
