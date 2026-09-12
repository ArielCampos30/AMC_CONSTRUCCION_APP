import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {quotePersistentDocument,quoteContentVersion} from '../public/quote-persistence.js';

test('controlador Guardar/Enviar usa API canónica sin depender del bridge legacy',()=>{
 const controller=readFileSync(new URL('../public/quote-save-controller.js',import.meta.url),'utf8');
 const wrapper=readFileSync(new URL('../public/features-ui.js',import.meta.url),'utf8');
 assert.match(wrapper,/createQuoteSaveController/);
 assert.match(controller,/\/api\/admin\/requests/);
 assert.match(controller,/\/api\/quotes/);
 assert.match(controller,/quotePersistentDocument/);
 assert.match(controller,/quoteContentVersion/);
 assert.match(controller,/dataset\.qwSaveQuote/);
 assert.match(controller,/presupuesto-admin\//);
 assert.match(controller,/new MutationObserver/);
 assert.match(controller,/hostObserver\.observe\(host,\{childList:true,subtree:true\}\)/);
 assert.match(controller,/button\.textContent!==label/);
 assert.match(controller,/button\.disabled!==disabled/);
 assert.doesNotMatch(controller,/presupuestos-bridge/);
 assert.doesNotMatch(controller,/createAndAttach|generatePendingPdf|pdfId/);
});

test('documento persistente y hash cambian sólo con contenido persistente',async()=>{
 const base={requestId:'req-1',externalId:'ext-1',number:'AMC-1',works:[{id:'w1',description:'Revoque grueso interior',quantity:12,quantityExplicit:true,unit:'m²',materials:1000,tools:200,other:300,labor:0,costsConfirmed:true,workers:2,days:1,hours:8,tariffKey:'revoque',tariffTask:'Revoque grueso interior',tariffRubric:'Albañilería',tariffUnit:'m²',tariffPrice:10000,tariffKind:'tariff'}],travel:500,employeeDay:25000,finalPrice:120000,finalPriceManual:false,desiredMargin:30,payment:'50%',notes:'',snapshot:{internalCost:52000,gain:68000}};
 const one=quotePersistentDocument(base),two=quotePersistentDocument(structuredClone(base));
 assert.deepEqual(one,two);
 assert.equal(await quoteContentVersion(one),await quoteContentVersion(two));
 const changed=quotePersistentDocument({...base,finalPrice:125000,snapshot:{internalCost:52000,gain:73000}});
 assert.notEqual(await quoteContentVersion(one),await quoteContentVersion(changed));
 assert.equal(one.adminModel.works[0].description,'Revoque grueso interior');
 assert.equal(one.total,120000);
 assert.equal(one.adminModel.finalPrice,120000);
});
