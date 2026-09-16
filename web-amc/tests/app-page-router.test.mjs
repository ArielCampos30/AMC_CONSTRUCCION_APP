import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pageFromHash,normalizeInitialPage,normalizePageForRole,isProtectedPage,resolveAppPage} from '../public/app-page-router.js';

const stateFor=role=>role?{user:{id:role+'-1',role},quotes:[{id:'quote-1',requestId:'request-1'}],works:[{id:'work-1',requestId:'request-1'}],requests:[{id:'request-1'}]}:{quotes:[],works:[],requests:[]};

test('normalización pura conserva hashes, recuperación e alias Admin',()=>{
 assert.equal(pageFromHash('#servicios'),'servicios');
 assert.equal(pageFromHash(''),'inicio');
 assert.equal(pageFromHash('#chat/request-1'),'chat/request-1');
 assert.equal(pageFromHash('#chat-admin/request-1'),'chat-admin/request-1');
 assert.equal(pageFromHash('#chat-user/client-1'),'chat-user/client-1');
 assert.equal(pageFromHash('#conversacion/request-1'),'conversacion/request-1');
 assert.equal(pageFromHash('#inicio','restablecer'),'restablecer');
 assert.equal(normalizeInitialPage('admin'),'inicio');
 assert.equal(normalizeInitialPage('servicios'),'servicios');
 assert.equal(normalizePageForRole('admin','admin'),'inicio');
 assert.equal(normalizePageForRole('admin','client'),'admin');
 assert.equal(normalizePageForRole('admin','employee'),'admin');
});

test('contrato de protección cubre rutas estáticas y deep links de cada rol',()=>{
 const protectedRoutes=[
  'clientes','calendario','perfil','presupuestos','avisos','cotizador','solicitudes','obras','chat-admin','mas-admin','respaldos','resumen','inicio-empleado','mis-trabajos','mis-trabajos-cliente','chat-cliente',
  'mi-trabajo/request-1','solicitud/request-1','presupuesto/quote-1','obra/work-1','chat/request-1','presupuesto-admin/quote-1','obra-admin/work-1','chat-admin/request-1','chat-equipo/employee-1','cliente/client-1','trabajo/task-1'
 ];
 for(const page of protectedRoutes){
  assert.equal(isProtectedPage(page),true,page);
  assert.deepEqual(resolveAppPage(page,stateFor()),{view:'auth',returnTo:page},page);
 }
 for(const page of ['inicio','servicios','ideas','resenas','ingresar','registro','recuperar','restablecer','ruta-inexistente'])assert.equal(isProtectedPage(page),false,page);
});

test('matriz pública conserva páginas abiertas, autenticación y fallbacks',()=>{
 const state=stateFor();
 const matrix=[
  ['inicio','home'],['servicios','services'],['ideas','ideas'],['ingresar','auth'],['registro','auth-register'],
  ['recuperar','accounts'],['restablecer','accounts'],['clientes','auth'],['pedir','auth'],['visita','auth'],
  ['perfil','auth'],['presupuestos','auth'],['obra','auth'],['avisos','auth'],['favoritos','auth'],['referidos','auth'],
  ['mensajes','auth'],['cotizador','auth'],['solicitud/request-1','auth'],['presupuesto/quote-1','auth'],
  ['obra/work-1','auth'],['trabajo/task-1','auth'],['presupuesto-admin/quote-1','auth'],['obra-admin/work-1','auth'],['cliente/client-1','auth'],['ruta-inexistente','home']
 ];
 for(const [page,view] of matrix)assert.equal(resolveAppPage(page,state).view,view,page);
});

test('matriz Cliente conserva inicio, trabajos, presupuestos, solicitudes y chat',()=>{
 const state=stateFor('client');
 const matrix=[
  ['inicio',{view:'client-home'}],['obra',{view:'client-works'}],['mis-trabajos-cliente',{view:'client-works'}],
  ['mi-trabajo/request-1',{view:'client-work-detail',id:'request-1'}],['solicitud/request-1',{view:'client-work-detail',id:'request-1'}],
  ['presupuesto/quote-1',{view:'client-quote',id:'quote-1',quoteFound:true,requestId:'request-1'}],['presupuesto/missing',{view:'client-quote',id:'missing',quoteFound:false,requestId:undefined}],
  ['obra/work-1',{view:'client-work',id:'work-1',workFound:true,requestId:'request-1'}],['obra/missing',{view:'client-work',id:'missing',workFound:false,requestId:undefined}],
  ['chat/request-1',{view:'messages',selectChat:true,chatRequestId:'request-1'}],['chat/missing',{view:'messages',selectChat:false,chatRequestId:''}],['chat-cliente',{view:'messages'}],
  ['solicitar',{view:'request-form',visit:false}],['cotizador',{view:'features',page:'cotizador'}],['solicitudes',{view:'home'}],['obras',{view:'home'}],['presupuesto-admin/quote-1',{view:'home'}],['obra-admin/work-1',{view:'home'}],['ruta-inexistente',{view:'home'}]
 ];
 for(const [page,expected] of matrix)assert.deepEqual(resolveAppPage(page,state),expected,page);
});

test('matriz Admin conserva paneles, detalles, chats e IDs dinámicos',()=>{
 const state=stateFor('admin');
 const matrix=[
  ['inicio',{view:'admin-dashboard'}],['solicitudes',{view:'admin-requests'}],['presupuestos',{view:'admin-quotes'}],['presupuesto-admin/quote-1',{view:'admin-quote-detail',id:'quote-1'}],['obras',{view:'admin-works'}],['obra-admin/work-1',{view:'admin-work-detail',id:'work-1'}],
  ['chat-admin',{view:'admin-chat'}],['chat-admin/request-1',{view:'messages',selectChat:true,chatRequestId:'request-1'}],['chat-equipo/employee-1',{view:'admin-team-chat',employeeId:'employee-1'}],
  ['mas-admin',{view:'admin-more'}],['respaldos',{view:'admin-backups'}],['cliente/client-1',{view:'admin-client-detail',id:'client-1'}],['clientes',{view:'client-directory'}],['resumen',{view:'hub-dashboard'}],['solicitud/request-1',{view:'request-detail',id:'request-1'}],['cotizador',{view:'features',page:'cotizador'}],['ruta-inexistente',{view:'home'}]
 ];
 for(const [page,expected] of matrix)assert.deepEqual(resolveAppPage(page,state),expected,page);
});

test('Empleado no tiene página propia de chat; la ruta histórica vuelve a Inicio para abrir el flotante',()=>{
 const state=stateFor('employee');
 const matrix=[
  ['inicio',{view:'team',page:'tareas'}],
  ['inicio-empleado',{view:'team',page:'inicio-empleado'}],
  ['mis-trabajos',{view:'team',page:'mis-trabajos'}],
  ['chat-equipo',{view:'team',page:'inicio-empleado',legacyEmployeeChat:true}],
  ['trabajo/task-1',{view:'employee-work-detail',id:'task-1'}],
  ['perfil',{view:'profile'}],['avisos',{view:'notices'}],['mensajes',{view:'features',page:'mensajes'}],['tareas',{view:'team',page:'tareas'}],['estado-presupuestos',{view:'team',page:'estado-presupuestos'}],
  ['cotizador',{view:'employee-restricted'}],['solicitudes',{view:'employee-restricted'}],['obras',{view:'employee-restricted'}],['presupuesto-admin/quote-1',{view:'employee-restricted'}],['obra-admin/work-1',{view:'employee-restricted'}],['admin',{view:'employee-restricted'}],['ruta-inexistente',{view:'employee-restricted'}]
 ];
 for(const [page,expected] of matrix)assert.deepEqual(resolveAppPage(page,state),expected,page);
});

test('el resolver no hace fetch, render, listeners, cambios de location ni mutaciones',async()=>{
 const original={fetch:globalThis.fetch,window:globalThis.window,document:globalThis.document,location:globalThis.location};
 let fetches=0,renders=0,listeners=0;
 const state=Object.freeze({user:Object.freeze({role:'client'}),quotes:Object.freeze([]),works:Object.freeze([]),requests:Object.freeze([])}),before=JSON.stringify(state);
 try{globalThis.fetch=()=>{fetches++;};globalThis.window={render:()=>{renders++;},addEventListener:()=>{listeners++;}};globalThis.document={addEventListener:()=>{listeners++;}};globalThis.location={hash:'#sin-cambios'};await import('../public/app-page-router.js?side-effects='+Date.now());assert.deepEqual(resolveAppPage('ruta-inexistente',state),{view:'home'});assert.equal(fetches,0);assert.equal(renders,0);assert.equal(listeners,0);assert.equal(globalThis.location.hash,'#sin-cambios');assert.equal(JSON.stringify(state),before);}finally{for(const [key,value] of Object.entries(original)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}
});

test('app.js delega la resolución sin conservar la cadena de decisiones anterior',async()=>{
 const [app,router]=await Promise.all([readFile(new URL('../public/app.js',import.meta.url),'utf8'),readFile(new URL('../public/app-page-router.js',import.meta.url),'utf8')]);
 assert.match(app,/resolveAppPage\(page,state\)/);assert.match(app,/normalizeInitialPage\(pageFromHash\(location\.hash,recoveryRoute\(\)\)\)/);assert.match(app,/normalizePageForRole\(requested,state\.user\?\.role\)/);assert.doesNotMatch(app,/const protectedPages=|state\.user\?\.role==='client'&&page\.startsWith\('solicitud\/'\)|isAdmin\(\)&&page\.startsWith\('presupuesto-admin\/'\)/);assert.match(router,/PROTECTED_PAGES/);assert.match(router,/PROTECTED_PREFIXES/);assert.match(router,/isProtectedPage/);assert.match(router,/role==='client'&&page\.startsWith\('solicitud\/'\)/);assert.match(router,/role==='admin'&&page\.startsWith\('presupuesto-admin\/'\)/);
});
