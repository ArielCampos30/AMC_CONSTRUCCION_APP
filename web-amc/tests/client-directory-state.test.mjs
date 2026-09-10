import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {clientRows,createClientDirectory} from '../public/client-directory.js';

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

test('directorio carga los archivados bajo demanda y api state conserva un placeholder',async()=>{
 const state={user:{id:'admin-1',role:'admin',email:'admin@amc.test'},agendaClients:[{id:'u1',name:'Ana',hasAccount:1},{id:'u2',name:'Beto',hasAccount:1}],clients:[],requests:[],quotes:[],works:[],archivedClients:[]};
 let calls=0;
 const directory=createClientDirectory({getState:()=>state,esc:String,fetchArchivedClients:async()=>{calls++;return {archivedClients:['u1']};}});
 await directory.refreshArchived();
 directory.setFilter('Archivados');
 assert.deepEqual(directory.rows().map(item=>item.id),['u1']);
 directory.setFilter('Historial');
 assert.deepEqual(directory.rows().map(item=>item.id),['u2']);
 assert.equal(calls,1);
 const [directorySource,stateSource]=await Promise.all([
  readFile(new URL('../public/client-directory.js',import.meta.url),'utf8'),
  readFile(new URL('../state-routes.mjs',import.meta.url),'utf8')
 ]);
 assert.match(directorySource,/\/api\/admin\/clients\/archived/);
 assert.match(directorySource,/credentials:'same-origin'/);
 assert.match(stateSource,/archivedClients:\[\]/);
 assert.doesNotMatch(stateSource,/archivedClients:user\.role==='admin'\?all\('clientArchive'\)/);
});
