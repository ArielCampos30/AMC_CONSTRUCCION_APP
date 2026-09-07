import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createApp} from '../server.mjs';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const origin='http://localhost:4180';

test('estimator comparison is explicit and integrated AMC notices avoid duplicate push',()=>{
  const html=read('../private/presupuestos-original.html');
  const app=read('../public/app.js');
  const index=read('../public/index.html');
  const sw=read('../public/sw.js');
  const bridge=read('../public/presupuestos-bridge.js');
  assert.match(html,/Estimación para presupuestar/);
  assert.match(html,/Precio base del trabajo:/);
  assert.match(html,/Movilidad:/);
  assert.match(html,/Materiales:/);
  assert.match(html,/Herramientas:/);
  assert.match(html,/Otros costos:/);
  assert.match(html,/Agregar esta opción al presupuesto/);
  assert.match(app,/function showInternalNotice/);
  assert.match(app,/notice\.priority==='normal'/);
  assert.match(app,/page\.startsWith\('presupuesto-admin\/'\)/);
  assert.match(app,/page\.startsWith\('chat-admin\/'\)/);
  assert.match(app,/page\.startsWith\('chat-equipo\/'\)/);
  assert.match(index,/aria-live="assertive"/);
  assert.match(sw,/visibilityState==='visible'/);
  assert.match(sw,/postMessage\(\{type:'AMC_NOTICE'/);
  assert.match(sw,/\/assets\/amc-icon\.png/);
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
    await admin.call('/api/quotes/'+external.id+'/deliver',{channel:'PDF'});
    await admin.call('/api/quotes/'+external.id+'/reject-manual',{});
    await admin.call('/api/quotes/'+external.id+'/reject-manual',{});
    assert.equal((await admin.call('/api/state')).quotes.find(q=>q.id===external.id).status,'Rechazado');

    await client.call('/api/register',{email:'client@closing.test',password:'12345678',name:'Cliente AMC'});
    const request=await client.call('/api/requests',{name:'Cliente AMC',phone:'3548000002',town:'Valle Hermoso',service:'Albañilería',description:'Revoque',type:'presupuesto'},201);
    const quote=await admin.call('/api/quotes',{requestId:request.id,externalId:'closing-account',version:'b'.repeat(64),number:'AMC-LINK',items:[{description:'Revoque'}],total:200000},201);
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
