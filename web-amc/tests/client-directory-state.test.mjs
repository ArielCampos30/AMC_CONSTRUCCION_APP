import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {clientRows} from '../public/client-directory.js';

test('directorio Admin funciona con agendaClients aunque clients quede vacío',async()=>{
 const state={
  agendaClients:[{id:'u1',name:'Cuenta',hasAccount:1},{id:'lead1',name:'Lead',hasAccount:0}],
  clients:[],requests:[],quotes:[],works:[],archivedClients:[]
 };
 assert.deepEqual(clientRows(state).map(c=>c.id),['u1','lead1']);
 const source=await readFile(new URL('../public/client-directory.js',import.meta.url),'utf8');
 assert.match(source,/state\.agendaClients\|\|state\.clients\|\|\[\]/);
 assert.match(source,/some\(c=>c\.hasAccount!==0\)/);
 assert.doesNotMatch(source,/getState\(\)\.clients\?\.length/);
});
