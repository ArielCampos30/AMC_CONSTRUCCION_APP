import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createApp} from '../server.mjs';

const origin='http://localhost:4180';
function actor(base){return {cookie:'',csrf:'',async call(path,body,expected=200,method=body===undefined?'GET':'POST'){const response=await fetch(base+path,{method,headers:{Origin:origin,'Content-Type':'application/json',Cookie:this.cookie,'X-CSRF-Token':this.csrf},...(body===undefined?{}:{body:JSON.stringify(body)})});assert.equal(response.status,expected,`${method} ${path}`);const setCookie=response.headers.get('set-cookie');if(setCookie)this.cookie=setCookie.split(';')[0];const data=await response.json();if(data.csrf)this.csrf=data.csrf;return data;}};}

test('notas offline históricas dejan de consultarse en el estado general sin borrarse',async()=>{
 const app=createApp({dbPath:':memory:',origin});
 const admin=app.addUser('owner-offline-state@amc.test','Strong-Owner-2026!','AMC','admin');
 const note={id:'offline-note-state-test',assignmentId:'assignment-test',title:'Nota histórica',text:'Contenido guardado',photos:[],date:'2026-09-10T12:00:00.000Z'};
 app.db.prepare('INSERT INTO docs(id,kind,owner,body) VALUES(?,?,?,?)').run(note.id,'offlineNote',admin.id,JSON.stringify(note));
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+app.server.address().port;
 try{
  const session=actor(base);
  await session.call('/api/login',{email:admin.email,password:'Strong-Owner-2026!'});
  const state=await session.call('/api/state');
  assert.deepEqual(state.offlineNotes,[]);
  const stored=app.db.prepare("SELECT id FROM docs WHERE id=? AND kind='offlineNote'").get(note.id);
  assert.equal(stored.id,note.id);
 }finally{await new Promise(resolve=>app.server.close(resolve));}
});

test('el router conserva el contrato vacío sin consultar offlineNote',async()=>{
 const source=await readFile(new URL('../state-routes.mjs',import.meta.url),'utf8');
 assert.match(source,/offlineNotes:\[\]/);
 assert.doesNotMatch(source,/offlineNotes:user\.role==='admin'\?all\('offlineNote'/);
});
