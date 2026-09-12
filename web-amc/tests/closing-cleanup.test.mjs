import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createApp} from '../server.mjs';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const origin='http://localhost:4180';

test('estimator comparison is explicit and integrated AMC notices avoid duplicate push',()=>{
  const html=read('../private/presupuestos-original.html');
  const app=read('../public/app.js');
  const notices=read('../public/notice-ui.js');
  const index=read('../public/index.html');
  const sw=read('../public/sw.js');
  const bridge=read('../public/presupuestos-bridge.js');
  const quotesUI=read('../public/admin-quotes-ui.js');
  assert.match(html,/Elegir estimación/);
  assert.match(html,/Precio base del trabajo:/);
  assert.match(html,/Movilidad:/);
  assert.match(html,/Materiales:/);
  assert.match(html,/Herramientas:/);
  assert.match(html,/Otros costos:/);
  assert.match(html,/Agregar esta opción al presupuesto/);
  assert.match(notices,/function showInternal\(notice\)/);
  assert.match(notices,/notice\.priority==='normal'/);
  assert.doesNotMatch(app,/function oldRequestDetail\(\)/);
  assert.match(app,/function requestDetail\(\)\{return state\.user\?hub\.detail\(page\.slice\(10\)\):auth\(\);\}/);
  assert.match(app,/page\.startsWith\('presupuesto-admin\/'\)/);
  assert.match(quotesUI,/selectedId\?quote\.id===selectedId:match\(quote\)/);
  assert.match(app,/page\.startsWith\('chat-admin\/'\)/);
  assert.match(app,/page\.startsWith\('chat-equipo\/'\)/);
  assert.match(index,/aria-live="assertive"/);
  assert.match(sw,/visibilityState==='visible'/);
  assert.match(sw,/postMessage\(\{type:'AMC_NOTICE'/);
  assert.match(sw,/\/assets\/amc-logo\.webp/);
  assert.match(bridge,/if\(embedded\)window\.alert=toast/);
  assert.match(bridge,/\.tabs,.app>\.header,#app-version,#view-home\{display:none!important\}/);
  assert.doesNotMatch(read('../public/pdf-logo.js'),/LOGO_JPG_B64|base64/);
});

test('external quote delivery can be rejected and quote notices use exact deep links',async()=>{
  const service=createApp({dbPath:':memory:',origin});
  service.addUser('owner@closing.test','Strong-Owner-2026!','AMC','admin');
  await new Promise(resolve=>service.server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+service.server.address().port;
  const actor=()=>({cookie:'',csrf:'',async call(path,body,status=200){const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:this.cookie,'X-CSRF-Token':this.csrf},...(body===undefined?{}:{body:JSON.stringify(body)})});const value=await response.json();assert.equal(response.status,status,JSON.stringify(value));if(response.headers.get('set-cookie'))this.cookie=response.headers.get('set-cookie').split(';')[0];if(value.csrf)this.csrf=value.csrf;return value;}});
  try{
    const admin=actor(),client=actor();
    await admin.call('/api/login',{email:'owner@closing.test',password:'Strong-Owner-2026!'});
    const lead=await admin.call('/api/admin/clients',{name:'Cliente externo',phone:'3548000001',town:'La Falda'},201);
    const leadRequest=await admin.call('/api/admin/requests',{leadId:lead.id,service:'Pintura',description:'Entrega externa',idempotencyKey:'closing-lead'},201);
    const external=await admin.call('/api/quotes',{requestId:leadRequest.id,externalId:'closing-external',version:'a'.repeat(64),number:'AMC-EXT',items:[{description:'Pintura'}],total:100000},201);
    await admin.call('/api/quotes/'+external.id+'/reject-manual',{},409);
    await admin.call('/api/quotes/'+external.id+'/accept-manual',{},409);
    await admin.call('/api/quotes/'+external.id+'/deliver',{channel:'PDF'});
    const revisedExternal=await admin.call('/api/quotes',{requestId:leadRequest.id,externalId:'closing-external',version:'d'.repeat(64),number:'AMC-EXT',items:[{description:'Pintura revisada'}],total:110000},201);
    let externalState=await admin.call('/api/state');assert.equal(externalState.quotes.find(q=>q.id===external.id).status,'Reemplazado');assert.equal(externalState.quotes.find(q=>q.id===revisedExternal.id).status,'Guardado');
    await admin.call('/api/quotes/'+external.id+'/deliver',{channel:'PDF'},409);
    await admin.call('/api/quotes/'+revisedExternal.id+'/accept-manual',{},409);
    await admin.call('/api/quotes/'+revisedExternal.id+'/deliver',{channel:'PDF'});
    await admin.call('/api/quotes/'+revisedExternal.id+'/reject-manual',{});
    await admin.call('/api/quotes/'+revisedExternal.id+'/reject-manual',{});
    assert.equal((await admin.call('/api/state')).quotes.find(q=>q.id===revisedExternal.id).status,'Rechazado');

    await client.call('/api/register',{email:'client@closing.test',password:'Client-Test-2026!',name:'Cliente AMC'});
    const request=await client.call('/api/requests',{name:'Cliente AMC',phone:'3548000002',town:'Valle Hermoso',service:'Albañilería',description:'Revoque',type:'presupuesto'},201);
    const quote=await admin.call('/api/quotes',{requestId:request.id,externalId:'closing-account',version:'b'.repeat(64),number:'AMC-LINK',items:[{description:'Revoque'}],total:200000},201);
    assert.equal((await client.call('/api/state')).notices.some(n=>n.url==='/#presupuesto/'+quote.id),false);
    const quotePdf=await admin.call('/api/upload',{mime:'application/pdf',base64:Buffer.from('%PDF-1.4 closing').toString('base64')},201);
    await admin.call('/api/quotes/'+quote.id+'/pdf',{pdfId:quotePdf.id});
    assert.ok((await client.call('/api/state')).notices.some(n=>n.url==='/#presupuesto/'+quote.id));
    await client.call('/api/quotes/'+quote.id+'/view',{});
    assert.ok((await admin.call('/api/state')).notices.some(n=>n.url==='/#presupuesto-admin/'+quote.id));
    await client.call('/api/quotes/'+quote.id+'/reply',{status:'Cambios solicitados',message:'Cambiar alcance'});
    const responseNotice=(await admin.call('/api/state')).notices.find(n=>n.title==='Cambios solicitados');
    assert.equal(responseNotice.url,'/#presupuesto-admin/'+quote.id);
    assert.equal(responseNotice.priority,'important');
    const acceptedRequest=await client.call('/api/requests',{name:'Cliente AMC',phone:'3548000002',town:'Valle Hermoso',service:'Pintura',description:'Otro trabajo',type:'presupuesto'},201);
    const acceptedQuote=await admin.call('/api/quotes',{requestId:acceptedRequest.id,externalId:'closing-accepted',version:'c'.repeat(64),number:'AMC-ACCEPT',items:[{description:'Pintura'}],total:300000},201);
    await client.call('/api/quotes/'+acceptedQuote.id+'/reply',{status:'Aceptado'});
    const acceptedNotice=(await admin.call('/api/state')).notices.find(n=>n.title==='Presupuesto aceptado'&&n.url.includes(acceptedQuote.id));
    assert.equal(acceptedNotice.url,'/#obra-admin/work-'+acceptedQuote.id);
    assert.equal(acceptedNotice.priority,'important');
  }finally{await new Promise(resolve=>service.server.close(resolve));}
});


test('external client work finalizes and releases the team without conformity',async()=>{
  const service=createApp({dbPath:':memory:',origin});
  service.addUser('owner-external@closing.test','Strong-Owner-2026!','AMC','admin');
  await new Promise(resolve=>service.server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+service.server.address().port;
  const actor=()=>({cookie:'',csrf:'',async call(path,body,status=200){const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:this.cookie,'X-CSRF-Token':this.csrf},...(body===undefined?{}:{body:JSON.stringify(body)})});const value=await response.json();assert.equal(response.status,status,JSON.stringify(value));if(response.headers.get('set-cookie'))this.cookie=response.headers.get('set-cookie').split(';')[0];if(value.csrf)this.csrf=value.csrf;return value;}});
  try{
    const admin=actor(),employee=actor();
    await admin.call('/api/login',{email:'owner-external@closing.test',password:'Strong-Owner-2026!'});
    const worker=await admin.call('/api/employees',{name:'Operario externo',email:'worker-external@closing.test',password:'Strong-Worker-2026!',dailyCost:50000},201);
    await employee.call('/api/login',{email:'worker-external@closing.test',password:'Strong-Worker-2026!'});
    const lead=await admin.call('/api/admin/clients',{name:'Cliente de la calle',phone:'3548555010',town:'La Falda'},201);
    const request=await admin.call('/api/admin/requests',{leadId:lead.id,service:'Pintura',description:'Pintura exterior',idempotencyKey:'external-finish-request'},201);
    const quote=await admin.call('/api/quotes',{requestId:request.id,externalId:'external-finish-quote',version:'e'.repeat(64),number:'AMC-EXT-FIN',items:[{description:'Pintura exterior'}],total:250000},201);
    await admin.call('/api/quotes/'+quote.id+'/deliver',{channel:'Personalmente'});
    const accepted=await admin.call('/api/quotes/'+quote.id+'/accept-manual',{},201);
    const workId=accepted.workId;
    const booking=await admin.call('/api/calendar-bookings',{kind:'Obra',status:'Confirmada',title:'Pintura exterior',workId,start:'2030-07-10',end:'2030-07-10',slot:'Mañana',teamIds:[],idempotencyKey:'external-finish-date'},201);
    const assigned=await admin.call('/api/works/'+workId+'/assign-team',{members:[{employeeId:worker.id,dailyCost:50000,estimatedDays:1}],time:'09:30',address:'La Falda',instructions:'Realizar pintura exterior',idempotencyKey:'external-finish-team'},201);
    const task=assigned.assignments[0];
    await employee.call('/api/assignments/'+task.id+'/report',{status:'En el lugar',category:'Durante',text:'Comienzo de trabajo',photos:[],idempotencyKey:'external-finish-start'},201);
    await employee.call('/api/assignments/'+task.id+'/report',{status:'Finalizada',category:'Después',text:'Trabajo terminado',photos:[],idempotencyKey:'external-finish-done'},201);
    let state=await admin.call('/api/state');
    const work=state.works.find(w=>w.id===workId);
    assert.equal(work.status,'Finalizado');
    assert.equal(state.requests.find(r=>r.id===request.id).status,'Cerrada');
    assert.equal(state.calendarBookings.find(b=>b.id===booking.id).status,'Finalizada');
    assert.equal(state.calendarEvents.some(e=>e.workId===workId),false);
    await admin.call('/api/calendar-bookings',{kind:'Reserva',status:'Confirmada',title:'Nuevo trabajo posible',start:'2030-07-10',end:'2030-07-10',slot:'Mañana',teamIds:[worker.id],idempotencyKey:'external-team-released'},201);
    const followUp=await admin.call('/api/assignments',{employeeId:worker.id,requestId:request.id,type:'Urgencia',day:'2030-07-11',time:'10:00',address:'La Falda',instructions:'Revisar un retoque sin reabrir la obra terminada',idempotencyKey:'external-follow-up'},201);
    await employee.call('/api/assignments/'+followUp.id+'/report',{status:'En el lugar',category:'Durante',text:'Revisión de retoque',photos:[],idempotencyKey:'external-follow-up-start'},201);
    assert.equal((await admin.call('/api/state')).works.find(w=>w.id===workId).status,'Finalizado');
    await employee.call('/api/assignments/'+followUp.id+'/report',{status:'Finalizada',category:'Después',text:'Retoque revisado',photos:[],idempotencyKey:'external-follow-up-done'},201);
    assert.equal((await admin.call('/api/state')).works.find(w=>w.id===workId).status,'Finalizado');
    const closure=await admin.call('/api/works/'+workId+'/closure',{summary:'Trabajo terminado y revisado en obra',photos:[],idempotencyKey:'external-internal-closure'},201);
    assert.equal(closure.status,'Cerrado internamente');
    assert.equal(closure.requiresConformity,false);
    state=await admin.call('/api/state');
    assert.equal(state.works.find(w=>w.id===workId).status,'Finalizado');
  }finally{await new Promise(resolve=>service.server.close(resolve));}
});
