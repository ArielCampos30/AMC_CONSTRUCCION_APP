import test from 'node:test';
import assert from 'node:assert/strict';
import {access,readdir,readFile} from 'node:fs/promises';
import {dirname,join,relative,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createApp} from '../server.mjs';
import {getShellNavigation} from '../public/app-shell-navigation.js';
import {resolveAppPage,isProtectedPage} from '../public/app-page-router.js';

const publicDir=fileURLToPath(new URL('../public/',import.meta.url));
const docsDir=fileURLToPath(new URL('../../docs/',import.meta.url));

async function filesMatching(dir,predicate){
 const out=[];
 for(const entry of await readdir(dir,{withFileTypes:true})){
  const path=join(dir,entry.name);
  if(entry.isDirectory())out.push(...await filesMatching(path,predicate));
  else if(entry.isFile()&&predicate(entry.name,path))out.push(path);
 }
 return out;
}
const jsFiles=dir=>filesMatching(dir,name=>name.endsWith('.js'));

test('navegación visible de cada rol resuelve sólo vistas permitidas',()=>{
 const stateFor=role=>({user:{id:role+'-1',role},requests:[],quotes:[],works:[]});
 const expected={
  admin:new Set(['admin-dashboard','admin-requests','admin-quotes','admin-works','admin-more']),
  employee:new Set(['team','profile']),
  client:new Set(['client-home','client-works','messages','profile'])
 };
 for(const role of Object.keys(expected)){
  const nav=getShellNavigation({role,page:''});
  for(const item of [...nav.sidebar,...nav.bottom]){
   const resolved=resolveAppPage(item.route,stateFor(role));
   assert.ok(expected[role].has(resolved.view),`${role} route ${item.route} resolved to ${resolved.view}`);
  }
 }
});

test('rutas sensibles requieren sesión y deep links cruzados no exponen vistas administrativas',()=>{
 const anonymous={user:null,requests:[],quotes:[],works:[]};
 for(const route of ['clientes','solicitudes','presupuestos','obras','chat-admin','mas-admin','respaldos','empleados','tareas','compras','cotizador','cliente/x','obra-admin/x','presupuesto-admin/x','chat-admin/x','chat-equipo/x']){
  assert.equal(isProtectedPage(route),true,route);
  assert.equal(resolveAppPage(route,anonymous).view,'auth',route);
 }
 const client={user:{id:'c',role:'client'},requests:[],quotes:[],works:[]};
 const employee={user:{id:'e',role:'employee'},requests:[],quotes:[],works:[]};
 for(const route of ['clientes','solicitudes','obras','chat-admin','mas-admin','respaldos','empleados','comercial','papelera','cliente/x','obra-admin/x','presupuesto-admin/x']){
  assert.ok(!resolveAppPage(route,client).view.startsWith('admin-'),`client ${route}`);
  assert.ok(!resolveAppPage(route,employee).view.startsWith('admin-'),`employee ${route}`);
 }
 assert.notEqual(resolveAppPage('mensajes',employee).view,'features','Empleado no debe tener una sección separada de chat de clientes; usa únicamente el chat flotante con Administración.');
});

test('acciones literales renderizadas tienen referencia de manejo adicional',async()=>{
 const files=await jsFiles(publicDir),contents=[];
 for(const path of files)contents.push({path,text:await readFile(path,'utf8')});
 const corpus=contents.map(x=>x.text).join('\n');
 const found=new Map();
 const re=/data-action=["'`]([^"'`$<>\s]+)["'`]/g;
 for(const {path,text} of contents){let m;while((m=re.exec(text))){const action=m[1];if(!found.has(action))found.set(action,[]);found.get(action).push(relative(publicDir,path));}}
 const suspicious=[];
 for(const [action,paths] of found){
  const escaped=action.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const occurrences=(corpus.match(new RegExp(escaped,'g'))||[]).length;
  if(occurrences<2)suspicious.push(`${action} (${[...new Set(paths)].join(', ')})`);
 }
 assert.deepEqual(suspicious,[],'Posibles botones sin controlador: '+suspicious.join('; '));
});

test('landing y páginas legales no tienen assets locales rotos',async()=>{
 const pages=['index.html','privacidad.html','eliminar-cuenta.html'];
 for(const page of pages){
  const path=join(docsDir,page),html=await readFile(path,'utf8');
  const refs=[...html.matchAll(/(?:href|src)=["']([^"']+)["']/g)].map(m=>m[1]);
  for(const ref of refs){
   if(/^(?:https?:|mailto:|tel:|#|\/)/i.test(ref))continue;
   const clean=ref.split(/[?#]/)[0];if(!clean)continue;
   await assert.doesNotReject(access(resolve(dirname(path),clean)),`${page} -> ${ref}`);
  }
 }
});

test('runtime público no conserva el dominio legacy de privacidad',async()=>{
 const paths=[...await filesMatching(publicDir,name=>/\.(?:js|html|css)$/.test(name)),...await filesMatching(docsDir,name=>/\.(?:js|html|css)$/.test(name))];
 for(const path of paths){
  const text=await readFile(path,'utf8');
  assert.doesNotMatch(text,/amc-construcciones\.onrender\.com\/privacidad\.html/,relative(resolve(publicDir,'..','..'),path));
 }
 const privacy=await readFile(join(docsDir,'privacidad.html'),'utf8');
 assert.match(privacy,/Ariel Maximiliano Campos/);
 assert.match(privacy,/Ataliva Herrera 468, La Falda, Córdoba, Argentina/);
 assert.match(privacy,/camposariel313@gmail\.com/);
 const landing=await readFile(join(docsDir,'index.html'),'utf8');
 assert.match(landing,/Política de privacidad/);
 assert.match(landing,/Eliminación de cuenta/);
});

async function fixture(){
 const origin='http://localhost:4180',app=createApp({dbPath:':memory:',origin});
 app.addUser('owner@final2.test','Strong-Owner-2026!','AMC','admin');
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+app.server.address().port;
 const actor=()=>({cookie:'',csrf:'',async call(path,body,status=200){
  const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:this.cookie,'X-CSRF-Token':this.csrf},...(body===undefined?{}:{body:JSON.stringify(body)}),redirect:'manual'});
  const data=(response.headers.get('content-type')||'').includes('json')?await response.json():await response.text();
  assert.equal(response.status,status,`${path}: ${JSON.stringify(data)}`);
  if(response.headers.get('set-cookie'))this.cookie=response.headers.get('set-cookie').split(';')[0];
  if(data?.csrf)this.csrf=data.csrf;
  return data;
 }});
 return {app,actor,close:()=>new Promise(resolve=>app.server.close(resolve))};
}

test('matriz final de roles: segundo admin sí administra y cliente/empleado no escalan permisos',async()=>{
 const {app,actor,close}=await fixture();
 try{
  const owner=actor(),second=actor(),employee=actor(),client=actor();
  await owner.call('/api/login',{email:'owner@final2.test',password:'Strong-Owner-2026!'});
  await client.call('/api/register',{email:'client@final2.test',password:'Strong-Client-2026!',name:'Cliente'});
  const emp=await owner.call('/api/employees',{email:'employee@final2.test',password:'Strong-Employee-2026!',name:'Empleado'},201);
  const admin2=await owner.call('/api/employees',{email:'admin2@final2.test',password:'Strong-Admin2-2026!',name:'Admin 2',role:'admin'},201);
  await employee.call('/api/login',{email:'employee@final2.test',password:'Strong-Employee-2026!'});
  await second.call('/api/login',{email:'admin2@final2.test',password:'Strong-Admin2-2026!'});
  assert.equal((await second.call('/api/state')).user.role,'admin');
  await client.call('/api/employees',{email:'x@final2.test',password:'Strong-Test-2026!',name:'X',role:'admin'},403);
  await employee.call('/api/employees',{email:'y@final2.test',password:'Strong-Test-2026!',name:'Y',role:'admin'},403);
  await second.call('/api/employees/'+emp.id+'/role',{role:'admin'});
  assert.equal(app.db.prepare('SELECT role FROM users WHERE id=?').get(emp.id).role,'admin');
  await second.call('/api/employees/'+admin2.id+'/role',{role:'employee'},400);
  await second.call('/api/employees/'+admin2.id+'/access',{active:false},400);
 }finally{await close();}
});
