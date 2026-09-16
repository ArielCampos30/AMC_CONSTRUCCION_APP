import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {resolveServerRuntime,validateServerRuntime,startServer,scheduleFileStorageMigration} from '../server-bootstrap.mjs';

const root=path.join(path.sep,'tmp','amc');

test('server bootstrap resolves demo runtime without production side effects',()=>{
 const runtime=resolveServerRuntime({argv:['node','server.mjs','--demo'],env:{PORT:'4321'},root});
 assert.deepEqual(runtime,{demo:true,port:4321,origin:'http://localhost:4321',dbPath:path.join(root,'data','demo.sqlite'),host:'127.0.0.1'});
 assert.equal(validateServerRuntime(runtime,{env:{PORT:'4321'}}),null);
});

test('server bootstrap keeps production HTTPS and Render database guards',()=>{
 const local=resolveServerRuntime({argv:['node','server.mjs'],env:{PORT:'4180'},root});
 assert.match(validateServerRuntime(local,{env:{PORT:'4180'}}),/AMC_ORIGIN=https:\/\/tu-dominio/);
 const render=resolveServerRuntime({argv:['node','server.mjs'],env:{PORT:'10000',RENDER:'true',RENDER_EXTERNAL_URL:'https://amc.example'},root});
 assert.match(validateServerRuntime(render,{env:{PORT:'10000',RENDER:'true',RENDER_EXTERNAL_URL:'https://amc.example'}}),/AMC_DATABASE_URL/);
 const healthy=resolveServerRuntime({argv:['node','server.mjs'],env:{PORT:'10000',RENDER:'true',RENDER_EXTERNAL_URL:'https://amc.example',AMC_DATABASE_URL:'postgres://example'},root});
 assert.equal(validateServerRuntime(healthy,{env:{PORT:'10000',RENDER:'true',RENDER_EXTERNAL_URL:'https://amc.example',AMC_DATABASE_URL:'postgres://example'}}),null);
 assert.equal(healthy.host,'0.0.0.0');
});

test('startServer forwards the resolved runtime and preserves listen contract',()=>{
 const calls=[];
 const logs=[];
 const server={listen(...args){calls.push(args);const cb=args.at(-1);cb();}};
 const app={server};
 const createApp=options=>{calls.push(options);return app;};
 const result=startServer({createApp,root,argv:['node','server.mjs','--demo'],env:{PORT:'4555'},consoleRef:{log:value=>logs.push(value),info:value=>logs.push(value),error:value=>logs.push(value)},processRef:{exit(){assert.fail('demo runtime must not exit');}}});
 assert.equal(result,app);
 assert.deepEqual(calls[0],{demo:true,origin:'http://localhost:4555',dbPath:path.join(root,'data','demo.sqlite')});
 assert.equal(calls[1][0],4555);
 assert.equal(calls[1][1],'127.0.0.1');
 assert.equal(logs[0],'AMC conectado: http://localhost:4555 · entorno de prueba, cuentas de ejemplo');
});

test('historical storage migration is strictly opt-in and reports a safe completion summary',async()=>{
 const logs=[],tasks=[],db={prepare(){}};
 const consoleRef={info:value=>logs.push(value),error:value=>logs.push(value)};
 const fileStoreFactory=({env})=>({mode:env.AMC_FILE_STORAGE_MODE,writeEnabled:true});
 const migrate=async({db:receivedDb,objectStore})=>{
  assert.equal(receivedDb,db);
  assert.equal(objectStore.mode,'mirror');
  return {total:95,bytes:13378218,alreadyPresent:74,migrated:21,repaired:0,verified:95,durationMs:123};
 };
 assert.equal(scheduleFileStorageMigration({env:{AMC_FILE_STORAGE_MODE:'mirror'},db,consoleRef,queue:task=>tasks.push(task),fileStoreFactory,migrate}),false);
 assert.equal(tasks.length,0);
 assert.equal(scheduleFileStorageMigration({env:{AMC_FILE_STORAGE_MODE:'mirror',AMC_FILE_STORAGE_MIGRATE_ON_START:'1'},db,consoleRef,queue:task=>tasks.push(task),fileStoreFactory,migrate}),true);
 assert.equal(tasks.length,1);
 await tasks[0]();
 assert.equal(JSON.parse(logs[0]).event,'file-storage-migration-start');
 const complete=JSON.parse(logs[1]);
 assert.equal(complete.event,'file-storage-migration-complete');
 assert.equal(complete.verified,95);
 assert.equal(complete.migrated,21);
});
