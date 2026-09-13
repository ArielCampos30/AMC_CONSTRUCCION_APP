import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');

test('la entrada usa la intro histórica AMC sin superponer el cargador nuevo',()=>{
 const html=read('../public/index.html'),css=read('../public/welcome.css'),js=read('../public/welcome.js');
 assert.match(html,/welcome\.css/);
 assert.match(html,/id="boot-loader" hidden/);
 assert.doesNotMatch(html,/class="boot-amc-card"/);
 assert.doesNotMatch(html,/boot-loader\.css/);
 assert.match(css,/\.amc-intro/);
 assert.match(css,/amc-arrive/);
 assert.match(css,/intro-line/);
 assert.match(js,/intro-mark/);
 assert.match(js,/CONSTRUCCIONES Y ARREGLOS/);
 assert.match(js,/Tu casa, en buenas manos\./);
});

test('el chat visible usa un historial permanente por usuario cliente',()=>{
 const chat=read('../public/chat-features.js'),model=read('../public/chat-client-thread.js');
 assert.match(chat,/clientChatUnread/);
 assert.match(chat,/\/api\/client-chat\/messages/);
 assert.match(chat,/\/api\/client-chat\/read/);
 assert.match(chat,/Una conversación por cliente/);
 assert.doesNotMatch(chat,/message-project-context/);
 assert.match(model,/message\.clientId\|\|message\.userId/);
});
