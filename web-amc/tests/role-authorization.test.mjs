import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../server.mjs';

async function fixture(){
 const origin='http://localhost:4180',app=createApp({dbPath:':memory:',origin});
 app.addUser('owner@roles.test','Strong-Owner-2026!','AMC','admin');
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+app.server.address().port;
 const actor=()=>({cookie:'',csrf:'',async call(path,body,status=200){
  const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:this.cookie,'X-CSRF-Token':this.csrf},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const data=(response.headers.get('content-type')||'').includes('json')?await response.json():await response.text();
  assert.equal(response.status,status,JSON.stringify(data));
  if(response.headers.get('set-cookie'))this.cookie=response.headers.get('set-cookie').split(';')[0];
  if(data?.csrf)this.csrf=data.csrf;
  return data;
 }});
 return {app,actor,close:()=>new Promise(resolve=>app.server.close(resolve))};
}

test('server authorization isolates tenants, employee assignments, staff chat and private files',async()=>{
 const {app,actor,close}=await fixture();
 try{
  const admin=actor(),clientA=actor(),clientB=actor(),employeeA=actor(),employeeB=actor();
  await admin.call('/api/login',{email:'owner@roles.test',password:'Strong-Owner-2026!'});
  await clientA.call('/api/register',{email:'a@roles.test',name:'Cliente A',password:'12345678'});
  await clientB.call('/api/register',{email:'b@roles.test',name:'Cliente B',password:'12345678'});
  const empA=await admin.call('/api/employees',{email:'ea@roles.test',name:'Empleado A',password:'12345678'},201);
  const empB=await admin.call('/api/employees',{email:'eb@roles.test',name:'Empleado B',password:'12345678'},201);
  await employeeA.call('/api/login',{email:'ea@roles.test',password:'12345678'});
  await employeeB.call('/api/login',{email:'eb@roles.test',password:'12345678'});

  const requestA=await clientA.call('/api/requests',{name:'Cliente A',phone:'1',town:'La Falda',description:'Trabajo A',service:'Pintura',type:'presupuesto'},201);
  const requestB=await clientB.call('/api/requests',{name:'Cliente B',phone:'2',town:'Valle Hermoso',description:'Trabajo B',service:'Albañilería',type:'presupuesto'},201);
  const pdfA=await admin.call('/api/upload',{mime:'application/pdf',base64:Buffer.from('%PDF-1.4 A').toString('base64')},201);
  const pdfB=await admin.call('/api/upload',{mime:'application/pdf',base64:Buffer.from('%PDF-1.4 B').toString('base64')},201);
  const quoteA=await admin.call('/api/quotes',{requestId:requestA.id,externalId:'role-a',version:'a'.repeat(64),number:'A',items:[{description:'A'}],total:1000,pdfId:pdfA.id},201);
  const quoteB=await admin.call('/api/quotes',{requestId:requestB.id,externalId:'role-b',version:'b'.repeat(64),number:'B',items:[{description:'B'}],total:2000,pdfId:pdfB.id},201);

  await clientA.call('/api/requests/'+requestB.id+'/messages',undefined,404);
  await clientA.call('/api/quotes/'+quoteB.id+'/reply',{status:'Aceptado'},404);
  await clientA.call(pdfB.url,undefined,404);
  await clientA.call('/api/staff-chat/messages',undefined,404);
  assert.deepEqual((await clientA.call('/api/state')).requests.map(x=>x.id),[requestA.id]);
  assert.deepEqual((await clientB.call('/api/state')).requests.map(x=>x.id),[requestB.id]);

  await clientA.call('/api/quotes/'+quoteA.id+'/reply',{status:'Aceptado'});
  await clientB.call('/api/quotes/'+quoteB.id+'/reply',{status:'Aceptado'});
  const workA=(await clientA.call('/api/state')).works[0],workB=(await clientB.call('/api/state')).works[0];
  for(const [kind,key] of [['quote',quoteA.id],['work',workA.id]]){
   const row=app.db.prepare('SELECT body FROM docs WHERE kind=? AND id=?').get(kind,key),body=JSON.parse(row.body);
   body.internalCost=777;body.grossMargin=555;body.internalNotes='privado';
   app.db.prepare('UPDATE docs SET body=? WHERE kind=? AND id=?').run(JSON.stringify(body),kind,key);
  }
  const clientState=await clientA.call('/api/state');
  for(const resource of [clientState.quotes[0],clientState.works[0]])for(const field of ['internalCost','grossMargin','internalNotes'])assert.equal(resource[field],undefined);
  assert.equal((await admin.call('/api/state')).works.find(x=>x.id===workA.id).internalCost,777);

  await admin.call('/api/assignments',{employeeId:empA.id,requestId:requestA.id,type:'Trabajo',day:'2030-06-03',time:'10:00',address:'La Falda',instructions:'Trabajo A',idempotencyKey:'role-assign-a'},201);
  await admin.call('/api/assignments',{employeeId:empB.id,requestId:requestB.id,type:'Trabajo',day:'2030-06-04',time:'10:00',address:'Valle Hermoso',instructions:'Trabajo B',idempotencyKey:'role-assign-b'},201);
  const employeeState=await employeeA.call('/api/state');
  assert.deepEqual(employeeState.works.map(x=>x.id),[workA.id]);
  assert.equal(employeeState.works[0].budget,undefined);assert.equal(employeeState.works[0].payments,undefined);assert.equal(employeeState.works[0].internalCost,undefined);
  assert.equal(employeeState.requests.length,0);assert.equal(employeeState.quotes.length,0);assert.equal(employeeState.clients.length,0);
  await employeeA.call('/api/requests/'+requestA.id+'/messages',undefined,404);
  await employeeA.call('/api/requests/'+requestB.id+'/messages',undefined,404);
  await employeeA.call('/api/works/'+workB.id+'/payments',{amount:1,date:'2030-01-01',description:'intrusión',idempotencyKey:'role-intrusion'},403);

  const progress=await admin.call('/api/upload',{mime:'image/jpeg',base64:Buffer.from([255,216,255,224,0,0]).toString('base64')},201);
  await admin.call('/api/works/'+workA.id+'/updates',{text:'Avance privado de A',photoId:progress.id},201);
  await clientA.call(progress.url);await employeeA.call(progress.url);
  await clientB.call(progress.url,undefined,404);await employeeB.call(progress.url,undefined,404);

  const staffPhoto=await employeeA.call('/api/upload',{mime:'image/jpeg',base64:Buffer.from([255,216,255,224,0,1]).toString('base64')},201);
  const staff=await employeeA.call('/api/staff-chat/messages',{employeeId:empB.id,text:'Solo Administración',photos:[staffPhoto.id],idempotencyKey:'role-staff-a'},201);
  assert.equal(staff.employeeId,empA.id);
  assert.equal((await employeeA.call('/api/staff-chat/messages?employeeId='+empB.id)).messages.length,1);
  assert.equal((await employeeB.call('/api/staff-chat/messages')).messages.length,0);
  assert.equal((await admin.call('/api/staff-chat/messages?employeeId='+empA.id)).messages[0].id,staff.id);
  assert.ok((await admin.call('/api/state')).staffMessages.some(x=>x.id===staff.id));
  await admin.call(staffPhoto.url);await employeeA.call(staffPhoto.url);
  await employeeB.call(staffPhoto.url,undefined,404);await clientA.call(staffPhoto.url,undefined,404);

  const adminState=await admin.call('/api/state');
  assert.equal(adminState.requests.length,2);assert.equal(adminState.quotes.length,2);assert.equal(adminState.works.length,2);assert.equal(adminState.clients.length,2);
  assert.ok(adminState.works.some(x=>x.id===workB.id));
 }finally{await close();}
});

