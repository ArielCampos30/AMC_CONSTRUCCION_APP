import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createApp} from '../server.mjs';

const origin='http://localhost:4180';

test('admin v3 exposes the five primary destinations and responsive views',async()=>{
  const [app,css,hub,worker,dashboard]=await Promise.all([
    readFile(new URL('../public/app.js',import.meta.url),'utf8'),
    readFile(new URL('../public/admin-v3.css',import.meta.url),'utf8'),
    readFile(new URL('../public/project-hub.js',import.meta.url),'utf8'),
    readFile(new URL('../public/sw.js',import.meta.url),'utf8'),
    readFile(new URL('../public/admin-dashboard-ui.js',import.meta.url),'utf8')
  ]);
  const nav="[['inicio','Inicio','⌂'],['solicitudes','Solicitudes','▤'],['presupuestos','Presupuestos','▤'],['obras','Obras','⌂'],['mas-admin','Más','•••']]";
  assert.ok(app.includes(nav));
  assert.match(dashboard,/Solicitudes nuevas.*Presupuestos esperando respuesta.*Presupuestos aceptados sin programar.*Obras en curso.*Mensajes sin leer/s);
  assert.match(app,/from '.\/admin-dashboard-ui\.js'/);\n  assert.match(app,/html=adminDashboard\(\)/);\n  assert.doesNotMatch(app,/function adminHome\(\)/);\n  assert.match(app,/Nuevas.*Revisando.*Visita pendiente.*Presupuestadas.*No tomadas.*Todas/s);
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
  const system=await readFile(new URL('../public/admin-system-ui.js',import.meta.url),'utf8');
  assert.match(system,/\['Gestión'.*'Chat'.*'Clientes'.*'Empleados'/s);
  assert.match(system,/\['Herramientas'.*'Tarifario y cotizador'.*'Resumen diario'/s);
  assert.match(system,/\['Sistema'.*'Configuración'.*'Respaldos'/s);
});

test('Editar abre el presupuesto exacto y no reinicia sus importes',async()=>{
  const [app,features,bridge]=await Promise.all([
    readFile(new URL('../public/app.js',import.meta.url),'utf8'),
    readFile(new URL('../public/features-ui.js',import.meta.url),'utf8'),
    readFile(new URL('../public/presupuestos-bridge.js',import.meta.url),'utf8')
  ]);
  assert.match(app,/data-action="editor" data-id="\$\{r\.id\}" data-quote="\$\{q\.id\}"/);
  assert.match(app,/features\.openEditor\(b\.dataset\.id\|\|'',b\.dataset\.quote\|\|''\)/);
  assert.match(features,/let threadId='',quoteRequest='',quoteEdit='',quoteMode='',selectedClient=''/);
  assert.match(features,/quoteEdit\?'&quote='/);
  assert.match(features,/function openEditor\(requestId='',quoteId='',mode=''\)/);
  assert.match(bridge,/function loadQuoteForEdit\(quoteId\)/);
  assert.match(bridge,/db\.quotes\|\|\[\]\)\.find\(q=>q\.id===storedQuote\.externalId\)/);
  assert.match(bridge,/const editLoaded=editQuoteId\?loadQuoteForEdit\(editQuoteId\):false/);
  assert.match(bridge,/if\(!editQuoteId&&editParams\.get\('solicitud'\)\)importRequest\(false\)/);
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

test('duplicate client phone uses a visible AMC notice instead of failing silently',async()=>{
  const [app,confirm]=await Promise.all([
    readFile(new URL('../public/app.js',import.meta.url),'utf8'),
    readFile(new URL('../public/amc-confirm.js',import.meta.url),'utf8')
  ]);
  assert.match(app,/Teléfono ya registrado/);
  assert.match(app,/singleAction:true/);
  assert.match(app,/No se guardaron cambios|tel\[eé\]fono ya est/);
  assert.match(confirm,/cancelButton\.hidden=options\.singleAction===true/);
  assert.match(confirm,/type="button"/);
  assert.match(confirm,/confirmButton\.onclick=\(\)=>dialog\.close\('confirm'\)/);
  assert.match(confirm,/cancelButton\.onclick=\(\)=>dialog\.close\('cancel'\)/);
  assert.match(confirm,/justify-content:center/);
  assert.doesNotMatch(confirm,/method="dialog"/);
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
    await client.call('/api/register',{email:'cliente@amc.test',password:'Client-Test-2026!',name:'Cliente'});
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


test('client search filters live without reloading or rerendering the whole page',async()=>{
  const [app,directory,features]=await Promise.all([
    readFile(new URL('../public/app.js',import.meta.url),'utf8'),
    readFile(new URL('../public/client-directory.js',import.meta.url),'utf8'),
    readFile(new URL('../public/features-ui.js',import.meta.url),'utf8')
  ]);
  assert.match(directory,/id="client-search-input"/);
  assert.match(directory,/id="client-search-results"/);
  assert.match(directory,/id="client-directory"/);
  assert.doesNotMatch(directory,/id="client-search"/);
  assert.match(app,/e\.target\.id==='client-search-input'.*directory\.search\(e\.target\.value\).*refreshClientDirectory\(true\)/s);
  assert.match(app,/e\.target\.id==='budget-client-search'.*features\.change\(e\.target\)/s);
  assert.match(app,/case'clients-filter':directory\.setFilter\(b\.dataset\.value\);refreshClientDirectory\(\)/);
  assert.doesNotMatch(app,/f\.id==='client-search'/);
  assert.doesNotMatch(app,/location\.reload\(/);
  assert.doesNotMatch(app,/location\.assign\(/);
  assert.match(app,/data-action="retry-app"/);
  assert.match(app,/location\.hash=target\.hash\|\|'#avisos'/);
  assert.match(features,/if\(target\.id==='budget-client-search'\)/);
});

test('floating admin chat starts by type and sends messages without reload, spinner or sent toast',async()=>{
  const [app,features,floating,team]=await Promise.all([
    readFile(new URL('../public/app.js',import.meta.url),'utf8'),
    readFile(new URL('../public/features-ui.js',import.meta.url),'utf8'),
    readFile(new URL('../public/floating-chat.js',import.meta.url),'utf8'),
    readFile(new URL('../public/team-ui.js',import.meta.url),'utf8')
  ]);
  assert.match(features,/label:'Clientes'/);
  assert.match(features,/label:'Empleados'/);
  assert.match(features,/floatingEmployeeContacts/);
  assert.match(features,/floatingClientContacts/);
  assert.match(features,/conversations>1\?c\.conversations\+' conversaciones/);
  assert.match(floating,/function showGroups\(\)/);
  assert.match(floating,/chat-group-list/);
  assert.match(floating,/submitCustom/);
  assert.match(floating,/contact\.kind==='employee'/);
  assert.match(app,/chatMutation=url==='\/api\/staff-chat\/messages'/);
  assert.match(app,/\^\\\/api\\\/requests\\\/\[\^\/\]\+\\\/messages\$/);
  assert.match(app,/if\(featureResult==='message-sent'\)\{dirty=false;return;\}/);
  assert.match(app,/if\(teamResult==='message-sent'\)\{dirty=false;return;\}/);
  assert.doesNotMatch(app,/toast\('Mensaje enviado\.'\)/);
  assert.match(team,/return 'message-sent'/);
  assert.match(features,/status\.textContent=''/);
});

test('full admin chat never stacks the floating chat and blocks double send',async()=>{
  const [app,features,floating]=await Promise.all([
    readFile(new URL('../public/app.js',import.meta.url),'utf8'),
    readFile(new URL('../public/features-ui.js',import.meta.url),'utf8'),
    readFile(new URL('../public/floating-chat.js',import.meta.url),'utf8')
  ]);
  assert.match(app,/page\.startsWith\('chat-admin\/'\)\)\{features\.selectChat/);
  assert.doesNotMatch(app,/page\.startsWith\('chat-admin\/'\)\)\{features\.openChat/);
  assert.match(features,/fullPageChat=.*chat-admin/s);
  assert.match(features,/floating\.close\?\.\(\)/);
  assert.match(features,/form\.dataset\.sending==='1'/);
  assert.match(features,/sendButton\.disabled=true/);
  assert.match(features,/sendButton\.disabled=false/);
  assert.match(floating,/body\.full-chat-page \.floating-chat-button\{display:none!important\}/);
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
  assert.match(bridge,/if\(!editQuoteId&&editParams\.get\('solicitud'\)\)importRequest\(false\)/);
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

test('mutating actions use one shared spinner without floating loading messages',async()=>{
  const [app,bridge,index,server,busy,pdf]=await Promise.all([
    readFile(new URL('../public/app.js',import.meta.url),'utf8'),
    readFile(new URL('../public/presupuestos-bridge.js',import.meta.url),'utf8'),
    readFile(new URL('../public/index.html',import.meta.url),'utf8'),
    readFile(new URL('../server.mjs',import.meta.url),'utf8'),
    readFile(new URL('../public/amc-busy.js',import.meta.url),'utf8'),
    readFile(new URL('../public/quote-pdf-actions.js',import.meta.url),'utf8')
  ]);
  assert.match(index,/amc-busy\.js/);
  assert.match(server,/amc-busy\.js/);
  assert.match(app,/window\.AMCBusy\?\.start\(\)/);
  assert.match(app,/window\.AMCBusy\?\.stop\(\)/);
  assert.match(bridge,/window\.AMCBusy\?\.start\(\)/);
  assert.match(bridge,/window\.AMCBusy\?\.stop\(\)/);
  assert.match(busy,/amc-busy-logo-wrap/);
  assert.match(busy,/amc-busy-ring/);
  assert.match(busy,/MIN_VISIBLE=420/);
  assert.match(busy,/amc-logo\.webp/);
  assert.match(busy,/document\.createElement\('dialog'\)/);
  assert.match(busy,/overlay\.showModal\(\)/);
  assert.match(busy,/overlay\.close\(\)/);
  assert.match(busy,/event=>event\.preventDefault\(\)/);
  assert.doesNotMatch(busy,/amc-busy-spinner/);
  assert.doesNotMatch(app,/function loadingLabel/);
  assert.doesNotMatch(app,/Enviando presupuesto…/);
  assert.doesNotMatch(app,/pendingOperations/);
  assert.doesNotMatch(app,/dataset\.busy/);
  assert.match(app,/toast\('Se creó la obra\.'\)/);
  assert.match(bridge,/Se creó la obra\./);
  assert.equal((app.match(/\bfetch\(/g)||[]).length+(pdf.match(/\bfetch\(/g)||[]).length,2);
  assert.equal((bridge.match(/\bfetch\(/g)||[]).length,1);
});

test('PDF sharing sends a real PDF file instead of a raw media URL',async()=>{
  const [app,pdf]=await Promise.all([
    readFile(new URL('../public/app.js',import.meta.url),'utf8'),
    readFile(new URL('../public/quote-pdf-actions.js',import.meta.url),'utf8')
  ]);
  assert.match(app,/from '.\/quote-pdf-actions\.js'/);
  assert.match(pdf,/function pdfFileName\(q\)/);
  assert.match(pdf,/async function pdfBlob\(q\)/);
  assert.match(pdf,/export async function downloadQuotePdf\(q\)/);
  assert.match(pdf,/export async function shareQuotePdf\(q\)/);
  assert.match(pdf,/new File\(\[blob\],name,\{type:'application\/pdf'\}\)/);
  assert.match(pdf,/navigator\.canShare\?\.\(\{files:\[file\]\}\)/);
  assert.match(pdf,/navigator\.share\(\{title:'Presupuesto AMC',text:q\?\.number\|\|'Presupuesto AMC',files:\[file\]\}\)/);
  assert.match(pdf,/window\.AMCNative\?\.savePdf/);
  assert.match(app,/data-action="download-pdf-admin"/);
  assert.match(app,/data-action="download-quote-pdf"/);
  assert.doesNotMatch(pdf,/navigator\.share\(\{title:'Presupuesto AMC',url/);
  assert.doesNotMatch(pdf,/Enlace al PDF copiado/);
  assert.doesNotMatch(app,/function pdfFileName\(q\)/);
});

test('pending PDF can be regenerated and returns to the exact quote',async()=>{
  const [app,features,bridge,generation]=await Promise.all([
    readFile(new URL('../public/app.js',import.meta.url),'utf8'),
    readFile(new URL('../public/features-ui.js',import.meta.url),'utf8'),
    readFile(new URL('../public/presupuestos-bridge.js',import.meta.url),'utf8'),
    readFile(new URL('../public/quote-pdf-generation.js',import.meta.url),'utf8')
  ]);
  assert.match(app,/data-action="generate-pdf-admin"/);
  assert.match(app,/features\.generatePdf\(b\.dataset\.id\|\|'',b\.dataset\.quote\|\|''\)/);
  assert.match(features,/pdfJob=null/);
  assert.match(features,/function generatePdf\(requestId='',quoteId=''\)/);
  assert.match(features,/id='amc-pdf-generator'/);
  assert.match(features,/frame\.hidden=true/);
  assert.match(features,/generatePdf=1/);
  assert.match(features,/amc:pdf-ready/);
  assert.match(features,/amc:pdf-error/);
  assert.match(features,/onPdfReady\?\.\(data\)/);
  assert.match(bridge,/async function generatePendingPdf\(quoteId\)/);
  assert.match(bridge,/await import\('\/quote-pdf-generation\.js'\)/);
  assert.match(bridge,/createAndAttach/);
  assert.match(generation,/export async function createAndAttach/);
  assert.match(generation,/makePdf\(document\)/);
  assert.match(generation,/\/api\/upload/);
  assert.match(generation,/\/api\/quotes\/'\+quoteId\+'\/pdf/);
  assert.match(bridge,/type:'amc:pdf-ready'/);
  assert.match(bridge,/No pudimos generar el PDF/);
  assert.match(bridge,/type:'amc:pdf-error'/);
  assert.doesNotMatch(app,/<span>PDF pendiente<\/span>/);
  assert.equal((bridge.match(/makePdf\(quoteForDocument\(draft\)\)/g)||[]).length,0);
});

test('admin budget detail opens the exact quote and only one overflow menu stays open',async()=>{
  const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
  assert.match(app,/function adminQuoteDetail\(\)/);
  assert.match(app,/state\.quotes\.find\(q=>q\.id===id\)/);
  assert.match(app,/Trabajos incluidos/);
  assert.match(app,/Importe/);
  assert.match(app,/Datos internos/);
  assert.match(app,/page\.startsWith\('presupuesto-admin\/'\)\)html=adminQuoteDetail\(\)/);
  assert.match(app,/href="#presupuesto-admin\/\$\{encodeURIComponent\(q\.id\)\}"/);
  assert.match(app,/const actionMenu=e\.target\.closest\('\.admin-v3-actions details'\)/);
  assert.match(app,/if\(!actionMenu\)document\.querySelectorAll\('\.admin-v3-actions details\[open\]'\)/);
  assert.match(app,/detail\.removeAttribute\('open'\)/);
  assert.match(app,/if\(detail!==current\)detail\.removeAttribute\('open'\)/);
});

test('calendar programming uses clear labels and returns to the exact work',async()=>{
  const [app,planning]=await Promise.all([
    readFile(new URL('../public/app.js',import.meta.url),'utf8'),
    readFile(new URL('../public/planning-ui.js',import.meta.url),'utf8')
  ]);
  assert.match(planning,/Qué estás agendando/);
  assert.match(planning,/Obra · trabajo con presupuesto aceptado/);
  assert.match(planning,/Reserva · apartar una fecha/);
  assert.match(planning,/Bloqueo · no disponible/);
  assert.match(planning,/Cómo queda la fecha/);
  assert.match(planning,/Proponer al cliente · espera confirmación/);
  assert.match(planning,/Confirmada · fecha ya acordada/);
  assert.match(planning,/Tentativa · sólo interna/);
  assert.match(planning,/status:w\.start\?'Confirmada':r\?\.leadId\?'Confirmada':'Propuesta'/);
  assert.match(planning,/type:'calendar-saved'/);
  assert.match(app,/navigate\('obra-admin\/'\+encodeURIComponent\(planningResult\.workId\)\)/);
  assert.match(app,/Obra programada\. La fecha quedó confirmada\./);
  assert.match(app,/Situación de la fecha/);
  assert.match(app,/Propuesta enviada al cliente/);
});

test('work date and team assignment use one clear source of truth',async()=>{
  const [app,planning,teamServer,teamUi]=await Promise.all([
    readFile(new URL('../public/app.js',import.meta.url),'utf8'),
    readFile(new URL('../public/planning-ui.js',import.meta.url),'utf8'),
    readFile(new URL('../team.mjs',import.meta.url),'utf8'),
    readFile(new URL('../public/team-ui.js',import.meta.url),'utf8')
  ]);
  assert.match(planning,/Equipo de trabajo:.*se administra desde la ficha de la obra/s);
  assert.match(planning,/active=\(s\.calendarBookings\|\|\[\]\)\.filter\(b=>b\.workId===w\.id/);
  assert.match(planning,/current=active\.find\(b=>b\.id===w\.calendarBookingId\)/);
  assert.match(app,/Equipo previsto al presupuestar/);
  assert.match(app,/Equipo de esta obra/);
  assert.match(app,/team\.length\?'Editar equipo':'Asignar equipo'/);
  assert.match(app,/Primero programá y confirmá la fecha de la obra/);
  assert.match(app,/actualMap=new Map\(actual\.map/);
  assert.match(app,/Inicio programado:/);
  assert.match(app,/Si necesitás cambiar la fecha, usá Reprogramar/);
  const teamDialog=app.slice(app.indexOf('function openAssignTeamDialog'),app.indexOf('function openLinkClientDialog'));assert.doesNotMatch(teamDialog,/field\('Fecha/);
  assert.match(teamServer,/function workAssignments\(work\)/);
  assert.match(teamServer,/if\(!work\.start\)fail\(409,'Primero programá y confirmá la fecha de la obra/);
  assert.match(teamServer,/calendarBooking.*teamIds:rows\.map/s);
  assert.match(teamServer,/schedulePending/);
  assert.match(teamUi,/A reprogramar/);
  assert.match(teamUi,/Fecha pendiente de reprogramación/);
});

test('work detail is compact, accurate and uses the current client profile',async()=>{
  const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
  assert.match(app,/adminAgendaClient=id=>/);
  assert.match(app,/adminRequestContact=r=>/);
  assert.match(app,/contact=adminRequestContact\(r\)/);
  assert.match(app,/clientAddress=contact\.address\|\|contact\.town/);
  assert.match(app,/Teléfono:<\/b>/);
  assert.match(app,/Dirección:<\/b>/);
  assert.match(app,/internalAdminNote=\/\^Presupuesto iniciado por Administración/);
  assert.match(app,/workDescription=\(q\?\.items\|\|\[\]\)/);
  assert.match(app,/workTitle=\(q\?\.items\|\|\[\]\)/);
  assert.match(app,/displayStatus=w\.status==='Presupuesto aceptado'\?'Obra creada'/);
  assert.match(app,/Resumen económico/);
  assert.match(app,/Costo estimado/);
  assert.match(app,/Ganancia estimada/);
  assert.match(app,/hasActualCosts\?/);
  assert.match(app,/photos\.length\?/);
  assert.match(app,/notes\?/);
  assert.match(app,/Registrar o revisar costos reales/);
  assert.match(app,/#presupuesto-admin\/\$\{encodeURIComponent\(q\.id\)\}/);
  assert.doesNotMatch(app,/<h2>Costos reales de personal<\/h2>/);
  assert.doesNotMatch(app,/Todavía no hay fotos de avance/);
  assert.doesNotMatch(app,/Sin notas internas\./);
  assert.doesNotMatch(app,/href="#solicitud\/\$\{encodeURIComponent\(r\.id\)\}">Ver<\/a>/);
});

test('notification, refresh and margin UI avoid duplicate work',async()=>{
  const [app,bridge]=await Promise.all([readFile(new URL('../public/app.js',import.meta.url),'utf8'),readFile(new URL('../public/presupuestos-bridge.js',import.meta.url),'utf8')]);
  assert.match(app,/const activeRequests=new Map\(\)/);
  assert.match(app,/if\(activeRequests\.has\(key\)\)return activeRequests\.get\(key\)/);
  assert.match(app,/instantRequests=new Set\(\['\/api\/notices\/read'/);
  assert.equal((app.match(/const link=e\.target\.closest\('\[data-notice\]'\)/g)||[]).length,1);
  assert.match(app,/clientStateSignature/);
  assert.match(app,/state\.user\?\.role!=='client'\|\|changed/);
  assert.match(app,/minimum=state\.user\.role==='client'&&!chatPage\?12000:5000/);
  assert.match(bridge,/Precio final automático/);
  assert.match(bridge,/Total calculado por trabajos/);
  assert.match(bridge,/El precio actual alcanza el margen objetivo/);
  assert.match(bridge,/Usar .* como precio final/);
});


test('Respaldos abre una pantalla de sistema y no cae en Inicio',async()=>{
  const [app,system]=await Promise.all([
    readFile(new URL('../public/app.js',import.meta.url),'utf8'),
    readFile(new URL('../public/admin-system-ui.js',import.meta.url),'utf8')
  ]);
  assert.match(app,/page==='respaldos'\)html=adminSystem\.backups\(\)/);
  assert.match(system,/const backups=\(\)=>/);
  assert.match(system,/Respaldo automático/);
  assert.match(system,/03:00 \(hora de Argentina\)/);
  assert.match(system,/Retención:<\/strong> 30 días/);
  assert.match(system,/No necesitás descargar, subir ni confirmar nada/);
  assert.match(system,/Una restauración se hace sólo ante una falla o pérdida real de datos/);
  assert.match(system,/Último respaldo correcto/);
  assert.match(system,/Errores del servidor en los últimos 15 minutos/);
  assert.match(system,/backupStatus/);
});
