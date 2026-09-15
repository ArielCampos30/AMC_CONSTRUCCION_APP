import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {resolveServerRuntime,validateServerRuntime,startServer} from '../server-bootstrap.mjs';

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
 const result=startServer({createApp,root,argv:['node','server.mjs','--demo'],env:{PORT:'4555'},consoleRef:{log:value=>logs.push(value),error:value=>logs.push(value)},processRef:{exit(){assert.fail('demo runtime must not exit');}}});
 assert.equal(result,app);
 assert.deepEqual(calls[0],{demo:true,origin:'http://localhost:4555',dbPath:path.join(root,'data','demo.sqlite')});
 assert.equal(calls[1][0],4555);
 assert.equal(calls[1][1],'127.0.0.1');
 assert.equal(logs[0],'AMC conectado: http://localhost:4555 · entorno de prueba, cuentas de ejemplo');
});
