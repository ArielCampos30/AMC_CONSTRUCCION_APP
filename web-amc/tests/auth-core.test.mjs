import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {createDatabaseCore} from '../database-core.mjs';
import {createAuthCore} from '../auth-core.mjs';

const id=()=>randomUUID();
const sha=value=>createHash('sha256').update(value).digest('hex');
const now=()=>new Date().toISOString();
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};

function setup(){
 const database=createDatabaseCore({dbPath:':memory:',id,sha,now,fail});
 const auth=createAuthCore({db:database.db,all:database.all,id,fail});
 return {database,auth};
}

test('auth core creates users and keeps public user shape stable',()=>{
 const {database,auth}=setup();
 try{
  const user=auth.addUser('cliente@amc.test','Clave-segura-2026!','Cliente AMC');
  assert.equal(user.role,'client');
  assert.match(user.password,/^[a-f0-9]{32}:[a-f0-9]{128}$/);
  assert.deepEqual(auth.userView(user),{id:user.id,email:user.email,name:user.name,phone:'',town:'',role:'client',sound:true});
  assert.throws(()=>auth.addUser('cliente@amc.test','Otra-clave-2026!','Duplicado'),error=>error.status===409);
  assert.throws(()=>auth.passwordHash('12345678'),error=>error.status===400);
 }finally{database.db.close();}
});

test('auth core preserves ownership, admin checks and employee work access',()=>{
 const {database,auth}=setup();
 try{
  const client=auth.addUser('cliente@amc.test','Clave-segura-2026!','Cliente AMC');
  const admin=auth.addUser('admin@amc.test','Admin-segura-2026!','Admin AMC','admin');
  const employee=auth.addUser('empleado@amc.test','Equipo-segura-2026!','Empleado AMC','employee');
  database.put('request',client.id,{id:'r1',userId:client.id});
  database.put('quote',client.id,{id:'q1',userId:client.id,requestId:'r1'});
  database.put('work',client.id,{id:'w1',userId:client.id,quoteId:'q1'});
  database.put('assignment',employee.id,{id:'a1',employeeId:employee.id,requestId:'r1',status:'Asignada'});
  assert.equal(auth.own(client,{userId:client.id,id:'x'}).id,'x');
  assert.throws(()=>auth.own(client,{userId:'otro',id:'x'}),error=>error.status===404);
  assert.doesNotThrow(()=>auth.requireAdmin(admin));
  assert.throws(()=>auth.requireAdmin(client),error=>error.status===403);
  assert.equal(auth.canAccessRequest(employee,database.get('request','r1')),true);
  assert.equal(auth.canAccessWork(employee,database.get('work','w1')),true);
  assert.equal(auth.canAccessQuote(employee,database.get('quote','q1')),false);
 }finally{database.db.close();}
});

test('admin verifier keeps rate limiting and password verification behavior',()=>{
 const {database,auth}=setup();
 try{
  const admin=auth.addUser('admin@amc.test','Admin-segura-2026!','Admin AMC','admin');
  const calls=[];
  const verify=auth.createAdminVerifier((key,limit)=>calls.push([key,limit]));
  assert.doesNotThrow(()=>verify(admin,'Admin-segura-2026!'));
  assert.deepEqual(calls,[[admin.id+':sensitive',5]]);
  assert.throws(()=>verify(admin,'Clave-incorrecta!'),error=>error.status===403);
 }finally{database.db.close();}
});
