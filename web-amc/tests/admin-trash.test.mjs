import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../server.mjs';

const origin='http://localhost:4180';
function actor(base){return {cookie:'',csrf:'',async call(path,body,status=200){const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:this.cookie,'X-CSRF-Token':this.csrf},...(body===undefined?{}:{body:JSON.stringify(body)})});const data=await response.json();assert.equal(response.status,status,JSON.stringify(data));if(response.headers.get('set-cookie'))this.cookie=response.headers.get('set-cookie').split(';')[0];if(data.csrf)this.csrf=data.csrf;return data;}};}
const doc=(db,id,kind,owner,body)=>db.prepare('INSERT INTO docs(id,kind,owner,body) VALUES(?,?,?,?)').run(id,kind,owner,JSON.stringify({id,...body}));

async function fixture(){
 const app=createApp({dbPath:':memory:',origin});app.addUser('owner-trash@amc.test','Strong-Owner-2026!','AMC','admin');await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+app.server.address().port,admin=actor(base),client=actor(base);
 await admin.call('/api/login',{email:'owner-trash@amc.test',password:'Strong-Owner-2026!'});
 await client.call('/api/register',{email:'client-trash@amc.test',password:'Strong-Client-2026!',name:'Cliente Papelera'});
 const request=await client.call('/api/requests',{name:'Cliente Papelera',phone:'3548000011',town:'Valle Hermoso',description:'Prueba de pintura',service:'Pintura',type:'presupuesto'},201),clientState=await client.call('/api/state'),owner=clientState.user.id;
 return {app,base,admin,client,request,owner,close:()=>new Promise(resolve=>app.server.close(resolve))};
}

test('Papelera mueve la cadena de una solicitud, la restaura y permite borrado definitivo sin borrar al cliente',async()=>{
 const f=await fixture();try{
  doc(f.app.db,'quote-trash','quote',f.owner,{userId:f.owner,requestId:f.request.id,solicitudId:f.request.id,number:'P-PRUEBA',status:'Guardado',items:[{description:'Prueba'}],total:1000,date:new Date().toISOString()});
  doc(f.app.db,'visit-trash','appointment',f.owner,{userId:f.owner,requestId:f.request.id,status:'Confirmada',day:'2030-01-10',time:'10:00'});
  await f.admin.call('/api/admin/commercial-followups/'+f.request.id,{nextAction:'Llamar',nextActionDay:'2030-01-11',note:'Prueba',action:'save'});
  await f.client.call('/api/admin/trash/requests/'+f.request.id,{},403);
  const moved=await f.admin.call('/api/admin/trash/requests/'+f.request.id,{});assert.equal(moved.rootType,'request');
  let state=await f.admin.call('/api/state');assert.equal(state.requests.some(item=>item.id===f.request.id),false);assert.equal(state.quotes.some(item=>item.id==='quote-trash'),false);assert.equal(state.commercialFollowups.some(item=>item.requestId===f.request.id),false);
  const entry=state.trashEntries.find(item=>item.rootType==='request'&&item.rootId===f.request.id);assert.ok(entry);assert.ok(entry.count>=4);
  const clientState=await f.client.call('/api/state');assert.equal(clientState.requests.some(item=>item.id===f.request.id),false);assert.deepEqual(clientState.trashEntries,[]);
  await f.admin.call('/api/admin/trash/'+entry.id+'/restore',{});
  state=await f.admin.call('/api/state');assert.equal(state.requests.some(item=>item.id===f.request.id),true);assert.equal(state.quotes.some(item=>item.id==='quote-trash'),true);assert.equal(state.commercialFollowups.some(item=>item.requestId===f.request.id),true);assert.equal(state.trashEntries.some(item=>item.id===entry.id),false);
  await f.admin.call('/api/admin/trash/requests/'+f.request.id,{});state=await f.admin.call('/api/state');const secondEntry=state.trashEntries.find(item=>item.rootType==='request'&&item.rootId===f.request.id);assert.ok(secondEntry);await f.admin.call('/api/admin/trash/'+secondEntry.id+'/delete',{});
  state=await f.admin.call('/api/state');assert.equal(state.trashEntries.some(item=>item.id===secondEntry.id),false);assert.equal(f.app.db.prepare('SELECT id FROM docs WHERE id=?').get(f.request.id),undefined);assert.equal(f.app.db.prepare('SELECT id FROM docs WHERE id=?').get('quote-trash'),undefined);assert.ok(f.app.db.prepare('SELECT id FROM users WHERE id=?').get(f.owner));
 }finally{await f.close();}
});

test('Papelera de presupuesto conserva la solicitud y AMC bloquea cualquier eliminación si existe una obra',async()=>{
 const f=await fixture();try{
  doc(f.app.db,'quote-only-trash','quote',f.owner,{userId:f.owner,requestId:f.request.id,solicitudId:f.request.id,number:'P-2',status:'Guardado',items:[{description:'Prueba'}],total:500,date:new Date().toISOString()});
  await f.admin.call('/api/admin/trash/quotes/quote-only-trash',{});let state=await f.admin.call('/api/state');assert.equal(state.requests.some(item=>item.id===f.request.id),true);assert.equal(state.quotes.some(item=>item.id==='quote-only-trash'),false);const quoteEntry=state.trashEntries.find(item=>item.rootType==='quote'&&item.rootId==='quote-only-trash');assert.ok(quoteEntry);
  await f.admin.call('/api/admin/trash/'+quoteEntry.id+'/restore',{});
  doc(f.app.db,'work-protected','work',f.owner,{userId:f.owner,requestId:f.request.id,solicitudId:f.request.id,quoteId:'quote-only-trash',presupuestoId:'quote-only-trash',status:'En curso',title:'Obra real'});
  await f.admin.call('/api/admin/trash/requests/'+f.request.id,{},409);await f.admin.call('/api/admin/trash/quotes/quote-only-trash',{},409);
  state=await f.admin.call('/api/state');assert.equal(state.requests.some(item=>item.id===f.request.id),true);assert.equal(state.quotes.some(item=>item.id==='quote-only-trash'),true);assert.equal(state.trashEntries.some(item=>item.rootId===f.request.id||item.rootId==='quote-only-trash'),false);
 }finally{await f.close();}
});
