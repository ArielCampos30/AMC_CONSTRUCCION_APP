import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../server.mjs';

const origin='http://localhost:4180';
const actor=base=>({cookie:'',csrf:'',async call(path,body,status=200){
 const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:this.cookie,'X-CSRF-Token':this.csrf},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const value=await response.json();assert.equal(response.status,status,JSON.stringify(value));
 if(response.headers.get('set-cookie'))this.cookie=response.headers.get('set-cookie').split(';')[0];if(value.csrf)this.csrf=value.csrf;return value;
}});

test('cliente recibe Tu presupuesto está listo sólo después de adjuntar PDF y una sola vez',async()=>{
 const app=createApp({dbPath:':memory:',origin});
 app.addUser('admin@pdf-ready.test','Strong-Admin-2026!','AMC','admin');
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+app.server.address().port,admin=actor(base),client=actor(base);
 try{
  await admin.call('/api/login',{email:'admin@pdf-ready.test',password:'Strong-Admin-2026!'});
  await client.call('/api/register',{email:'cliente-pdf-ready@test.local',password:'Strong-Client-2026!',name:'Cliente PDF'});
  const request=await client.call('/api/requests',{name:'Cliente PDF',phone:'3548002233',town:'La Falda',description:'Revoque exterior',service:'Albañilería',type:'presupuesto'},201);
  const before=(await client.call('/api/state')).notices.length;
  const quote=await admin.call('/api/quotes',{requestId:request.id,externalId:'pdf-ready-lineage',version:'a'.repeat(64),items:[{description:'Revoque exterior'}],total:180000},201);
  assert.equal(quote.pdf,'');
  assert.equal(quote.pdfPending,true);
  assert.equal((await client.call('/api/state')).notices.length,before);
  const upload=await admin.call('/api/upload',{mime:'application/pdf',base64:Buffer.from('%PDF-1.4\nready').toString('base64')},201);
  const attached=await admin.call('/api/quotes/'+quote.id+'/pdf',{pdfId:upload.id});
  assert.ok(attached.pdf);
  assert.equal(attached.pdfPending,false);
  assert.ok(attached.pdfAttachedAt);
  assert.ok(attached.pdfNotifiedAt);
  let state=await client.call('/api/state');
  let readyNotices=state.notices.filter(notice=>notice.title==='Tu presupuesto está listo'&&String(notice.url||'').includes(quote.id));
  assert.equal(readyNotices.length,1);
  assert.ok(state.quotes.find(item=>item.id===quote.id)?.pdf);
  await admin.call('/api/quotes/'+quote.id+'/pdf',{pdfId:upload.id});
  state=await client.call('/api/state');
  readyNotices=state.notices.filter(notice=>notice.title==='Tu presupuesto está listo'&&String(notice.url||'').includes(quote.id));
  assert.equal(readyNotices.length,1);

  const request2=await client.call('/api/requests',{name:'Cliente PDF',phone:'3548002233',town:'La Falda',description:'Pintura',service:'Pintura',type:'presupuesto'},201);
  const failedQuote=await admin.call('/api/quotes',{requestId:request2.id,externalId:'pdf-failed-lineage',version:'b'.repeat(64),items:[{description:'Pintura'}],total:90000},201);
  const failed=await admin.call('/api/quotes/'+failedQuote.id+'/pdf-failed',{});
  assert.equal(failed.pdfPending,false);
  assert.ok(failed.pdfErrorAt);
  state=await client.call('/api/state');
  assert.equal(state.notices.filter(notice=>notice.title==='Tu presupuesto está listo'&&String(notice.url||'').includes(failedQuote.id)).length,0);
 }finally{await new Promise(resolve=>app.server.close(resolve));}
});
