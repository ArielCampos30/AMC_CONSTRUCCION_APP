import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createApp} from '../server.mjs';
import {buildQuotePdfDocument,makeQuotePdf} from '../public/quote-pdf-document.js';

test('generador directo produce un PDF real desde el presupuesto canónico sin iframe',async()=>{
 const previousDocument=globalThis.document,previousFetch=globalThis.fetch;
 const logo=readFileSync(new URL('../public/assets/amc-logo-pdf.jpg',import.meta.url));
 try{
  globalThis.document={createElement(name){assert.equal(name,'canvas');return {getContext(){return {font:'',measureText(value){return {width:String(value).length*6};}};}};}};
  globalThis.fetch=async url=>{assert.equal(url,'/assets/amc-logo-pdf.jpg');return {ok:true,arrayBuffer:async()=>logo.buffer.slice(logo.byteOffset,logo.byteOffset+logo.byteLength)};};
  const model=buildQuotePdfDocument({
   quote:{number:'AMC-2026-0042',date:'2026-09-12T10:00:00.000Z',items:[{description:'Revoque fino interior'},{description:'Pintura completa'}],total:955000,validity:'10',payment:'50% anticipo',notes:'Incluye limpieza final.'},
   request:{name:'Cliente prueba',town:'La Falda'},client:{name:'Cliente prueba',phone:'3548555555',town:'La Falda'},settings:{company:'AMC Construcciones y Arreglos',advance:30,conditions:'Presupuesto sujeto a alcance acordado.',phone:'3548123456'}
  });
  assert.equal(model.client,'Cliente prueba');assert.equal(model.items.length,2);assert.equal(model.total,955000);assert.equal(model.date,'2026-09-12');
  const blob=await makeQuotePdf(model),bytes=Buffer.from(await blob.arrayBuffer());
  assert.equal(blob.type,'application/pdf');assert.equal(bytes.subarray(0,8).toString(),'%PDF-1.4');assert.ok(bytes.length>1000);
 }finally{
  if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;
  if(previousFetch===undefined)delete globalThis.fetch;else globalThis.fetch=previousFetch;
 }
});

test('cliente recibe el aviso de presupuesto sólo después de adjuntar el PDF y sin duplicados',async()=>{
 const origin='http://localhost:4180',app=createApp({dbPath:':memory:',origin});
 app.addUser('owner@pdf-ready.test','Strong-Owner-2026!','AMC','admin');
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+app.server.address().port;
 const actor=()=>({cookie:'',csrf:'',async call(path,body,status=200){const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:this.cookie,'X-CSRF-Token':this.csrf},...(body===undefined?{}:{body:JSON.stringify(body)})});const data=await response.json();assert.equal(response.status,status,JSON.stringify(data));if(response.headers.get('set-cookie'))this.cookie=response.headers.get('set-cookie').split(';')[0];if(data.csrf)this.csrf=data.csrf;return data;}});
 try{
  const admin=actor(),client=actor();
  await admin.call('/api/login',{email:'owner@pdf-ready.test',password:'Strong-Owner-2026!'});
  await client.call('/api/register',{email:'client@pdf-ready.test',password:'Strong-Client-2026!',name:'Cliente PDF'});
  const request=await client.call('/api/requests',{name:'Cliente PDF',phone:'3548555000',town:'La Falda',description:'Pintura del living',service:'Pintura',type:'presupuesto'},201);
  const before=(await client.call('/api/state')).notices.filter(notice=>notice.title==='Tu presupuesto está listo').length;
  const quote=await admin.call('/api/quotes',{requestId:request.id,externalId:'pdf-ready-quote',version:'a'.repeat(64),items:[{description:'Pintura del living'}],total:180000,validity:'10'},201);
  assert.equal(quote.status,'Enviado');assert.equal(quote.pdfPending,true);assert.equal(quote.pdf,'');
  assert.equal((await client.call('/api/state')).notices.filter(notice=>notice.title==='Tu presupuesto está listo').length,before);
  const uploaded=await admin.call('/api/upload',{mime:'application/pdf',base64:Buffer.from('%PDF-1.4\nAMC direct').toString('base64')},201);
  const attached=await admin.call('/api/quotes/'+quote.id+'/pdf',{pdfId:uploaded.id});
  assert.ok(attached.pdf);assert.equal(attached.pdfPending,false);
  let state=await client.call('/api/state'),ready=state.notices.filter(notice=>notice.title==='Tu presupuesto está listo');
  assert.equal(ready.length,before+1);assert.equal(ready.at(-1).url,'/#presupuesto/'+quote.id);assert.ok(state.quotes.find(item=>item.id===quote.id)?.pdf);
  await admin.call('/api/quotes/'+quote.id+'/pdf',{pdfId:uploaded.id});
  state=await client.call('/api/state');ready=state.notices.filter(notice=>notice.title==='Tu presupuesto está listo');assert.equal(ready.length,before+1);
 }finally{await new Promise(resolve=>app.server.close(resolve));}
});

test('flujo activo del cotizador no usa refresh completo ni iframe para guardar o generar PDF',()=>{
 const save=readFileSync(new URL('../public/quote-save-controller.js',import.meta.url),'utf8');
 const clients=readFileSync(new URL('../public/quote-client-create-controller.js',import.meta.url),'utf8');
 const pdf=readFileSync(new URL('../public/quote-pdf-controller.js',import.meta.url),'utf8');
 const wrapper=readFileSync(new URL('../public/features-ui.js',import.meta.url),'utf8');
 assert.doesNotMatch(save,/\brefresh\b|\/api\/state|iframe|postMessage/i);
 assert.doesNotMatch(clients,/\brefresh\b|\/api\/state|iframe/i);
 assert.doesNotMatch(pdf,/\/api\/state|iframe|postMessage|AMCBusy/i);
 assert.match(wrapper,/generatePdf:pdf\.generatePdf/);assert.doesNotMatch(wrapper,/generatePdf:legacy\.generatePdf/);
});
