import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createApp} from '../server.mjs';

test('production security headers, cookies and origin checks are enforced',async()=>{
 const origin='https://amc-security.test',app=createApp({dbPath:':memory:',origin});app.addUser('owner-security@amc.test','Strong-Owner-2026!','AMC','admin');await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;
 try{
  const root=await fetch(base+'/');assert.equal(root.status,200);assert.ok(root.headers.get('x-request-id'));const csp=root.headers.get('content-security-policy')||'';assert.match(csp,/default-src 'self'/);assert.match(csp,/object-src 'none'/);assert.match(csp,/frame-ancestors 'self'/);assert.doesNotMatch(csp,/script-src[^;]*'unsafe-inline'/);assert.equal(root.headers.get('x-content-type-options'),'nosniff');assert.equal(root.headers.get('referrer-policy'),'same-origin');assert.equal(root.headers.get('cross-origin-resource-policy'),'same-origin');assert.match(root.headers.get('permissions-policy')||'',/microphone=\(\)/);
  const weak=await fetch(base+'/api/register',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({email:'weak@amc.test',name:'Clave débil',password:'12345678'})});assert.equal(weak.status,400);
  const login=await fetch(base+'/api/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({email:'owner-security@amc.test',password:'Strong-Owner-2026!'})});assert.equal(login.status,200);const session=await login.json(),cookie=(login.headers.get('set-cookie')||'').split(';')[0],setCookie=login.headers.get('set-cookie')||'';assert.match(setCookie,/HttpOnly/i);assert.match(setCookie,/SameSite=Strict/i);assert.match(setCookie,/Secure/i);
  const estimator=await fetch(base+'/presupuestos',{headers:{Cookie:cookie}});assert.equal(estimator.status,200);assert.match(estimator.headers.get('content-security-policy')||'',/script-src[^;]*'unsafe-inline'/);
  const badOrigin=await fetch(base+'/api/profile',{method:'POST',headers:{Origin:'https://evil.example','Content-Type':'application/json',Cookie:cookie,'X-CSRF-Token':session.csrf},body:JSON.stringify({name:'AMC'})});assert.equal(badOrigin.status,403);
  const logout=await fetch(base+'/api/logout',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie,'X-CSRF-Token':session.csrf},body:'{}'});assert.equal(logout.status,200);assert.match(logout.headers.get('set-cookie')||'',/Secure/i);
 }finally{await new Promise(r=>app.server.close(r));}
});

test('security hardening keeps account throttling and a bounded session count in source',async()=>{
 const [source,auth]=await Promise.all([
  readFile(new URL('../server.mjs',import.meta.url),'utf8'),
  readFile(new URL('../auth-routes.mjs',import.meta.url),'utf8')
 ]);
 assert.match(auth,/login-account:/);
 assert.match(auth,/checkRate\(accountRate,12\)/);
 assert.match(auth,/sessions\.slice\(8\)/);
 assert.match(source,/weakPasswords/);
 assert.match(source,/snapshotAll=user\?\.role==='admin'/);
 assert.match(source,/X-Request-ID/);
 assert.match(source,/durationMs/);
 assert.match(source,/systemStatus/);
 assert.match(source,/RENDER_GIT_COMMIT/);
});
