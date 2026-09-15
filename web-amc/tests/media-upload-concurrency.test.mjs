import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../server.mjs';

const origin='http://localhost:4180';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

test('original, miniatura y vista arrancan juntos en Object Storage sin romper dual-write',async()=>{
 const started=[],releases=[];
 const fileStore={
  mode:'mirror',writeEnabled:true,preferStorage:false,
  upload(id){started.push(id);return new Promise(resolve=>releases.push(()=>resolve(true)));},
  async download(){throw Object.assign(Error('unused'),{status:404});},
  async remove(){return 0;}
 };
 const app=createApp({dbPath:':memory:',origin,fileStore});
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+app.server.address().port;let cookie='',csrf='';
 try{
  let response=await fetch(base+'/api/register',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({email:'parallel-media@test.test',name:'Parallel Media',password:'Client-Test-2026!'})});
  const session=await response.json();cookie=response.headers.get('set-cookie').split(';')[0];csrf=session.csrf;
  const jpeg=Buffer.from([255,216,255,224,1,2,3,255,217]),thumb=Buffer.from([255,216,255,224,4,5,6,255,217]),viewer=Buffer.from([255,216,255,224,7,8,9,255,217]),form=new FormData();
  form.append('file',new Blob([jpeg],{type:'image/jpeg'}),'foto.jpg');form.append('thumbnail',new Blob([thumb],{type:'image/jpeg'}),'miniatura.jpg');form.append('viewer',new Blob([viewer],{type:'image/jpeg'}),'vista.jpg');
  const pending=fetch(base+'/api/upload',{method:'POST',headers:{Origin:origin,Cookie:cookie,'X-CSRF-Token':csrf},body:form});
  for(let i=0;i<100&&started.length<3;i++)await sleep(5);
  assert.equal(started.length,3,'los tres uploads deben iniciar antes de esperar que termine el primero');
  assert.equal(started.some(id=>id.endsWith('-thumb')),true);
  assert.equal(started.some(id=>id.endsWith('-view')),true);
  releases.splice(0).forEach(release=>release());
  response=await pending;const data=await response.json();assert.equal(response.status,201,JSON.stringify(data));
  assert.ok(app.db.prepare('SELECT id FROM files WHERE id=?').get(data.id));
  assert.ok(app.db.prepare('SELECT id FROM files WHERE id=?').get(data.id+'-thumb'));
  assert.ok(app.db.prepare('SELECT id FROM files WHERE id=?').get(data.id+'-view'));
 }finally{
  releases.splice(0).forEach(release=>release());
  await new Promise(resolve=>app.server.close(resolve));
 }
});
