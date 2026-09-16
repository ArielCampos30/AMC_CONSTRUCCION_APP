import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../server.mjs';

const origin='http://localhost:4180';

test('partial Storage timeout leaves no database file and rolls back every variant',async()=>{
 const removed=[];
 const fileStore={
  mode:'mirror',writeEnabled:true,preferStorage:false,
  async upload(id){
   if(id.endsWith('-thumb'))throw Object.assign(Error('El almacenamiento de archivos está demorando demasiado. El archivo no se guardó; volvé a intentar en unos segundos.'),{
    status:503,code:'AMC_STORAGE',storageOperation:'upload',storageReason:'timeout',storageAttempts:2,storageRetryable:true
   });
   return true;
  },
  async download(){throw Object.assign(Error('unused'),{status:404});},
  async remove(ids){removed.push([...ids]);return ids.length;}
 };
 const app=createApp({dbPath:':memory:',origin,fileStore});
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+app.server.address().port;let cookie='',csrf='';
 try{
  let response=await fetch(base+'/api/register',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({email:'resilient-media@test.test',name:'Resilient Media',password:'Client-Test-2026!'})});
  const session=await response.json();cookie=response.headers.get('set-cookie').split(';')[0];csrf=session.csrf;
  const jpeg=Buffer.from([255,216,255,224,1,2,3,255,217]),thumb=Buffer.from([255,216,255,224,4,5,6,255,217]),form=new FormData();
  form.append('file',new Blob([jpeg],{type:'image/jpeg'}),'foto.jpg');form.append('thumbnail',new Blob([thumb],{type:'image/jpeg'}),'miniatura.jpg');
  response=await fetch(base+'/api/upload',{method:'POST',headers:{Origin:origin,Cookie:cookie,'X-CSRF-Token':csrf},body:form});
  const body=await response.json();
  assert.equal(response.status,503);
  assert.match(body.error,/demorando demasiado/);
  assert.equal(app.db.prepare('SELECT count(*) AS n FROM files').get().n,0);
  assert.equal(app.db.prepare("SELECT count(*) AS n FROM docs WHERE kind='fileUpload'").get().n,0);
  assert.equal(removed.length>=1,true);
  assert.equal(removed[0].length,2,'rollback debe intentar limpiar original y miniatura aunque una variante no haya confirmado su estado');
  assert.equal(removed[0].some(id=>id.endsWith('-thumb')),true);
 }finally{
  await new Promise(resolve=>app.server.close(resolve));
 }
});
