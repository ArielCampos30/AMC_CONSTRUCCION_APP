import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createApp} from '../server.mjs';

const origin='http://localhost:4180';
function actor(base){return {cookie:'',csrf:'',async call(path,body,status=200,method){const response=await fetch(base+path,{method:method||(body===undefined?'GET':'POST'),headers:{Origin:origin,'Content-Type':'application/json',Cookie:this.cookie,'X-CSRF-Token':this.csrf},...(body===undefined?{}:{body:JSON.stringify(body)})});const data=await response.json();assert.equal(response.status,status,JSON.stringify(data));const setCookie=response.headers.get('set-cookie');if(setCookie)this.cookie=setCookie.split(';')[0];if(data.csrf)this.csrf=data.csrf;return data;}};}
async function withApp(run){const app=createApp({dbPath:':memory:',origin});app.addUser('admin@amc.test','Strong-Admin-2026!','AMC','admin');await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+app.server.address().port;try{await run({app,base});}finally{await new Promise(resolve=>app.server.close(resolve));}}

test('cliente edita y cancela sólo una solicitud todavía nueva',async()=>withApp(async({base})=>{
 const client=actor(base),password='Strong-Client-B-2026!';
 await client.call('/api/register',{email:'cliente-b@amc.test',password,passwordConfirm:password,name:'Cliente Bloque B'});
 const request=await client.call('/api/requests',{type:'presupuesto',name:'Cliente Bloque B',phone:'3548555511',town:'Valle Hermoso',address:'San Martín 100',description:'Pintar dormitorio',services:['Interior'],dimensions:'4 x 3',photos:[],idempotencyKey:'operational-request-01'},201);
 const edited=await client.call('/api/requests/'+request.id+'/edit',{name:'Cliente Bloque B',phone:'3548555511',town:'La Falda',address:'Sarmiento 200',description:'Pintar dormitorio y pasillo',services:['Interior'],dimensions:'5 x 3'});
 assert.equal(edited.id,request.id);
 assert.equal(edited.town,'La Falda');
 assert.equal(edited.description,'Pintar dormitorio y pasillo');
 const cancelled=await client.call('/api/requests/'+request.id+'/cancel',{reason:'Cambié de planes'});
 assert.equal(cancelled.status,'Cancelada');
 assert.equal(cancelled.statusReason,'Cancelada por el cliente');
 const state=await client.call('/api/state');
 assert.equal(state.requests.find(item=>item.id===request.id).status,'Cancelada');
 await client.call('/api/requests/'+request.id+'/edit',{name:'Cliente Bloque B',phone:'3548555511',town:'La Falda',address:'Sarmiento 200',description:'Otro cambio',services:['Interior'],dimensions:'5 x 3'},409);
}));

test('cliente pide otro horario de visita sin mover la reserva hasta confirmación de AMC',async()=>withApp(async({base})=>{
 const admin=actor(base),client=actor(base),password='Strong-Visit-B-2026!';
 await admin.call('/api/login',{email:'admin@amc.test',password:'Strong-Admin-2026!'});
 await client.call('/api/register',{email:'visita-b@amc.test',password,passwordConfirm:password,name:'Cliente Visita B'});
 const request=await client.call('/api/requests',{type:'presupuesto',name:'Cliente Visita B',phone:'3548555522',town:'Valle Hermoso',address:'Belgrano 50',description:'Revisar humedad',services:['Interior'],photos:[],idempotencyKey:'operational-visit-01'},201);
 const visit=await admin.call('/api/requests/'+request.id+'/appointment',{day:'2030-04-10',time:'10:00',duration:60,address:'Belgrano 50'});
 await client.call('/api/appointments/'+visit.id+'/status',{status:'Cambio solicitado',preferredDay:'2030-04-11',preferredTime:'15:00',reason:'Ese día sólo puedo por la tarde'});
 const state=await client.call('/api/state'),saved=state.appointments.find(item=>item.id===visit.id),savedRequest=state.requests.find(item=>item.id===request.id);
 assert.equal(saved.status,'Cambio solicitado');
 assert.equal(saved.day,'2030-04-10');
 assert.equal(saved.time,'10:00');
 assert.equal(saved.requestedDay,'2030-04-11');
 assert.equal(saved.requestedTime,'15:00');
 assert.equal(savedRequest.status,'Visita pendiente');
}));

test('UX operativa integra etapas y herramientas sin crear rutas paralelas',async()=>{
 const [operational,features,css,fieldwork]=await Promise.all([
  readFile(new URL('../public/operational-ux.js',import.meta.url),'utf8'),
  readFile(new URL('../public/features-ui.js',import.meta.url),'utf8'),
  readFile(new URL('../public/operational-ux.css',import.meta.url),'utf8'),
  readFile(new URL('../public/fieldwork-ui.js',import.meta.url),'utf8')
 ]);
 assert.match(operational,/client-request-edit/);
 assert.match(operational,/client-request-cancel/);
 assert.match(operational,/appointment-change/);
 assert.match(operational,/preferredDay/);
 assert.match(operational,/preferredTime/);
 assert.match(operational,/Asignada.*Recibida.*En camino.*En el lugar.*Finalizada/s);
 assert.match(operational,/#fichas/);
 assert.match(operational,/#materiales/);
 assert.match(operational,/\/offline\.html/);
 assert.match(features,/createOperationalUX/);
 assert.match(features,/operational\.submit/);
 assert.match(features,/operational\.afterRender/);
 assert.match(fieldwork,/visit-sheet-form/);
 assert.match(fieldwork,/materials-form/);
 assert.match(css,/operational-progress-steps/);
 assert.match(css,/operational-tools/);
});
