import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createApp} from '../server.mjs';

const origin='http://localhost:4180';
const source=name=>readFile(new URL('../public/'+name,import.meta.url),'utf8');

test('admin v3 conserva destinos, filtros y vistas responsivas',async()=>{
 const [app,css,dashboard,requestsUI,quotesUI,worksUI,chatUI,system]=await Promise.all([
  source('app.js'),source('admin-v3.css'),source('admin-dashboard-ui.js'),source('admin-requests-ui.js'),source('admin-quotes-ui.js'),source('admin-works-ui.js'),source('admin-chat-ui.js'),source('admin-system-ui.js')
 ]);
 const nav="[['inicio','Inicio','⌂'],['solicitudes','Solicitudes','▤'],['presupuestos','Presupuestos','▤'],['obras','Obras','⌂'],['mas-admin','Más','•••']]";
 assert.ok(app.includes(nav));
 assert.match(dashboard,/Solicitudes nuevas.*Presupuestos esperando respuesta.*Presupuestos aceptados sin programar.*Obras en curso.*Mensajes sin leer/s);
 assert.match(requestsUI,/Nuevas.*Revisando.*Visita pendiente.*Presupuestadas.*No tomadas.*Todas/s);
 assert.match(quotesUI,/Pendientes.*Aceptados.*No aceptados.*Vencidos.*Todos/s);
 assert.match(worksUI,/En curso.*Programadas.*Pendientes.*Finalizadas.*Todas/s);
 assert.match(chatUI,/data-admin-chat="Clientes".*data-admin-chat="Equipo"/s);
 assert.match(css,/@media\(max-width:800px\)/);assert.match(css,/@media\(max-width:430px\)/);
 assert.doesNotMatch(css,/min-width:\s*(?:[4-9]\d\d|\d{4,})px/);
 assert.match(system,/\['Gestión'.*'Chat'.*'Clientes'.*'Empleados'/s);
 assert.match(system,/\['Herramientas'.*'Tarifario'.*'Cotizador'.*'Resumen diario'/s);
 assert.doesNotMatch(system,/Tarifario y cotizador/);
 assert.match(system,/\['Sistema'.*'Configuración'.*'Respaldos'/s);
});

test('editar abre el presupuesto exacto y restaura el modelo persistido',async()=>{
 const [app,features,wizard,quotesUI]=await Promise.all([source('app.js'),source('features-ui.js'),source('quote-wizard.js'),source('admin-quotes-ui.js')]);
 assert.match(quotesUI,/data-action="editor".*data-quote=/s);
 assert.match(app,/features\.openEditor\(b\.dataset\.id\|\|'',b\.dataset\.quote\|\|''\)/);
 assert.match(features,/openEditor\(requestId='',quoteId='',mode=''\).*wizard\.open\(requestId,quoteId,mode\).*cotizador/s);
 assert.match(wizard,/const quote=quoteId\?quotes\(\)\.find\(item=>item\.id===quoteId\):null/);
 assert.match(wizard,/const quoteItems=editable\?\.works\|\|quote\?\.items\|\|\[\]/);
 assert.match(wizard,/const stored=amount\(editable\?\.finalPrice\?\?quote\.amcClientPrice\?\?quote\.total,0\)/);
});

test('detalle de solicitud cambia las acciones cuando ya existe presupuesto',async()=>{
 const hub=await source('project-hub.js');
 assert.match(hub,/latestQuote=qs\.at\(-1\)/);assert.match(hub,/Presupuesto guardado/);assert.match(hub,/Editar presupuesto/);assert.match(hub,/Ver presupuesto/);
});

test('edición de clientes y equipo usa diálogos AMC y no confirm del navegador',async()=>{
 const [app,dialogs,teamDialog,team,projects]=await Promise.all([source('app.js'),source('admin-client-dialogs-ui.js'),source('admin-team-dialog-ui.js'),source('team-ui.js'),source('project-actions-features.js')]);
 assert.match(app,/from '.\/admin-client-dialogs-ui\.js'/);assert.match(dialogs,/edit-client-form/);assert.match(dialogs,/new-client-form/);
 assert.match(app,/from '.\/admin-team-dialog-ui\.js'/);assert.match(teamDialog,/assign-team-form/);
 for(const current of [app,dialogs,teamDialog,team,projects])assert.doesNotMatch(current,/\bconfirm\(/);
 assert.match(projects,/AMCConfirm/);
});

test('teléfono duplicado muestra aviso AMC visible',async()=>{
 const [app,confirm]=await Promise.all([source('app.js'),source('amc-confirm.js')]);
 assert.match(app,/Teléfono ya registrado/);assert.match(app,/singleAction:true/);assert.match(confirm,/cancelButton\.hidden=options\.singleAction===true/);assert.doesNotMatch(confirm,/method="dialog"/);
});

test('admin puede clasificar una solicitud como no tomada sin borrarla',async()=>{
 const service=createApp({dbPath:':memory:',origin});service.addUser('owner@amc.test','Strong-Owner-2026!','AMC','admin');await new Promise(resolve=>service.server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+service.server.address().port;
 const actor=()=>({cookie:'',csrf:'',async call(path,body,status=200){const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:this.cookie,'X-CSRF-Token':this.csrf},...(body===undefined?{}:{body:JSON.stringify(body)})});const data=await response.json();assert.equal(response.status,status,JSON.stringify(data));if(response.headers.get('set-cookie'))this.cookie=response.headers.get('set-cookie').split(';')[0];if(data.csrf)this.csrf=data.csrf;return data;}});
 try{const admin=actor(),client=actor();await admin.call('/api/login',{email:'owner@amc.test',password:'Strong-Owner-2026!'});await client.call('/api/register',{email:'cliente@amc.test',password:'Client-Test-2026!',name:'Cliente'});const request=await client.call('/api/requests',{name:'Cliente',phone:'3548000000',town:'La Falda',description:'Trabajo de prueba',service:'Albañilería',type:'presupuesto'},201);await admin.call('/api/requests/'+request.id+'/status',{status:'No tomada'},400);await admin.call('/api/requests/'+request.id+'/status',{status:'No tomada',reason:'Fuera de zona',comment:'Fuera del radio actual.'});const stored=(await admin.call('/api/state')).requests.find(item=>item.id===request.id);assert.equal(stored.status,'No tomada');assert.equal(stored.statusReason,'Fuera de zona');assert.equal(stored.statusComment,'Fuera del radio actual.');}finally{await new Promise(resolve=>service.server.close(resolve));}
});

test('búsqueda de clientes y alta desde Cotizador no recargan toda AMC',async()=>{
 const [app,directory,wizard,clientCreate]=await Promise.all([source('app.js'),source('client-directory.js'),source('quote-wizard.js'),source('quote-client-create-controller.js')]);
 assert.match(directory,/id="client-search-input"/);assert.match(directory,/id="client-search-results"/);
 assert.match(app,/client-search-input/);assert.doesNotMatch(app,/location\.reload\(/);assert.doesNotMatch(app,/location\.assign\(/);
 assert.match(wizard,/data-qw-client/);assert.match(wizard,/data-qw-new-client/);assert.match(clientCreate,/upsertClient/);assert.match(clientCreate,/wizard\.prefillClient/);assert.doesNotMatch(clientCreate,/\brefresh\b|\/api\/state/);
});

test('chat flotante separa clientes y empleados y envía sin reload',async()=>{
 const [chat,float,team]=await Promise.all([source('chat-features.js'),source('floating-chat.js'),source('team-ui.js')]);
 assert.match(chat,/floatingEmployeeContacts/);assert.match(chat,/floatingClientContacts/);assert.match(chat,/label:'Clientes'/);assert.match(chat,/label:'Empleados'/);
 assert.match(float,/function showGroups\(\)/);assert.match(float,/submitCustom/);assert.match(chat,/status\.textContent=''/);assert.match(team,/return 'message-sent'/);
 assert.doesNotMatch(chat,/location\.reload|toast\('Mensaje enviado\.'\)/);
});

test('chat de pantalla completa no apila el flotante y bloquea doble envío',async()=>{
 const [app,chat,float]=await Promise.all([source('app.js'),source('chat-features.js'),source('floating-chat.js')]);
 assert.match(app,/page\.startsWith\('chat-admin\/'\)/);assert.match(chat,/fullPageChat/);assert.match(chat,/floating\.close\?\.\(\)/);assert.match(chat,/form\.dataset\.sending==='1'/);assert.match(chat,/sendButton\.disabled=true/);assert.match(chat,/sendButton\.disabled=false/);assert.match(float,/body\.full-chat-page \.floating-chat-button,body\.quote-wizard-route \.floating-chat-button\{display:none!important\}/);
});

test('presupuesto rápido usa datos directos y cuatro etapas nativas',async()=>{
 const [app,features,wizard,dialogs]=await Promise.all([source('app.js'),source('features-ui.js'),source('quote-wizard.js'),source('admin-client-dialogs-ui.js')]);
 assert.match(app,/case'manual-admin':openClientDialog\('budget'\)/);assert.match(dialogs,/data-use-existing/);assert.match(wizard,/const PHASES=\['Cliente','Trabajos y precios','Costos y rentabilidad','Revisión'\]/);assert.match(wizard,/ETAPA 1 DE 4/);assert.match(wizard,/ETAPA 4 DE 4/);assert.match(features,/wizard\.open/);assert.doesNotMatch(features,/<iframe|presupuestos\?embed|features-ui-legacy/);
});

test('precio sugerido y rentabilidad pertenecen al Cotizador canónico',async()=>{
 const [wizard,model]=await Promise.all([source('quote-wizard.js'),source('quote-wizard-model.js')]);
 assert.match(wizard,/Precio final automático/);assert.match(wizard,/Referencia Tarifario/);assert.match(wizard,/El precio actual alcanza el margen objetivo/);assert.match(wizard,/Usar sugerido/);assert.match(wizard,/data-qw-final-price/);assert.match(model,/suggestedPriceForMargin/);assert.match(model,/economicSnapshot/);
 assert.doesNotMatch(wizard,/presupuestos-bridge|amc-estimator|iframe/);
});

test('acciones generales mantienen busy global pero PDF directo no bloquea la pantalla',async()=>{
 const [app,busy,pdf]=await Promise.all([source('app.js'),source('amc-busy.js'),source('quote-pdf-controller.js')]);
 assert.match(app,/window\.AMCBusy\?\.start\(\)/);assert.match(app,/window\.AMCBusy\?\.stop\(\)/);assert.match(busy,/amc-busy-logo-wrap/);assert.match(busy,/MIN_VISIBLE=420/);assert.match(busy,/overlay\.showModal\(\)/);assert.match(pdf,/Preparando PDF…/);assert.doesNotMatch(pdf,/AMCBusy|iframe|postMessage/);
});

test('compartir PDF envía un archivo real',async()=>{
 const [app,pdf,quotesUI,clientQuotesUI]=await Promise.all([source('app.js'),source('quote-pdf-actions.js'),source('admin-quotes-ui.js'),source('client-quotes-ui.js')]);
 assert.match(app,/from '.\/quote-pdf-actions\.js'/);assert.match(pdf,/new File\(\[blob\],name,\{type:'application\/pdf'\}\)/);assert.match(pdf,/navigator\.canShare/);assert.match(pdf,/navigator\.share/);assert.match(pdf,/AMCNative\?\.savePdf/);assert.match(quotesUI,/download-pdf-admin/);assert.match(clientQuotesUI,/download-quote-pdf/);
});

test('PDF pendiente se regenera directamente y permite reintento',async()=>{
 const [features,controller,generation,quotesUI]=await Promise.all([source('features-ui.js'),source('quote-pdf-controller.js'),source('quote-pdf-generation.js'),source('admin-quotes-ui.js')]);
 assert.match(features,/createQuotePdfController/);assert.match(features,/generatePdf:pdf\.generatePdf/);assert.match(controller,/const jobs=new Map\(\)/);assert.match(controller,/Preparando PDF…/);assert.match(controller,/Generar PDF/);assert.match(controller,/createAndAttach/);assert.match(generation,/\/api\/quotes\/'\+quoteId\+'\/pdf/);assert.match(quotesUI,/generate-pdf-admin/);assert.doesNotMatch(controller,/iframe|postMessage|amc:pdf-ready|amc:pdf-error/);
});

test('detalle admin abre presupuesto exacto y mantiene un solo menú de acciones',async()=>{
 const [app,quotesUI]=await Promise.all([source('app.js'),source('admin-quotes-ui.js')]);
 assert.match(quotesUI,/Trabajos incluidos/);assert.match(quotesUI,/Importe/);assert.match(quotesUI,/Datos internos/);assert.match(app,/page\.startsWith\('presupuesto-admin\/'\)/);assert.match(app,/detail\.removeAttribute\('open'\)/);
});

test('programación usa etiquetas claras y vuelve a la obra exacta',async()=>{
 const [app,planning,worksUI]=await Promise.all([source('app.js'),source('planning-ui.js'),source('admin-works-ui.js')]);
 assert.match(planning,/Qué estás agendando/);assert.match(planning,/Obra · trabajo con presupuesto aceptado/);assert.match(planning,/Proponer al cliente · espera confirmación/);assert.match(planning,/type:'calendar-saved'/);assert.match(app,/obra-admin/);assert.match(worksUI,/Situación de la fecha/);
});

test('fecha y equipo de obra usan una sola fuente de verdad',async()=>{
 const [app,planning,teamUI,worksUI,dialog]=await Promise.all([source('app.js'),source('planning-ui.js'),source('team-ui.js'),source('admin-works-ui.js'),source('admin-team-dialog-ui.js')]);
 assert.match(planning,/Equipo de trabajo:.*se administra desde la ficha de la obra/s);assert.match(worksUI,/Equipo previsto al presupuestar/);assert.match(worksUI,/Equipo de esta obra/);assert.match(app,/Primero programá y confirmá la fecha de la obra/);assert.match(dialog,/Inicio programado:/);assert.match(teamUI,/Fecha pendiente de reprogramación/);
});

test('detalle de obra conserva resumen económico y perfil actual del cliente',async()=>{
 const [worksUI,helpers]=await Promise.all([source('admin-works-ui.js'),source('admin-helpers.js')]);
 assert.match(helpers,/agendaClient/);assert.match(worksUI,/Teléfono:<\/b>/);assert.match(worksUI,/Dirección:<\/b>/);assert.match(worksUI,/Resumen económico/);assert.match(worksUI,/Costo estimado/);assert.match(worksUI,/Ganancia estimada/);assert.match(worksUI,/Registrar o revisar costos reales/);
});

test('avisos, refresh y margen evitan trabajo duplicado',async()=>{
 const [app,wizard]=await Promise.all([source('app.js'),source('quote-wizard.js')]);
 assert.match(app,/const activeRequests=new Map\(\)/);assert.match(app,/if\(activeRequests\.has\(key\)\)return activeRequests\.get\(key\)/);assert.match(app,/clientStateSignature/);assert.match(wizard,/Precio final automático/);assert.match(wizard,/El precio actual alcanza el margen objetivo/);assert.doesNotMatch(wizard,/presupuestos-bridge/);
});

test('Respaldos abre una pantalla de sistema y no cae en Inicio',async()=>{
 const [app,system]=await Promise.all([source('app.js'),source('admin-system-ui.js')]);
 assert.match(app,/page==='respaldos'\)html=adminSystem\.backups\(\)/);assert.match(system,/Respaldo automático/);assert.match(system,/03:00 \(hora de Argentina\)/);assert.match(system,/Retención:<\/strong> 30 días/);assert.match(system,/Último respaldo correcto/);assert.match(system,/Errores del servidor en los últimos 15 minutos/);
});
