import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createApp} from '../server.mjs';
import {makeQuotePdf} from '../public/quote-pdf-document.js';

async function withPdfRuntime(run){
 const previousDocument=globalThis.document,previousFetch=globalThis.fetch;
 const logo=readFileSync(new URL('../public/assets/amc-logo-pdf.jpg',import.meta.url));
 try{
  globalThis.document={createElement(name){assert.equal(name,'canvas');return {getContext(){return {font:'',measureText:value=>({width:String(value).length*6})};}};}};
  globalThis.fetch=async url=>{assert.equal(url,'/assets/amc-logo-pdf.jpg');return {ok:true,arrayBuffer:async()=>logo.buffer.slice(logo.byteOffset,logo.byteOffset+logo.byteLength)};};
  return await run();
 }finally{
  if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;
  if(previousFetch===undefined)delete globalThis.fetch;else globalThis.fetch=previousFetch;
 }
}

test('el generador PDF canónico carga el logo y crea documentos multipágina',async()=>withPdfRuntime(async()=>{
 const items=Array.from({length:80},(_,i)=>({clientDescription:`Trabajo ${i+1} con una descripción extensa para comprobar el salto correcto entre páginas del documento.`}));
 const blob=await makeQuotePdf({company:'AMC Construcciones y Arreglos',number:'AMC-REAL-1',date:'06/09/2026',client:'Juan Pérez',phone:'3548000000',location:'Valle Hermoso',items,total:1000000,validity:10,payment:'A convenir',notes:'Prueba real multipágina'}),bytes=Buffer.from(await blob.arrayBuffer());
 assert.equal(bytes.subarray(0,5).toString(),'%PDF-');
 assert.ok(bytes.length>10000);
 assert.match(bytes.toString('latin1'),/\/Count ([2-9]|[1-9][0-9]+) /);
}));

test('el generador PDF canónico produce un archivo válido para un presupuesto simple',async()=>withPdfRuntime(async()=>{
 const blob=await makeQuotePdf({company:'AMC Construcciones y Arreglos',number:'AMC-SIMPLE-1',date:'08/09/2026',client:'Grace',phone:'3548406698',location:'Valle Hermoso',items:[{clientDescription:'Revoque fino'}],total:552000,validity:10,payment:'A convenir'}),bytes=Buffer.from(await blob.arrayBuffer());
 assert.equal(bytes.subarray(0,5).toString(),'%PDF-');
 assert.ok(bytes.length>5000);
}));

test('un presupuesto puede guardarse sin PDF y recibir el archivo después',async()=>{
 const origin='http://localhost:4180',app=createApp({dbPath:':memory:',origin});app.addUser('owner@amc.test','Strong-Owner-2026!','AMC','admin');await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port,actor=()=>({cookie:'',csrf:'',async call(path,body,status=200){const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:this.cookie,'X-CSRF-Token':this.csrf},...(body===undefined?{}:{body:JSON.stringify(body)})});const data=(response.headers.get('content-type')||'').includes('json')?await response.json():await response.text();assert.equal(response.status,status,JSON.stringify(data));if(response.headers.get('set-cookie'))this.cookie=response.headers.get('set-cookie').split(';')[0];if(data.csrf)this.csrf=data.csrf;return data;}}),admin=actor(),client=actor();
 try{
  await admin.call('/api/login',{email:'owner@amc.test',password:'Strong-Owner-2026!'});await client.call('/api/register',{email:'pdf-client@test.test',name:'Juan Pérez',password:'Client-Test-2026!'});const request=await client.call('/api/requests',{name:'Juan Pérez',phone:'3548000000',town:'Valle Hermoso',description:'Revoque',services:['Revoque fino'],type:'presupuesto'},201),quote=await admin.call('/api/quotes',{requestId:request.id,externalId:'pdf-independent',version:'a'.repeat(64),number:'AMC-1',items:[{description:'Revoque fino'}],total:500000},201);
  assert.equal(quote.status,'Enviado');assert.equal(quote.pdf,'');assert.equal(quote.pdfPending,true);assert.equal((await client.call('/api/state')).quotes[0].id,quote.id);
  const upload=await admin.call('/api/upload',{mime:'application/pdf',base64:Buffer.from('%PDF-1.4\nvalid').toString('base64')},201),attached=await admin.call('/api/quotes/'+quote.id+'/pdf',{pdfId:upload.id});assert.equal(attached.pdfPending,false);assert.equal(attached.pdf,upload.url);
 }finally{await new Promise(r=>app.server.close(r));}
});
