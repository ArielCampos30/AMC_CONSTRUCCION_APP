import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createApp} from '../server.mjs';

const origin='http://localhost:4180';
const actor=base=>({cookie:'',csrf:'',async call(path,body,status=200){
 const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:this.cookie,'X-CSRF-Token':this.csrf},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const value=await response.json();assert.equal(response.status,status,JSON.stringify(value));
 if(response.headers.get('set-cookie'))this.cookie=response.headers.get('set-cookie').split(';')[0];if(value.csrf)this.csrf=value.csrf;return value;
}});

test('Cotizador usa API autenticada para cliente nuevo y actualiza estado local sin refresh',()=>{
 const wrapper=readFileSync(new URL('../public/features-ui.js',import.meta.url),'utf8');
 const clientController=readFileSync(new URL('../public/quote-client-create-controller.js',import.meta.url),'utf8');
 const saver=readFileSync(new URL('../public/quote-save-controller.js',import.meta.url),'utf8');
 assert.match(wrapper,/createQuoteClientCreateController/);
 assert.match(clientController,/api\('\/api\/admin\/clients',draft\)/);
 assert.match(clientController,/stopImmediatePropagation\(\)/);
 assert.match(clientController,/upsertClient\(client\)/);
 assert.doesNotMatch(clientController,/refresh\?\.\(|await refresh|\{getState,api,refresh/);
 assert.match(clientController,/wizard\.prefillClient/);
 assert.match(saver,/identities\.delete\(oldKey\)/);
 assert.match(saver,/syncSavedQuote\(saved,request,willSend\)/);
 assert.doesNotMatch(saver,/await refresh|refresh\?\./);
 assert.match(saver,/wizard\.open\(\);\s*navigate\(`presupuesto-admin\/\$\{saved\.id\}`\)/);
 assert.doesNotMatch(saver,/quoteNumber\s*=/);
 assert.match(saver,/number:''/);
});

test('servidor asigna correlativo comercial y conserva el número entre versiones',async()=>{
 const app=createApp({dbPath:':memory:',origin});
 app.addUser('admin@number.test','Strong-Admin-2026!','AMC','admin');
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+app.server.address().port,admin=actor(base),client=actor(base);
 try{
  await admin.call('/api/login',{email:'admin@number.test',password:'Strong-Admin-2026!'});
  await client.call('/api/register',{email:'cliente-number@test.local',password:'Client-Test-2026!',name:'Cliente numeración'});
  const requestBody={name:'Cliente numeración',phone:'3548001122',town:'La Falda',description:'Pintura exterior',service:'Pintura',type:'presupuesto'};
  const r1=await client.call('/api/requests',requestBody,201),r2=await client.call('/api/requests',{...requestBody,description:'Pintura interior'},201);
  const baseQuote={items:[{description:'Pintura'}],total:100000,internalCost:40000};
  const q1=await admin.call('/api/quotes',{...baseQuote,requestId:r1.id,externalId:'linea-uno',version:'a'.repeat(64),number:'AMC-20260101-ABC123'},201);
  const year=new Date().toISOString().slice(0,4);
  assert.equal(q1.number,`AMC-${year}-0001`);
  assert.notEqual(q1.number,'AMC-20260101-ABC123');
  const q1v2=await admin.call('/api/quotes',{...baseQuote,total:110000,requestId:r1.id,externalId:'linea-uno',version:'b'.repeat(64),number:'OTRO-CODIGO'},201);
  assert.equal(q1v2.number,q1.number);
  const q2=await admin.call('/api/quotes',{...baseQuote,requestId:r2.id,externalId:'linea-dos',version:'c'.repeat(64),number:'AMC-20260101-DEF456'},201);
  assert.equal(q2.number,`AMC-${year}-0002`);
 }finally{await new Promise(resolve=>app.server.close(resolve));}
});
