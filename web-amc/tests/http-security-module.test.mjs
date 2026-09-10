import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {applyHttpSecurity} from '../http-security.mjs';

function response(){
 const headers=new Map();
 return {headers,setHeader(name,value){headers.set(name.toLowerCase(),value);}};
}

test('seguridad HTTP conserva las cabeceras y el CSP especial del cotizador',()=>{
 const root=response();
 applyHttpSecurity({res:root,origin:'https://amc.test',pathname:'/'});
 assert.equal(root.headers.get('strict-transport-security'),'max-age=31536000; includeSubDomains');
 assert.equal(root.headers.get('cache-control'),'no-store');
 assert.equal(root.headers.get('x-content-type-options'),'nosniff');
 assert.equal(root.headers.get('referrer-policy'),'same-origin');
 assert.equal(root.headers.get('x-frame-options'),'SAMEORIGIN');
 assert.equal(root.headers.get('cross-origin-opener-policy'),'same-origin-allow-popups');
 assert.equal(root.headers.get('cross-origin-resource-policy'),'same-origin');
 assert.match(root.headers.get('permissions-policy'),/microphone=\(\)/);
 assert.doesNotMatch(root.headers.get('content-security-policy'),/script-src[^;]*'unsafe-inline'/);

 const estimator=response();
 applyHttpSecurity({res:estimator,origin:'https://amc.test',pathname:'/presupuestos'});
 assert.match(estimator.headers.get('content-security-policy'),/script-src[^;]*'unsafe-inline'/);

 const local=response();
 applyHttpSecurity({res:local,origin:'http://localhost:4180',pathname:'/'});
 assert.equal(local.headers.has('strict-transport-security'),false);
});

test('server delega la política HTTP sin duplicar sus cabeceras',async()=>{
 const [server,module]=await Promise.all([
  readFile(new URL('../server.mjs',import.meta.url),'utf8'),
  readFile(new URL('../http-security.mjs',import.meta.url),'utf8')
 ]);
 assert.match(server,/from '.\/http-security\.mjs'/);
 assert.match(server,/applyHttpSecurity\(\{res,origin,pathname:p\}\)/);
 assert.doesNotMatch(server,/setHeader\('Content-Security-Policy'/);
 assert.match(module,/Strict-Transport-Security/);
 assert.match(module,/Content-Security-Policy/);
 assert.match(module,/pathname==='\/presupuestos'/);
});
