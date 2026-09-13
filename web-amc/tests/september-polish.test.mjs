import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');

test('la entrada recupera la animación visual AMC sin pantalla intermedia de texto',()=>{
 const html=read('../public/index.html'),css=read('../public/boot-loader.css');
 assert.match(html,/boot-loader\.css/);
 assert.match(html,/class="boot-amc-card"/);
 assert.match(html,/class="boot-amc-ring"/);
 assert.match(html,/class="boot-amc-dots"/);
 assert.doesNotMatch(html,/Cargando tus espacios/);
 assert.match(css,/amc-boot-turn/);
 assert.match(css,/amc-boot-dot/);
 assert.match(css,/amc-boot-pulse/);
});

test('un chat específico abierto se repinta cuando el polling trae mensajes nuevos',()=>{
 const chat=read('../public/chat-features.js');
 assert.match(chat,/document\.body\.classList\.contains\('full-chat-page'\)\)updateChat\(\)/);
 assert.match(chat,/function updateChat\(\)/);
 assert.match(chat,/markRead\(\);/);
 assert.match(chat,/onNoticesRead\(result\.noticeIds\|\|\[\]\)/);
});
