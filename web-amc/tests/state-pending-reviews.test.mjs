import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createApp} from '../server.mjs';

const origin='http://localhost:4180';
function actor(base){return {cookie:'',csrf:'',async call(path,body,expected=200,method=body===undefined?'GET':'POST'){const response=await fetch(base+path,{method,headers:{Origin:origin,'Content-Type':'application/json',Cookie:this.cookie,'X-CSRF-Token':this.csrf},...(body===undefined?{}:{body:JSON.stringify(body)})});assert.equal(response.status,expected,`${method} ${path}`);const setCookie=response.headers.get('set-cookie');if(setCookie)this.cookie=setCookie.split(';')[0];const data=await response.json();if(data.csrf)this.csrf=data.csrf;return data;}};}

test('reseñas pendientes salen del estado general y quedan disponibles sólo para admin',async()=>{
 const app=createApp({dbPath:':memory:',origin});
 const adminUser=app.addUser('owner-pending-review@amc.test','Strong-Owner-2026!','AMC','admin');
 const clientUser=app.addUser('client-pending-review@amc.test','Strong-Client-2026!','Cliente','client');
 const review={id:'review-lazy-test',userId:clientUser.id,name:'Cliente',rating:5,text:'Excelente trabajo de prueba',date:'2026-09-10T12:00:00.000Z',approved:false};
 app.db.prepare('INSERT INTO docs(id,kind,owner,body) VALUES(?,?,?,?)').run(review.id,'review',clientUser.id,JSON.stringify(review));
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+app.server.address().port;
 try{
  const admin=actor(base),client=actor(base);
  await admin.call('/api/login',{email:adminUser.email,password:'Strong-Owner-2026!'});
  const state=await admin.call('/api/state');
  assert.deepEqual(state.pendingReviews,[]);
  const pending=await admin.call('/api/reviews/pending');
  assert.equal(pending.pendingReviews.length,1);
  assert.equal(pending.pendingReviews[0].id,review.id);
  assert.equal(pending.pendingReviews[0].approved,false);

  await client.call('/api/login',{email:clientUser.email,password:'Strong-Client-2026!'});
  assert.equal((await client.call('/api/reviews/pending',undefined,403)).error,'Acceso restringido.');
 }finally{await new Promise(resolve=>app.server.close(resolve));}
});

test('la carga diferida queda separada entre router y UI',async()=>{
 const [stateRoutes,communityRoutes,ui]=await Promise.all([
  readFile(new URL('../state-routes.mjs',import.meta.url),'utf8'),
  readFile(new URL('../community-routes.mjs',import.meta.url),'utf8'),
  readFile(new URL('../public/community-ui.js',import.meta.url),'utf8')
 ]);
 assert.match(stateRoutes,/pendingReviews:\[\]/);
 assert.doesNotMatch(stateRoutes,/pendingReviews:user\.role==='admin'\?all\('review'\)/);
 assert.match(communityRoutes,/p==='\/api\/reviews\/pending'/);
 assert.match(communityRoutes,/requireAdmin\(user\)/);
 assert.match(ui,/fetch\('\/api\/reviews\/pending'/);
 assert.doesNotMatch(ui,/state\.pendingReviews/);
});
