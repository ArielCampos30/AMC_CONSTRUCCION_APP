import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const PLAY='https://play.google.com/store/apps/details?id=com.amc.construcciones';

test('landing publica distribuye AMC por Google Play sin APK directo',()=>{
 const html=read('../../docs/index.html');
 assert.match(html,/id="app"/);
 assert.ok(html.includes(PLAY));
 assert.match(html,/Descargar en Google Play/);
 assert.match(html,/Usar versión web/);
 assert.doesNotMatch(html,/\.apk(?:["'?\s]|$)/i);
 assert.match(html,/assets\/css\/app-download\.css/);
});

test('inicio web ofrece instalacion oficial y la oculta dentro de la app nativa',()=>{
 const html=read('../public/index.html');
 const home=read('../public/home-ui.js');
 const runtime=read('../public/install-promo.js');
 assert.match(html,/install-promo\.css/);
 assert.match(html,/install-promo\.js/);
 assert.match(home,/data-amc-install-card/);
 assert.ok(home.includes(PLAY));
 assert.match(runtime,/globalThis\.AMCNative/);
 assert.match(runtime,/display-mode: standalone/);
 assert.ok(runtime.includes(PLAY));
 assert.match(runtime,/Agregar a pantalla de inicio/);
 assert.doesNotMatch(home,/\.apk(?:["'?\s]|$)/i);
});
