import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createApp} from '../server.mjs';

const source=name=>readFile(new URL('../public/'+name,import.meta.url),'utf8');
const origin='http://localhost:4180';

test('administración visible no conserva accesos duplicados del estimador',async()=>{
 const [admin,system]=await Promise.all([source('admin-ui.js'),source('admin-system-ui.js')]);
 assert.doesNotMatch(admin,/Estimador|Presupuestos\?embed/);assert.doesNotMatch(system,/Estimador/);
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
 assert.match(chat,/floatingEmployeeContacts/);assert.match(chat,/clientContacts/);assert.match(chat,/label:'Clientes'/);assert.match(chat,/label:'Empleados'/);assert.match(chat,/\/api\/client-chat\/messages/);
 assert.match(float,/function showGroups\(\)/);assert.match(float,/submitCustom/);assert.match(chat,/status\.textContent=''/);assert.match(team,/return 'message-sent'/);
 assert.doesNotMatch(chat,/location\.reload|toast\('Mensaje enviado\.'\)/);
});

test('chat de pantalla completa no apila el flotante y bloquea doble envío',async()=>{
 const [app,chat,float]=await Promise.all([source('app.js'),source('chat-features.js'),source('floating-chat.js')]);
 assert.match(app,/page\.startsWith\('chat-admin\/'\)/);assert.match(chat,/fullPageChat/);assert.match(chat,/floating\.close\?\.\(\)/);assert.match(chat,/form\.dataset\.sending==='1'/);assert.match(chat,/sendButton\.disabled=true/);assert.match(chat,/sendButton\.disabled=false/);assert.match(float,/body\.full-chat-page \.floating-chat-button,body\.quote-wizard-route \.floating-chat-button\{display:none!important\}/);
});

test('presupuesto rápido usa datos directos y cuatro etapas nativas',async()=>{
 const [app,features,wizard,dialogs]=await Promise.all([source('app.js'),source('features-ui.js'),source('quote-wizard.js'),source('admin-client-dialogs-ui.js')]);
 assert.match(app,/case'manual-admin':openClientDialog\('budget'\)/);assert.match(dialogs,/data-use-existing/);assert.match(wizard,/data-qw-client/);assert.match(wizard,/data-qw-new-client/);assert.match(features,/wizard\.open/);assert.doesNotMatch(features,/<iframe|presupuestos\?embed|features-ui-legacy/);
});
