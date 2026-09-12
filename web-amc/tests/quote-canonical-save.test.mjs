import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../server.mjs';

const origin='http://localhost:4180';
const actor=base=>({cookie:'',csrf:'',async call(path,body,status=200){
 const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:this.cookie,'X-CSRF-Token':this.csrf},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const value=await response.json();
 assert.equal(response.status,status,JSON.stringify(value));
 if(response.headers.get('set-cookie'))this.cookie=response.headers.get('set-cookie').split(';')[0];
 if(value.csrf)this.csrf=value.csrf;
 return value;
}});

const model=(price,description='Revoque grueso interior')=>({
 schemaVersion:1,
 works:[{id:'work-1',description,quantity:10,quantityExplicit:true,unit:'m²',unitPrice:0,materials:40000,tools:5000,other:5000,labor:0,costsConfirmed:true,workers:2,days:2,hours:8,tariffKey:'revoque-grueso',tariffTask:description,tariffRubric:'Albañilería',tariffUnit:'m²',tariffPrice:price/10,tariffKind:'tariff'}],
 travel:10000,employeeDay:25000,desiredMargin:30,finalPrice:price,finalPriceManual:false
});
const payload=({requestId,externalId='canonical-quote-001',number='AMC-CANON',version='a'.repeat(64),price=300000,description='Revoque grueso interior'})=>({requestId,externalId,number,version,items:[{description}],total:price,internalCost:160000,grossMargin:price-160000,payment:'50% anticipo',notes:'',adminModel:model(price,description)});

test('presupuesto canónico es idempotente, editable, reemplazable y privado para cliente',async()=>{
 const app=createApp({dbPath:':memory:',origin});
 app.addUser('admin@canonical.test','Strong-Admin-2026!','AMC','admin');
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+app.server.address().port,admin=actor(base),client=actor(base);
 try{
  await admin.call('/api/login',{email:'admin@canonical.test',password:'Strong-Admin-2026!'});
  await client.call('/api/register',{email:'client@canonical.test',password:'Strong-Client-2026!',name:'Cliente Canónico'});
  const clientState=await client.call('/api/state'),userId=clientState.user.id;
  const request=await admin.call('/api/admin/requests',{userId,service:'Albañilería',description:'Presupuesto iniciado por Administración.',idempotencyKey:'canonical-request-001'},201);
  const firstBody=payload({requestId:request.id}),first=await admin.call('/api/quotes',firstBody,201);
  assert.equal(first.status,'Enviado');
  assert.equal(first.schemaVersion,3);
  assert.equal(first.adminModel.works[0].description,'Revoque grueso interior');
  assert.equal(first.adminModel.finalPrice,300000);
  const same=await admin.call('/api/quotes',firstBody,200);
  assert.equal(same.id,first.id);
  const adminState=await admin.call('/api/state');
  assert.equal(adminState.quotes.filter(q=>q.requestId===request.id&&q.status!=='Reemplazado').length,1);
  const publicQuote=(await client.call('/api/state')).quotes.find(q=>q.id===first.id);
  assert(publicQuote);
  for(const key of ['adminModel','internalCost','grossMargin','version','contentHash','externalId','estimatedTeam','personnelCost'])assert.equal(Object.hasOwn(publicQuote,key),false,key+' no debe exponerse');
  assert.equal(publicQuote.total,300000);
  assert.deepEqual(publicQuote.items,[{description:'Revoque grueso interior'}]);

  const secondBody=payload({requestId:request.id,version:'b'.repeat(64),price:330000}),second=await admin.call('/api/quotes',secondBody,201);
  assert.notEqual(second.id,first.id);
  const after=await admin.call('/api/state'),old=after.quotes.find(q=>q.id===first.id),current=after.quotes.find(q=>q.id===second.id);
  assert.equal(old.status,'Reemplazado');
  assert.equal(current.status,'Enviado');
  assert.equal(current.total,330000);
  assert.equal(current.adminModel.finalPrice,330000);
  await client.call('/api/quotes/'+second.id+'/reply',{status:'Aceptado'});
  assert((await admin.call('/api/state')).works.some(work=>work.quoteId===second.id&&work.budget===330000));
 }finally{await new Promise(resolve=>app.server.close(resolve));}
});

test('lead sin cuenta guarda, entrega y acepta manualmente sin PDF',async()=>{
 const app=createApp({dbPath:':memory:',origin});
 app.addUser('admin@lead-canonical.test','Strong-Admin-2026!','AMC','admin');
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+app.server.address().port,admin=actor(base);
 try{
  await admin.call('/api/login',{email:'admin@lead-canonical.test',password:'Strong-Admin-2026!'});
  const lead=await admin.call('/api/admin/clients',{name:'Lead Canónico',phone:'3548999123',town:'La Falda'},201);
  const request=await admin.call('/api/admin/requests',{leadId:lead.id,service:'Albañilería',description:'Presupuesto iniciado por Administración.',idempotencyKey:'canonical-lead-request'},201);
  const saved=await admin.call('/api/quotes',payload({requestId:request.id,externalId:'canonical-lead-quote',number:'AMC-LEAD',version:'c'.repeat(64),price:250000}),201);
  assert.equal(saved.status,'Guardado');
  assert.equal(saved.pdfPending,true);
  const delivered=await admin.call('/api/quotes/'+saved.id+'/deliver',{channel:'WhatsApp'});
  assert.equal(delivered.status,'Entregado');
  const accepted=await admin.call('/api/quotes/'+saved.id+'/accept-manual',{},201);
  assert.equal(accepted.ok,true);
  const state=await admin.call('/api/state');
  assert(state.works.some(work=>work.id===accepted.workId&&work.budget===250000));
 }finally{await new Promise(resolve=>app.server.close(resolve));}
});
