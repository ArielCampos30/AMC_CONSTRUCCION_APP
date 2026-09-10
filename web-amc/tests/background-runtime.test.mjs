import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {readFile} from 'node:fs/promises';
import {createBackgroundRuntime} from '../background-runtime.mjs';

const row={id:'delivery-1',deviceId:'device-1',kind:'web',device:'{"endpoint":"demo"}',userId:'user-1',body:'{"title":"Aviso"}',attempts:0};
const fakeDb=rows=>{
 const writes=[];let closed=0;
 const db={
  prepare(sql){
   if(sql.startsWith('SELECT delivery.*'))return {all:()=>rows};
   if(sql==='SELECT sound FROM users WHERE id=?')return {get:()=>({sound:1})};
   if(sql.startsWith("UPDATE delivery SET status='sent'"))return {run:id=>writes.push({kind:'sent',id})};
   if(sql.startsWith('UPDATE delivery SET attempts='))return {run:(attempts,status,nextAt,error,id)=>writes.push({kind:'retry',attempts,status,nextAt,error,id})};
   if(sql==='DELETE FROM devices WHERE id=?')return {run:id=>writes.push({kind:'delete',id})};
   throw new Error('SQL inesperado: '+sql);
  },
  close(){closed++;}
 };
 return {db,writes,closed:()=>closed};
};
const text=(value,max=200)=>String(value||'').slice(0,max);

test('flushPush conserva entrega y marcado enviado',async()=>{
 const state=fakeDb([row]);let delivered;
 const runtime=createBackgroundRuntime({db:state.db,keys:{publicKey:'demo'},text,deliver:async(...args)=>{delivered=args;}});
 await runtime.flushPush();
 assert.equal(delivered[0],'web');
 assert.deepEqual(delivered[1],{endpoint:'demo'});
 assert.deepEqual(delivered[2],{title:'Aviso'});
 assert.equal(delivered[4],true);
 assert.deepEqual(state.writes,[{kind:'sent',id:'delivery-1'}]);
});

test('flushPush conserva expiración y borrado de dispositivos gone',async()=>{
 const state=fakeDb([row]);
 const runtime=createBackgroundRuntime({db:state.db,keys:{},text,deliver:async()=>{throw Object.assign(new Error('gone'),{gone:true});}});
 await runtime.flushPush();
 assert.equal(state.writes[0].kind,'retry');
 assert.equal(state.writes[0].attempts,1);
 assert.equal(state.writes[0].status,'expired');
 assert.equal(state.writes[0].error,'gone');
 assert.deepEqual(state.writes[1],{kind:'delete',id:'device-1'});
});

test('attach conserva cierre de recursos del servidor',()=>{
 const state=fakeDb([]),server=new EventEmitter();
 const runtime=createBackgroundRuntime({db:state.db,keys:{},text,deliver:async()=>{}});
 runtime.attach({server,lifecycle:{run(){}},cleanupOrphanFiles:async()=>{}});
 server.emit('close');
 assert.equal(state.closed(),1);
});

test('server delega cola y temporizadores sin duplicarlos',async()=>{
 const server=await readFile(new URL('../server.mjs',import.meta.url),'utf8');
 assert.match(server,/from '.\/background-runtime\.mjs'/);
 assert.match(server,/createBackgroundRuntime\(\{db,keys,deliver,text\}\)/);
 assert.match(server,/background\.attach\(\{server,lifecycle,cleanupOrphanFiles\}\)/);
 assert.doesNotMatch(server,/let delivering=false/);
 assert.doesNotMatch(server,/setInterval\(\(\)=>flushPush/);
 assert.doesNotMatch(server,/const quoteTimer=setInterval/);
 assert.doesNotMatch(server,/const fileGcTimer=setInterval/);
});
