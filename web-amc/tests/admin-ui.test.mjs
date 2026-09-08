import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createApp} from '../server.mjs';

const origin='http://localhost:4180';

test('admin v3 exposes the five primary destinations and responsive views',async()=>{
  const [app,css,hub,worker]=await Promise.all([
    readFile(new URL('../public/app.js',import.meta.url),'utf8'),
    readFile(new URL('../public/admin-v3.css',import.meta.url),'utf8'),
    readFile(new URL('../public/project-hub.js',import.meta.url),'utf8'),
    readFile(new URL('../public/sw.js',import.meta.url),'utf8')
  ]);
  const nav="[['inicio','Inicio','⌂'],['solicitudes','Solicitudes','▤'],['presupuestos','Presupuestos','▤'],['obras','Obras','⌂'],['mas-admin','Más','•••']]";
  assert.ok(app.includes(nav));
  assert.match(app,/\['Gestión'.*'Chat'.*'Clientes'.*'Empleados'/s);
  assert.match(app,/\['Herramientas'.*'Tarifario'.*'Estadísticas'/s);
  assert.match(app,/\['Sistema'.*'Configuración'.*'Respaldos'/s);
  assert.match(app,/Solicitudes nuevas.*Presupuestos esperando respuesta.*Presupuestos aceptados sin programar.*Obras en curso.*Mensajes sin leer/s);
  assert.match(app,/Nuevas.*Revisando.*Visita pendiente.*Presupuestadas.*No tomadas.*Todas/s);
  assert.match(app,/En curso.*Programadas.*Pendientes.*Finalizadas.*Todas/s);
  assert.match(app,/data-admin-chat="Clientes".*data-admin-chat="Equipo"/s);
  assert.match(app,/\/api\/staff-chat\/messages/);  assert.match(app,/min="\$\{required\?'0\.01':'0'\}" step="0\.01"/);
  assert.match(hub,/Coordinar visita/);
  assert.match(hub,/No tomar/);
  assert.match(css,/@media\(max-width:800px\)/);
  assert.match(css,/@media\(max-width:430px\)/);
  assert.doesNotMatch(css,/min-width:\s*(?:[4-9]\d\d|\d{4,})px/);
  assert.match(worker,/admin-v3\.css/);
  assert.match(worker,/AMC-offline-shell-v10/);
});

test('Editar abre el presupuesto exacto y no reinicia sus importes',async()=>{
  const [app,features,bridge]=await Promise.all([
    readFile(new URL('../public/app.js',import.meta.url),'utf8'),
    readFile(new URL('../public/features-ui.js',import.meta.url),'utf8'),
    readFile(new URL('../public/presupuestos-bridge.js',import.meta.url),'utf8')
  ]);
  assert.match(app,/data-action="editor" data-id="\$\{r\.id\}" data-quote="\$\{q\.id\}"/);
  assert.match(app,/features\.openEditor\(b\.dataset\.id\|\|'',b\.dataset\.quote\|\|''\)/);
  assert.match(features,/let threadId='',quoteRequest='',quoteEdit='',selectedClient=''/);
  assert.match(features,/quoteEdit\?'&quote='/);
  assert.match(features,/function openEditor\(requestId='',quoteId=''\)/);
  assert.match(bridge,/function loadQuoteForEdit\(quoteId\)/);
  assert.match(bridge,/db\.quotes\|\|\[\]\)\.find\(q=>q\.id===storedQuote\.externalId\)/);
  assert.match(bridge,/if\(editQuoteId\)loadQuoteForEdit\(editQuoteId\)/);
  assert.match(bridge,/else if\(editParams\.get\('solicitud'\)\)importRequest\(false\)/);
});

test('request detail changes quote actions after a quote exists',async()=>{
  const hub=await readFile(new URL('../public/project-hub.js',import.meta.url),'utf8');
  assert.match(hub,/latestQuote=qs\.at\(-1\)/);
  assert.match(hub,/Presupuesto guardado/);
  assert.match(hub,/Editar presupuesto/);
  assert.match(hub,/Ver presupuesto/);
  assert.match(hub,/!qs\.length&&r\.status!=='No tomada'/);
});

test('admin edits clients and employees with AMC dialogs instead of browser confirms',async()=>{
  const [app,directory,team,bridge,index,server,features,planning,closure]=await Promise.all([
    readFile(new URL('../public/app.js',import.meta.url),'utf8'),
    readFile(new URL('../public/client-directory.js',import.meta.url),'utf8'),
    readFile(new URL('../public/team-ui.js',import.meta.url),'utf8'),
    readFile(new URL('../public/presupuestos-bridge.js',import.meta.url),'utf8'),
    readFile(new URL('../public/index.html',import.meta.url),'utf8'),
    readFile(new URL('../server.mjs',import.meta.url),'utf8'),
    readFile(new URL('../public/features-ui.js',import.meta.url),'utf8'),
    readFile(new URL('../public/planning-ui.js',import.meta.url),'utf8'),
    readFile(new URL('../public/accounts-closure-ui.js',import.meta.url),'utf8')
  ]);
  assert.match(directory,/data-action="edit-client"/);
  assert.match(app,/function openEditClientDialog\(clientId\)/);
  assert.match(app,/edit-client-form/);
  assert.match(server,/\/api\\\/admin\\\/clients\\\/\[\^\/\]\+\\\/profile/);
  assert.match(team,/Editar empleado/);
  assert.match(index,/amc-confirm\.js/);
  assert.match(server,/amc-confirm\.js/);
  for(const source of [app,team,bridge,features,planning,closure]){
    assert.doesNotMatch(source,/\bconfirm\(/);
    assert.match(source,/AMCConfirm/);
  }
  assert.match(app,/currentClient=\(state\.agendaClients\|\|\[\]\)\.find|const client=\(state\.agendaClients\|\|\[\]\)\.find/);
  assert.match(bridge,/const currentClient=r=>/);
});

test('admin can classify a request as not taken without deleting it',async()=>{
  const service=createApp({dbPath:':memory:',origin});
  service.addUser('owner@amc.test','Strong-Owner-2026!','AMC','admin');
  await new Promise(resolve=>service.server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+service.server.address().port;
  const actor=()=>({cookie:'',csrf:'',async call(path,body,status=200){const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:this.cookie,'X-CSRF-Token':this.csrf},...(body===undefined?{}:{body:JSON.stringify(body)})});const data=await response.json();assert.equal(response.status,status,JSON.stringify(data));if(response.headers.get('set-cookie'))this.cookie=response.headers.get('set-cookie').split(';')[0];if(data.csrf)this.csrf=data.csrf;return data;}});
  try{
    const admin=actor(),client=actor();
    await admin.call('/api/login',{email:'owner@amc.test',password:'Strong-Owner-2026!'});
    await client.call('/api/register',{email:'cliente@amc.test',password:'12345678',name:'Cliente'});
    const request=await client.call('/api/requests',{name:'Cliente',phone:'3548000000',town:'La Falda',description:'Trabajo de prueba',service:'Albañilería',type:'presupuesto'},201);
    await admin.call('/api/requests/'+request.id+'/status',{status:'No tomada'},400);
    await admin.call('/api/requests/'+request.id+'/status',{status:'No tomada',reason:'Fuera de zona',comment:'Fuera del radio actual.'});
    const stored=(await admin.call('/api/state')).requests.find(item=>item.id===request.id);
    assert.equal(stored.status,'No tomada');
    assert.equal(stored.statusReason,'Fuera de zona');
    assert.equal(stored.statusComment,'Fuera del radio actual.');
  }finally{
    await new Promise(resolve=>service.server.close(resolve));
  }
});


test('quick budget starts with direct client data and exposes the four estimator steps',async()=>{
  const [app,steps,features,bridge]=await Promise.all([
    readFile(new URL('../public/app.js',import.meta.url),'utf8'),
    readFile(new URL('../public/estimator-steps.js',import.meta.url),'utf8'),
    readFile(new URL('../public/features-ui.js',import.meta.url),'utf8'),
    readFile(new URL('../public/presupuestos-bridge.js',import.meta.url),'utf8')
  ]);
  assert.match(app,/case'manual-admin':openClientDialog\('budget'\)/);
  assert.match(app,/Si el teléfono ya existe, AMC usará automáticamente la ficha guardada/);
  assert.match(app,/data-use-existing/);
  assert.match(app,/Cliente existente encontrado/);
  assert.match(steps,/\['Cliente','Trabajo','Costos','Final'\]/);
  assert.match(bridge,/4\. Mano de obra estimada/);
  assert.match(app,/description:'Presupuesto iniciado por Administración'/);
  assert.match(app,/features\.openEditor\(request\.id\)/);
  assert.match(features,/const chooser=quoteRequest\?'':/);
  assert.match(bridge,/else if\(editParams\.get\('solicitud'\)\)importRequest\(false\)/);
  assert.match(bridge,/nav\('add'\)/);
});

test('suggested price and visibility refresh preserve the active estimator',async()=>{
  const [app,bridge,directory]=await Promise.all([
    readFile(new URL('../public/app.js',import.meta.url),'utf8'),
    readFile(new URL('../public/presupuestos-bridge.js',import.meta.url),'utf8'),
    readFile(new URL('../public/client-directory.js',import.meta.url),'utf8')
  ]);
  assert.match(bridge,/draft\.amcClientPrice=Math\.round\(target\)/);
  assert.match(bridge,/const workSubtotal=q=>/);
  assert.match(bridge,/return usesManualPrice\(q\).*workSubtotal\(q\)/s);
  assert.doesNotMatch(bridge,/last\.clientCharge/);
  assert.match(app,/const preservingEstimator=page==='cotizador'\|\|!!document\.querySelector\('#amc-estimator'\)/);
  assert.match(directory,/class="client-view-action"/);
});

test('notification, refresh and margin UI avoid duplicate work',async()=>{
  const [app,bridge]=await Promise.all([readFile(new URL('../public/app.js',import.meta.url),'utf8'),readFile(new URL('../public/presupuestos-bridge.js',import.meta.url),'utf8')]);
  assert.match(app,/const activeRequests=new Map\(\)/);
  assert.match(app,/if\(activeRequests\.has\(key\)\)return activeRequests\.get\(key\)/);
  assert.match(app,/instantRequests=new Set\(\['\/api\/notices\/read'/);
  assert.equal((app.match(/const link=e\.target\.closest\('\[data-notice\]'\)/g)||[]).length,1);
  assert.match(app,/if\(!dirty&&page!=='cotizador'\)render\(\)/);
  assert.match(bridge,/Precio final automático/);
  assert.match(bridge,/Total calculado por trabajos/);
  assert.match(bridge,/El precio actual alcanza el margen objetivo/);
  assert.match(bridge,/Usar .* como precio final/);
});
