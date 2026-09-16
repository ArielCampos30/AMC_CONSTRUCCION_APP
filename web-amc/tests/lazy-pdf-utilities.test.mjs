import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(path,import.meta.url),'utf8');

test('12.10A mantiene las implementaciones PDF pesadas fuera del grafo estático de arranque',async()=>{
 const [app,payment,clients,quotes,paymentImpl,clientsImpl,quotesImpl]=await Promise.all([
  read('../public/app.js'),
  read('../public/payment-pdf.js'),
  read('../public/client-list-pdf.js'),
  read('../public/quote-pdf-actions.js'),
  read('../public/payment-pdf-impl.js'),
  read('../public/client-list-pdf-impl.js'),
  read('../public/quote-pdf-actions-impl.js')
 ]);
 assert.match(app,/from '.\/payment-pdf\.js'/);
 assert.match(app,/from '.\/client-list-pdf\.js'/);
 assert.match(app,/from '.\/quote-pdf-actions\.js'/);
 assert.doesNotMatch(app,/-pdf-impl\.js/);
 assert.doesNotMatch(app,/quote-pdf-actions-impl\.js/);
 assert.match(payment,/import\('\.\/payment-pdf-impl\.js'\)/);
 assert.match(clients,/import\('\.\/client-list-pdf-impl\.js'\)/);
 assert.match(quotes,/import\('\.\/quote-pdf-actions-impl\.js'\)/);
 assert.doesNotMatch(payment,/LOGO_JPG_B64/);
 assert.ok(Buffer.byteLength(payment)<700);
 assert.ok(Buffer.byteLength(clients)<700);
 assert.ok(Buffer.byteLength(quotes)<700);
 assert.ok(Buffer.byteLength(paymentImpl)>50000);
 assert.match(paymentImpl,/export async function downloadPaymentDocument/);
 assert.match(clientsImpl,/export function downloadClients/);
 assert.match(quotesImpl,/export async function downloadQuotePdf/);
 assert.match(quotesImpl,/export async function shareQuotePdf/);
});

test('las fachadas lazy conservan la delegación funcional al invocarse',async()=>{
 const clients=await import('../public/client-list-pdf.js');
 const bytes=await clients.clientListPdf([{name:'Cliente',town:'Valle Hermoso',phone:'3548',email:'cliente@test.test',group:'Registrado',requests:[]}],'Todos');
 assert.ok(bytes instanceof Uint8Array);
 assert.match(Buffer.from(bytes).toString('latin1'),/AMC - Lista de clientes/);

 const previousWindow=globalThis.window;
 let starts=0,stops=0;
 globalThis.window={AMCBusy:{start(){starts++;},stop(){stops++;}}};
 try{
  const quotes=await import('../public/quote-pdf-actions.js');
  await assert.rejects(()=>quotes.downloadQuotePdf({}),/todavía no tiene PDF/);
  assert.equal(starts,1);
  assert.equal(stops,1);
 }finally{
  if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow;
 }
});
