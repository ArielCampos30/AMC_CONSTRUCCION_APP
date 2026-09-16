import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('photo viewer is compact, preloads display media and never swaps visible quality',async()=>{
 const [source,styles,index,floatingChat]=await Promise.all([
  readFile(new URL('../public/media-viewer.js',import.meta.url),'utf8'),
  readFile(new URL('../public/media-viewer.css',import.meta.url),'utf8'),
  readFile(new URL('../public/index.html',import.meta.url),'utf8'),
  readFile(new URL('../public/floating-chat.js',import.meta.url),'utf8')
 ]);
 assert.match(index,/href="__AMC_ASSET_BASE__\/media-viewer\.css"/);
 assert.doesNotMatch(index,/href="\/media-viewer\.css"/);
 assert.doesNotMatch(source,/document\.createElement\('style'\)/);
 assert.match(styles,/\.amc-photo-viewer\{box-sizing:border-box;position:fixed;inset:3dvh 2vw;width:auto;max-width:1400px/);
 assert.match(styles,/background:rgba\(0,0,0,\.82\)/);
 assert.match(styles,/\.amc-photo-viewer::backdrop\{background:rgba\(0,0,0,\.56\)\}/);
 assert.match(styles,/@media\(max-width:560px\)\{\.amc-photo-viewer\{inset:9px 6px;width:auto;max-width:none/);
 assert.doesNotMatch(styles,/\.amc-photo-viewer\{[^}]*transform:/);
 assert.match(styles,/\.amc-photo-viewer\[open\]\{display:flex;flex-direction:column\}/);
 assert.match(styles,/\.amc-viewer-stage\{box-sizing:border-box;width:100%;min-width:0;min-height:0;flex:1/);
 assert.match(styles,/\.amc-viewer-frame\{position:relative;flex:0 0 auto;max-width:100%;max-height:100%/);
 assert.match(styles,/\.amc-viewer-frame\.amc-image-waiting\{opacity:0\}/);
 assert.match(styles,/\.amc-photo-viewer \.amc-viewer-image\{position:absolute;inset:0;display:block;width:100%;height:100%;object-fit:contain/);
 assert.doesNotMatch(styles,/amc-viewer-quality/);
 assert.match(styles,/\.amc-viewer-flight\{/);
 assert.doesNotMatch(styles,/!important/);
 assert.match(source,/const viewerCache=new Map\(\),VIEWER_CACHE_LIMIT=14/);
 assert.match(source,/url\.searchParams\.set\('view','1'\)/);
 assert.match(source,/fetch\(url,\{credentials:'same-origin'\}\)/);
 assert.match(source,/document\.addEventListener\('load'.*warmViewerLink/s);
 assert.match(source,/const viewerImg=new Image\(\);viewerImg\.className='amc-viewer-image'/);
 assert.doesNotMatch(source,/qualityImg/);
 assert.doesNotMatch(source,/Mejorando calidad/);
 assert.match(source,/frame\.style\.width=target\.width\+'px';frame\.style\.height=target\.height\+'px'/);
 assert.match(source,/flight=beginFlight\(preview,from,to,\{opening:true\}\)/);
 assert.match(source,/await removeFlight\(flight,\{fade:true\}\)/);
 assert.match(source,/currentLink\(\)\?\.focus\?\.\(\{preventScroll:true\}\)/);
 assert.match(floatingChat,/document\.querySelector\('\.amc-photo-viewer\[open\]'\)/);
 assert.doesNotMatch(floatingChat,/!important/);
});
