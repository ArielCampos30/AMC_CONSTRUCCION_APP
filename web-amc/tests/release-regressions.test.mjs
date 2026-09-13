import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');

test('ARS acepta formato argentino sin convertir 517.000 en 517',()=>{
  const sandbox={Intl};sandbox.globalThis=sandbox;vm.createContext(sandbox);vm.runInContext(read('../public/ars.js'),sandbox);
  assert.equal(sandbox.AMCArs.parse('517000'),517000);assert.equal(sandbox.AMCArs.parse('517.000'),517000);assert.equal(sandbox.AMCArs.parse('$517.000'),517000);assert.equal(sandbox.AMCArs.parse('517 000'),517000);assert.equal(sandbox.AMCArs.parse('1.250.000'),1250000);
  const cost=72000,price=517000,gain=price-cost,margin=gain/price*100;assert.equal(gain,445000);assert.ok(Math.abs(margin-86.0735)<0.01);
});

test('agregar trabajo actualiza el borrador nativo una sola vez y lo conserva en la revisión',()=>{
  const wizard=read('../public/quote-wizard.js');
  assert.match(wizard,/function addWork\(\)\{const rows=initialiseWorks\(\),work=createWork\(\{description:''\}\);rows\.push\(work\);activeWorkId=work\.id;/);
  assert.match(wizard,/data-qw-add-work/);assert.match(wizard,/const add=event\.target\.closest\('\[data-qw-add-work\]'\);if\(add\)\{addWork\(\);return;\}/);assert.match(wizard,/function validWorks\(\)\{const rows=initialiseWorks\(\);return rows\.length>0/);assert.match(wizard,/getDraft:\(\)=>\{const rows=\[\.\.\.initialiseWorks\(\)\]/);assert.match(wizard,/works:rows/);
});

test('el precio final nace de la referencia de trabajos y sigue siendo editable',()=>{
  const wizard=read('../public/quote-wizard.js');
  assert.match(wizard,/function automaticCommercial\(rows=initialiseWorks\(\)\)/);
  assert.match(wizard,/function currentFinalPrice\(rows=initialiseWorks\(\)\)/);
  assert.match(wizard,/return finalPriceManual&&amount\(finalPrice\)>0\?amount\(finalPrice\):automatic/);
  assert.match(wizard,/data-qw-final-price/);assert.match(wizard,/data-qw-reset-final-price/);
  assert.match(wizard,/Precio final automático: coincide con la referencia acumulada de los trabajos/);
});

test('el Cotizador canónico conserva sus cuatro etapas en orden',()=>{
  const wizard=read('../public/quote-wizard.js');
  assert.match(wizard,/const PHASES=\['Cliente','Trabajos y precios','Costos y rentabilidad','Revisión'\]/);
  assert.match(wizard,/ETAPA 1 DE 4/);assert.match(wizard,/ETAPA 2 DE 4/);assert.match(wizard,/ETAPA 3 DE 4/);assert.match(wizard,/ETAPA 4 DE 4/);
  assert.match(wizard,/Abrir presupuesto/);assert.match(wizard,/Costos y rentabilidad/);assert.match(wizard,/Revisar presupuesto/);
});

test('el modelo público y PDF no dependen de notas ni costos internos del estimador v1',()=>{
  const persistence=read('../public/quote-persistence.js'),pdf=read('../public/quote-pdf-document.js'),clientQuotes=read('../public/client-quotes-ui.js');
  assert.match(persistence,/items:rows\.map\(work=>\(\{description:work\.description\}\)\),total:Number\(finalPrice\|\|0\)/);
  assert.match(pdf,/items=\(Array\.isArray\(quote\?\.items\)\?quote\.items:\[\]\)/);
  assert.doesNotMatch(pdf,/internalCost|grossMargin|employeeDay|desiredMargin|profitability/);
  assert.doesNotMatch(clientQuotes,/internalCost|grossMargin|employeeDay|desiredMargin|Ganancia|Rentabilidad/);
});

test('formularios Admin reducen autofill de datos ajenos sin romper login',()=>{
  const app=read('../public/app.js'),dialogs=read('../public/admin-client-dialogs-ui.js'),account=read('../public/account-ui.js');
  assert.match(app,/from '.\/admin-client-dialogs-ui\.js'/);assert.match(dialogs,/id="new-client-form" autocomplete="off"/);assert.match(dialogs,/input\.autocomplete='off'/);assert.match(dialogs,/input\.setAttribute\('data-form-type','other'\)/);assert.match(account,/autocomplete="\$\{register\?'new-password':'current-password'\}"/);
});

test('favicon PWA y notificaciones usan la identidad AMC actual',()=>{
  const html=read('../public/index.html'),manifest=JSON.parse(read('../public/manifest.webmanifest')),sw=read('../public/sw.js'),staticFiles=read('../static-file-routes.mjs');
  assert.match(html,/amc-logo\.webp\?v=20260908/);assert.doesNotMatch(html,/amc-icon\.png/);assert.equal(manifest.theme_color,'#0b675f');assert.equal(manifest.icons[0].src,'/assets/amc-logo.webp');assert.match(sw,/AMC-offline-shell-v10/);assert.match(sw,/\/assets\/amc-logo\.webp/);assert.doesNotMatch(sw,/amc-icon\.png/);assert.match(staticFiles,/'webp':'image\/webp'/);
});

test('WhatsApp externo normaliza números argentinos desde la vista actual',()=>{
  const app=read('../public/app.js');
  assert.match(app,/replace\(\/\\D\/g,''\)\.replace\(\/\^0\+\/,''\)/);
  assert.match(app,/phone\.startsWith\('54'\)\?phone:'549'\+phone/);
  assert.match(app,/https:\/\/wa\.me\//);
});

test('PDF pendiente conserva el presupuesto y permite reintento explícito',()=>{
  const controller=read('../public/quote-pdf-controller.js'),quotesUI=read('../public/admin-quotes-ui.js');
  assert.match(controller,/function paintRetry\(quoteId\)/);assert.match(controller,/button\.textContent='Generar PDF'/);assert.match(controller,/El presupuesto quedó guardado\. No se pudo generar el PDF automáticamente/);assert.match(quotesUI,/Generar PDF/);
});

test('guardar o enviar persiste el precio final y genera PDF desde el documento canónico',()=>{
  const saver=read('../public/quote-save-controller.js'),persistence=read('../public/quote-persistence.js'),controller=read('../public/quote-pdf-controller.js'),generation=read('../public/quote-pdf-generation.js');
  assert.match(saver,/quotePersistentDocument/);assert.match(saver,/queueAutomaticQuotePdf/);assert.match(persistence,/total:Number\(finalPrice\|\|0\)/);assert.match(controller,/buildQuotePdfDocument/);assert.match(controller,/createAndAttach/);assert.match(generation,/makePdf\(document\)/);
});

test('editar presupuesto restaura el modelo persistido y el precio por quoteId',()=>{
  const features=read('../public/features-ui.js'),wizard=read('../public/quote-wizard.js');
  assert.match(features,/openEditor\(requestId='',quoteId='',mode=''\)\{wizard\.open\(requestId,quoteId,mode\);deps\.navigate\('cotizador'\);\}/);assert.match(wizard,/const quote=quoteId\?quotes\(\)\.find\(item=>item\.id===quoteId\):null,editable=quote\?\.adminModel\?\.schemaVersion===1\?quote\.adminModel:null/);assert.match(wizard,/const quoteItems=editable\?\.works\|\|quote\?\.items\|\|\[\]/);assert.match(wizard,/works=quoteItems\.map\(item=>createWork\(item\)\)/);assert.match(wizard,/const stored=amount\(editable\?\.finalPrice\?\?quote\.amcClientPrice\?\?quote\.total,0\)/);assert.match(wizard,/if\(stored>0\)\{finalPrice=stored;finalPriceManual=/);
});

test('los scripts actuales conservan sintaxis JavaScript válida y no reaparece el estimador v1',()=>{
  for(const path of ['../public/features-ui.js','../public/chat-features.js','../public/project-actions-features.js','../public/quote-wizard.js','../public/quote-save-controller.js','../public/quote-pdf-controller.js','../public/client-directory.js','../public/floating-chat.js','../public/team-ui.js','../public/amc-busy.js','../public/app.js','../public/admin-quotes-ui.js','../public/admin-works-ui.js'])execFileSync(process.execPath,['--check',fileURLToPath(new URL(path,import.meta.url))]);
  for(const path of ['../public/features-ui-legacy.js','../public/presupuestos-bridge.js','../public/estimator-sync.js','../public/estimator-steps.js','../public/estimator-v1.js','../public/pdf-logo.js'])assert.throws(()=>read(path));
});
