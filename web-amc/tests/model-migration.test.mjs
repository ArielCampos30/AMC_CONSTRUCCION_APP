import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {DatabaseSync} from 'node:sqlite';
import {createApp} from '../server.mjs';

const listen=app=>new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
const close=app=>new Promise(resolve=>app.server.close(resolve));

test('migrates legacy solicitud, accepted presupuesto and orphan obra without deleting data',async()=>{
 const dir=mkdtempSync(path.join(os.tmpdir(),'amc-relations-')),file=path.join(dir,'legacy.sqlite');
 const bootstrap=createApp({dbPath:file,origin:'http://localhost'});await listen(bootstrap);await close(bootstrap);
 const db=new DatabaseSync(file),owner='legacy-client';
 const insert=(id,kind,body)=>db.prepare('INSERT INTO docs(id,kind,owner,body) VALUES(?,?,?,?)').run(id,kind,owner,JSON.stringify(body));
 insert('sol-old','request',{id:'sol-old',userId:owner,status:'Presupuestada',name:'Anterior'});
 insert('pre-old','quote',{id:'pre-old',userId:owner,requestId:'sol-old',status:'Aceptado',total:10});
 insert('obra-old','work',{id:'obra-old',userId:owner,quoteId:'pre-old',status:'Presupuesto aceptado',payments:[],updates:[]});
 insert('obra-huerfana','work',{id:'obra-huerfana',userId:owner,status:'En ejecución',payments:[],updates:[]});db.close();
 const migrated=createApp({dbPath:file,origin:'http://localhost'});await listen(migrated);
 const read=id=>JSON.parse(migrated.db.prepare('SELECT body FROM docs WHERE id=?').get(id).body),sol=read('sol-old'),pre=read('pre-old'),obra=read('obra-old'),orphan=read('obra-huerfana');
 assert.equal(sol.solicitudId,'sol-old');assert.deepEqual(sol.presupuestoIds,['pre-old']);assert.deepEqual(sol.obraIds,['obra-old']);
 assert.equal(pre.presupuestoId,'pre-old');assert.equal(pre.solicitudId,'sol-old');assert.equal(pre.obraId,'obra-old');assert.equal(pre.status,'Aceptado');
 assert.equal(obra.obraId,'obra-old');assert.equal(obra.presupuestoId,'pre-old');assert.equal(obra.solicitudId,'sol-old');
 assert.deepEqual(orphan,{id:'obra-huerfana',userId:owner,status:'En ejecución',payments:[],updates:[]});
 assert.equal(migrated.db.prepare('SELECT count(*) n FROM docs').get().n,4);await close(migrated);rmSync(dir,{recursive:true,force:true});
});

test('new solicitud, presupuesto and compatibility obra store canonical and legacy relations',async()=>{
 const app=createApp({dbPath:':memory:',origin:'http://localhost'});app.addUser('admin@relations.test','Password-2026!','AMC','admin');await listen(app);const base='http://127.0.0.1:'+app.server.address().port;
 const actor=()=>({cookie:'',csrf:'',async call(url,body,status=200){const response=await fetch(base+url,{method:body===undefined?'GET':'POST',headers:{Origin:'http://localhost','Content-Type':'application/json',Cookie:this.cookie,'X-CSRF-Token':this.csrf},...(body===undefined?{}:{body:JSON.stringify(body)})});const data=await response.json();assert.equal(response.status,status,JSON.stringify(data));const cookie=response.headers.get('set-cookie');if(cookie)this.cookie=cookie.split(';')[0];if(data.csrf)this.csrf=data.csrf;return data;}}),admin=actor(),client=actor();
 await admin.call('/api/login',{email:'admin@relations.test',password:'Password-2026!'});await client.call('/api/register',{email:'client@relations.test',name:'Cliente',password:'12345678'});const solicitud=await client.call('/api/requests',{name:'Cliente',phone:'1',town:'La Falda',description:'Trabajo',service:'Albañilería',type:'presupuesto'},201);
 const pdf=await admin.call('/api/upload',{mime:'application/pdf',base64:Buffer.from('%PDF-1.4 relation').toString('base64')},201);const presupuesto=await admin.call('/api/quotes',{requestId:solicitud.id,externalId:'relation-budget',version:'c'.repeat(64),number:'REL-1',items:[{description:'Trabajo'}],total:100,pdfId:pdf.id},201);await client.call('/api/quotes/'+presupuesto.id+'/reply',{status:'Aceptado'});
 const state=await client.call('/api/state'),sol=state.requests.find(x=>x.id===solicitud.id),pre=state.quotes.find(x=>x.id===presupuesto.id),obra=state.works.find(x=>x.quoteId===presupuesto.id);
 assert.equal(sol.solicitudId,sol.id);assert.ok(sol.presupuestoIds.includes(pre.id));assert.ok(sol.obraIds.includes(obra.id));assert.equal(pre.solicitudId,sol.id);assert.equal(pre.requestId,sol.id);assert.equal(pre.obraId,obra.id);assert.equal(obra.presupuestoId,pre.id);assert.equal(obra.quoteId,pre.id);assert.equal(obra.solicitudId,sol.id);assert.equal(obra.requestId,sol.id);await close(app);
});
