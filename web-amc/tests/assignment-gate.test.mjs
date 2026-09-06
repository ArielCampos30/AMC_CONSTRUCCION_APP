import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../server.mjs';

async function fixture(){
 const origin='http://localhost:4180',app=createApp({dbPath:':memory:',origin});
 app.addUser('owner@amc.test','Strong-Owner-2026!','AMC','admin');
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+app.server.address().port;
 const actor=()=>({cookie:'',csrf:'',async call(path,body,status=200){const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:this.cookie,'X-CSRF-Token':this.csrf},...(body===undefined?{}:{body:JSON.stringify(body)})});const result=response.headers.get('content-type')?.includes('json')?await response.json():await response.text();assert.equal(response.status,status,JSON.stringify(result));if(response.headers.get('set-cookie'))this.cookie=response.headers.get('set-cookie').split(';')[0];if(result.csrf)this.csrf=result.csrf;return result;}});
 return {actor,close:()=>new Promise(resolve=>app.server.close(resolve))};
}

test('a work assignment requires an accepted quote and work, while a budget visit does not',async()=>{
 const {actor,close}=await fixture();
 try{
  const admin=actor(),client=actor();
  await admin.call('/api/login',{email:'owner@amc.test',password:'Strong-Owner-2026!'});
  await client.call('/api/register',{email:'gate@amc.test',password:'12345678',name:'Cliente'});
  const employee=await admin.call('/api/employees',{email:'gate-worker@amc.test',password:'12345678',name:'Carlos',dailyCost:30000},201);
  const request=await client.call('/api/requests',{name:'Cliente',phone:'3548000001',town:'La Falda',description:'Medir baño',service:'Albañilería',type:'presupuesto'},201);
  const base={employeeId:employee.id,requestId:request.id,day:'2030-08-01',time:'10:00',address:'La Falda',instructions:'Tomar medidas'};
  await admin.call('/api/assignments',{...base,type:'Trabajo',idempotencyKey:'gate-work-before'},409);
  const visit=await admin.call('/api/assignments',{...base,type:'Visita para presupuesto',idempotencyKey:'gate-visit'},201);
  await admin.call('/api/assignments/'+visit.id+'/cancel',{});
  const quote=await admin.call('/api/quotes',{requestId:request.id,externalId:'gate-quote',version:'8'.repeat(64),number:'GATE-1',items:[{description:'Albañilería'}],total:100000},201);
  await client.call('/api/quotes/'+quote.id+'/reply',{status:'Aceptado'});
  const work=await admin.call('/api/assignments',{...base,type:'Trabajo',idempotencyKey:'gate-work-after'},201);
  assert.equal(work.type,'Trabajo');
 }finally{await close();}
});
