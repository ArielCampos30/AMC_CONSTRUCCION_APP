import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {quoteLifecycle} from '../quote-lifecycle.mjs';

const source=name=>readFile(new URL('../'+name,import.meta.url),'utf8');

test('estado agrupa lecturas remotas y chat reutiliza el snapshot',async()=>{
 const [database,chat,auth,state,server]=await Promise.all([
  source('database-core.mjs'),
  source('chat-core.mjs'),
  source('auth-routes.mjs'),
  source('state-routes.mjs'),
  source('server.mjs')
 ]);
 assert.match(database,/UNION ALL SELECT 'user'/);
 assert.match(database,/const allEntries=/);
 assert.match(database,/const activeUsers=/);
 assert.match(database,/const docPosition=/);
 assert.match(state,/const snapshot=!!user/);
 assert.match(state,/lifecycle\.run\(\{throttle:true\}\)/);
 assert.match(chat,/const messagePosition=id=>id\?docPosition\(id\):0/);
 assert.match(chat,/allEntries\('chatRead'\)/);
 assert.match(chat,/activeUsers\('client'\)/);
 assert.doesNotMatch(chat,/SELECT rowid FROM docs WHERE id=/);
 assert.doesNotMatch(chat,/SELECT owner,body FROM docs WHERE kind='chatRead'/);
 assert.doesNotMatch(chat,/SELECT owner,body FROM docs WHERE kind='clientChatRead'/);
 assert.doesNotMatch(chat,/SELECT id FROM users WHERE role='client'/);
 assert.match(auth,/FROM sessions s JOIN users u ON u\.id=s\.userId/);
 assert.match(server,/chatFeatures\(\{db,all,allEntries,activeUsers,docPosition/);
 assert.match(server,/stateRoutes\(\{all,activeUsers/);
 assert.match(server,/twoFactor,lifecycle,beginStateSnapshot/);
});

test('sondeo de estado limita vencimientos pero ejecución explícita sigue inmediata',()=>{
 let clock=100000,reads=0;
 const lifecycle=quoteLifecycle({
  all:()=>{reads++;return [];},
  put:()=>{},transaction:fn=>fn(),notify:()=>{},notifyAdmins:()=>{},clock:()=>clock
 });
 const afterInit=reads;
 lifecycle.run({throttle:true});
 assert.equal(reads,afterInit+1);
 lifecycle.run({throttle:true});
 assert.equal(reads,afterInit+1);
 lifecycle.run();
 assert.equal(reads,afterInit+2);
 clock+=60000;
 lifecycle.run({throttle:true});
 assert.equal(reads,afterInit+3);
});
