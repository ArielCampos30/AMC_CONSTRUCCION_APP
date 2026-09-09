import test from 'node:test';import assert from 'node:assert/strict';import {createApp} from '../server.mjs';
const origin='http://localhost:4180';
test('multipart image upload stores binary and thumbnail while legacy JSON remains compatible',async()=>{const app=createApp({dbPath:':memory:',origin});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;let cookie='',csrf='';try{let r=await fetch(base+'/api/register',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({email:'media@test.test',name:'Media',password:'Client-Test-2026!'})});let data=await r.json();assert.equal(r.status,200);cookie=r.headers.get('set-cookie').split(';')[0];csrf=data.csrf;const jpeg=Buffer.from([255,216,255,224,0,1,2,3,255,217]),thumb=Buffer.from([255,216,255,224,9,8,7,255,217]),form=new FormData();form.append('file',new Blob([jpeg],{type:'image/jpeg'}),'foto.jpg');form.append('thumbnail',new Blob([thumb],{type:'image/jpeg'}),'miniatura.jpg');r=await fetch(base+'/api/upload',{method:'POST',headers:{Origin:origin,Cookie:cookie,'X-CSRF-Token':csrf},body:form});data=await r.json();assert.equal(r.status,201,JSON.stringify(data));assert.equal(data.mime,'image/jpeg');assert.equal(data.size,jpeg.length);r=await fetch(base+data.url+'?thumb=1',{headers:{Cookie:cookie}});assert.equal(r.status,200);assert.deepEqual(Buffer.from(await r.arrayBuffer()),thumb);r=await fetch(base+'/api/upload',{method:'POST',headers:{Origin:origin,Cookie:cookie,'X-CSRF-Token':csrf,'Content-Type':'application/json'},body:JSON.stringify({mime:'image/jpeg',base64:jpeg.toString('base64')})});assert.equal(r.status,201); }finally{await new Promise(r=>app.server.close(r));}});


test('unused uploads are collected after seven days while referenced media is kept',async()=>{
 const app=createApp({dbPath:':memory:',origin});
 try{
  const user=app.addUser('gc-media@test.test','Media-GC-2026!','Media GC');
  const insertFile=id=>{app.db.prepare('INSERT INTO files VALUES(?,?,?,?)').run(id,user.id,'image/jpeg',Buffer.from([255,216,255,224,1,2,3]));app.db.prepare('INSERT INTO docs(id,kind,owner,body) VALUES(?,?,?,?)').run('upload-'+id,'fileUpload',user.id,JSON.stringify({id:'upload-'+id,fileId:id,date:'2026-01-01T00:00:00.000Z'}));};
  insertFile('orphan-file');insertFile('used-file');
  app.db.prepare('INSERT INTO docs(id,kind,owner,body) VALUES(?,?,?,?)').run('request-media','request',user.id,JSON.stringify({id:'request-media',userId:user.id,photos:['/media/used-file']}));
  const removed=await app.cleanupOrphanFiles();
  assert.equal(removed,1);
  assert.equal(app.db.prepare('SELECT id FROM files WHERE id=?').get('orphan-file'),undefined);
  assert.ok(app.db.prepare('SELECT id FROM files WHERE id=?').get('used-file'));
 }finally{app.server.close();}
});


test('dual-write mirrors accepted uploads and prefer-storage serves the external copy',async()=>{
 const stored=new Map(),fileStore={
  mode:'prefer-storage',writeEnabled:true,preferStorage:true,
  async upload(id,mime,body){stored.set(id,{mime,body:Buffer.from(body)});return true;},
  async download(id){const row=stored.get(id);if(!row)throw Object.assign(Error('missing'),{status:404});return Buffer.from(row.body);},
  async remove(ids){for(const id of ids)stored.delete(id);return ids.length;}
 };
 const app=createApp({dbPath:':memory:',origin,fileStore});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;let cookie='',csrf='';
 try{
  let r=await fetch(base+'/api/register',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({email:'mirror@test.test',name:'Mirror',password:'Client-Test-2026!'})});let data=await r.json();cookie=r.headers.get('set-cookie').split(';')[0];csrf=data.csrf;
  const jpeg=Buffer.from([255,216,255,224,4,5,6,255,217]),form=new FormData();form.append('file',new Blob([jpeg],{type:'image/jpeg'}),'mirror.jpg');
  r=await fetch(base+'/api/upload',{method:'POST',headers:{Origin:origin,Cookie:cookie,'X-CSRF-Token':csrf},body:form});data=await r.json();assert.equal(r.status,201,JSON.stringify(data));assert.deepEqual(stored.get(data.id).body,jpeg);
  app.db.prepare('UPDATE files SET body=? WHERE id=?').run(Buffer.from([255,216,255,224,9,9,9,255,217]),data.id);
  r=await fetch(base+data.url,{headers:{Cookie:cookie}});assert.equal(r.status,200);assert.deepEqual(Buffer.from(await r.arrayBuffer()),jpeg);
 }finally{await new Promise(r=>app.server.close(r));}
});
