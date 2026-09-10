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
  assert.match(float,/@media\(max-width:560px\)[\s\S]*#amc-chat-dialog\{width:calc\(100vw - 24px\)/);
  assert.match(float,/height:min\(430px,58dvh\)/);
  assert.match(float,/max-height:58dvh/);
});


test('móvil compacto no agrega huecos innecesarios ni mueve el fondo al abrir chat',async()=>{
  const [styles,chatView,app,features,media]=await Promise.all([
    readFile(new URL('../public/styles.css',import.meta.url),'utf8'),
    readFile(new URL('../public/chat-view.js',import.meta.url),'utf8'),
    readFile(new URL('../public/app.js',import.meta.url),'utf8'),
    readFile(new URL('../public/features-ui.js',import.meta.url),'utf8'),
    readFile(new URL('../public/media-upload-ui.js',import.meta.url),'utf8')
  ]);
  assert.match(styles,/@media\(max-width:850px\)[\s\S]*header\{height:62px;padding:0 16px/);
  assert.match(styles,/@media\(max-width:560px\)\{main\{padding:12px 14px 92px/);
  assert.match(chatView,/opening&&!log\.closest\('#amc-chat-dialog'\)/);
  assert.match(media,/async function decodeImageSource\(file\)/);
  assert.match(media,/if\(thumbnail\?\.size\)data\.append\('thumbnail'/);
  assert.match(media,/decodeFallback:true/);
  assert.match(app,/from '.\/media-upload-ui\.js'/);
  assert.match(app,/function upload\(file,onProgress,showBusy=true\)\{return mediaUpload\.upload/);
  assert.match(features,/if\(preview\)preview\.hidden=true/);
  assert.match(features,/releasePending\(item\);if\(preview\)preview\.hidden=false/);
  assert.match(features,/No pudimos preparar esta foto/);
});
