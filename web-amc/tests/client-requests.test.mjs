import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {createDatabaseCore} from '../database-core.mjs';
import {clientRequestFeatures} from '../client-requests.mjs';

const sha=value=>createHash('sha256').update(value).digest('hex');
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const text=(value,max=200)=>typeof value==='string'?value.trim().slice(0,max):'';
const validDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(value||'')&&!isNaN(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;

function setup(){
 let tick=0;
 const now=()=>new Date(Date.UTC(2026,8,10,12,0,tick++)).toISOString();
 const database=createDatabaseCore({dbPath:':memory:',id:randomUUID,sha,now,fail});
 const {db,all,get,put,transaction}=database;
 const addUser=(id,email,name,role,phone='')=>db.prepare('INSERT INTO users(id,email,name,phone,town,role,password,active) VALUES(?,?,?,?,?,?,?,1)').run(id,email,name,phone,'Valle Hermoso',role,'salt:hash');
 addUser('admin','admin@amc.test','AMC','admin');
 addUser('client','client@amc.test','Cliente','client','03548 15 555555');
 addUser('other','other@amc.test','Otro','client','03548 444444');
 const sent=[],notices=[],validated=[];
 const requireAdmin=user=>{if(user?.role!=='admin')fail(403,'Sólo Administración puede realizar esta acción.');return user;};
 const feature=clientRequestFeatures({db,all,get,put,transaction,requireAdmin,safeFile:(_user,key)=>key,notify:(...args)=>notices.push(['notify',...args]),notifyAdmins:(...args)=>notices.push(['admins',...args]),send:(_res,status,data)=>sent.push({status,data}),fail,text,validDate,now,id:randomUUID,services:['Pintura','Reparaciones'],serviceCatalog:{Pintura:['Interior','Exterior'],Reparaciones:['Humedad']},planning:{validateTime:(...args)=>validated.push(args)}});
 return {database,feature,db,all,get,put,sent,notices,validated};
}

test('clientes: detecta duplicados, edita fichas y conserva permisos de administrador',async()=>{
 const {database,feature,all,sent}=setup();
 try{
  const admin={id:'admin',role:'admin'};
  await feature.route({p:'/api/admin/clients',method:'POST',b:{name:'Duplicado',phone:'+54 9 3548 15 555555',town:'La Falda'},user:admin,res:{}});
  assert.equal(sent.at(-1).status,200);
  assert.equal(sent.at(-1).data.duplicate.id,'client');

  await feature.route({p:'/api/admin/clients',method:'POST',b:{name:'Lead',phone:'3548 777777',town:'Huerta Grande',force:true},user:admin,res:{}});
  assert.equal(sent.at(-1).status,201);
  const lead=sent.at(-1).data;
  await feature.route({p:`/api/admin/clients/${lead.id}/profile`,method:'POST',b:{name:'Lead editado',phone:'3548 777777',town:'La Falda',address:'Ruta 38',note:'Prioridad'},user:admin,res:{}});
  assert.equal(all('leadClient').find(item=>item.id===lead.id).name,'Lead editado');

  await assert.rejects(()=>feature.route({p:'/api/admin/clients',method:'POST',b:{name:'X',phone:'3548 999999',town:'La Falda'},user:{id:'client',role:'client'},res:{}}),error=>error.status===403);
 }finally{database.db.close();}
});

test('clientes: vincular una ficha migra solicitudes, presupuestos y obras a la cuenta',async()=>{
 const {database,feature,put,all}=setup();
 try{
  const admin={id:'admin',role:'admin'};
  put('leadClient','',{id:'lead-1',name:'Cliente',phone:'03548 15 555555',town:'Valle Hermoso'});
  put('request','admin',{id:'request-1',userId:'admin',leadId:'lead-1',status:'En contacto'});
  put('quote','admin',{id:'quote-1',userId:'admin',requestId:'request-1',status:'Guardado'});
  put('work','admin',{id:'work-1',userId:'admin',requestId:'request-1',solicitudId:'request-1',quoteId:'quote-1',status:'Programada',budget:100,payments:[]});

  await feature.route({p:'/api/admin/clients/lead-1/link-account',method:'POST',b:{userId:'client'},user:admin,res:{}});
  assert.equal(all('leadClient').find(item=>item.id==='lead-1').linkedUserId,'client');
  assert.equal(all('request','client').find(item=>item.id==='request-1')?.userId,'client');
  assert.equal(all('quote','client').find(item=>item.id==='quote-1')?.userId,'client');
  assert.equal(all('work','client').find(item=>item.id==='work-1')?.userId,'client');
 }finally{database.db.close();}
});

test('clientes: archivar mantiene las reglas de pedidos abiertos y saldo pendiente',async()=>{
 const {database,feature,put,all}=setup();
 try{
  const admin={id:'admin',role:'admin'};
  put('request','client',{id:'request-open',userId:'client',status:'Nueva'});
  await assert.rejects(()=>feature.route({p:'/api/clients/client/archive',method:'POST',b:{archived:true},user:admin,res:{}}),error=>error.status===409);
  put('request','client',{id:'request-open',userId:'client',status:'Cerrada'});
  await feature.route({p:'/api/clients/client/archive',method:'POST',b:{archived:true},user:admin,res:{}});
  assert.equal(all('clientArchive').find(item=>item.userId==='client').archived,true);
 }finally{database.db.close();}
});

test('solicitudes: crea el pedido con rubro, archivos y notificaciones sin cambiar el contrato',async()=>{
 const {database,feature,all,sent,notices}=setup();
 try{
  const client={id:'client',role:'client',name:'Cliente'};
  await feature.route({p:'/api/requests',method:'POST',b:{type:'presupuesto',name:'Cliente',phone:'3548555555',town:'Valle Hermoso',description:'Pintar dormitorio',services:['Interior'],photos:['foto-1']},user:client,res:{}});
  assert.equal(sent.at(-1).status,201);
  const request=sent.at(-1).data;
  assert.equal(request.status,'Nueva');
  assert.equal(request.service,'Interior');
  assert.deepEqual(request.rubrics,['Pintura']);
  assert.deepEqual(request.photos,['foto-1']);
  assert.equal(all('request','client').length,1);
  assert.equal(notices.filter(item=>item[0]==='admins').length,1);
  assert.equal(notices.filter(item=>item[0]==='notify').length,1);
 }finally{database.db.close();}
});

test('solicitudes: valida visitas y conserva las transiciones manuales del administrador',async()=>{
 const {database,feature,put,all,validated}=setup();
 try{
  const client={id:'client',role:'client',name:'Cliente'},admin={id:'admin',role:'admin'};
  await feature.route({p:'/api/requests',method:'POST',b:{type:'visita',name:'Cliente',phone:'3548555555',town:'Valle Hermoso',description:'Revisar humedad',service:'Humedad',day:'2026-09-11',slot:'Mañana · 9 a 12',address:'San Martín 10'},user:client,res:{}});
  assert.deepEqual(validated.at(-1),['2026-09-11','09:00',180]);
  const request=all('request','client')[0];
  await feature.route({p:`/api/requests/${request.id}/status`,method:'POST',b:{status:'No tomada',reason:'Fuera de zona',comment:'No llegamos'},user:admin,res:{}});
  const updated=all('request','client').find(item=>item.id===request.id);
  assert.equal(updated.status,'No tomada');
  assert.equal(updated.statusReason,'Fuera de zona');
  assert.equal(updated.statusComment,'No llegamos');

  put('quote','client',{id:'quote-active',userId:'client',requestId:request.id,status:'Enviado'});
  await assert.rejects(()=>feature.route({p:`/api/requests/${request.id}/status`,method:'POST',b:{status:'Nueva'},user:admin,res:{}}),error=>error.status===409);
 }finally{database.db.close();}
});
