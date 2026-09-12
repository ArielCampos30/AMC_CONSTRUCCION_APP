import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');

test('ARS acepta formato argentino sin convertir 517.000 en 517',()=>{
  const sandbox={Intl};
  sandbox.globalThis=sandbox;
  vm.createContext(sandbox);
  vm.runInContext(read('../public/ars.js'),sandbox);
  assert.equal(sandbox.AMCArs.parse('517000'),517000);
  assert.equal(sandbox.AMCArs.parse('517.000'),517000);
  assert.equal(sandbox.AMCArs.parse('$517.000'),517000);
  assert.equal(sandbox.AMCArs.parse('517 000'),517000);
  assert.equal(sandbox.AMCArs.parse('1.250.000'),1250000);
  const cost=72000,price=517000,gain=price-cost,margin=gain/price*100;
  assert.equal(gain,445000);
  assert.ok(Math.abs(margin-86.0735)<0.01);
});

test('agregar trabajo actualiza el borrador nativo una sola vez y lo conserva en la revisión',()=>{
  const wizard=read('../public/quote-wizard.js');
  assert.match(wizard,/function addWork\(\)\{const rows=initialiseWorks\(\),work=createWork\(\{description:''\}\);rows\.push\(work\);activeWorkId=work\.id;/);
  assert.match(wizard,/data-qw-add-work/);
  assert.match(wizard,/const add=event\.target\.closest\('\[data-qw-add-work\]'\);if\(add\)\{addWork\(\);return;\}/);
  assert.match(wizard,/function validWorks\(\)\{const rows=initialiseWorks\(\);return rows\.length>0/);
  assert.match(wizard,/getDraft:\(\)=>\{const rows=\[\.\.\.initialiseWorks\(\)\]/);
  assert.match(wizard,/works:rows/);
});


test('el precio final nace automáticamente de la suma de trabajos y sigue siendo editable',()=>{
  const html=read('../private/presupuestos-original.html');
  const bridge=read('../public/presupuestos-bridge.js');
  assert.match(html,/Subtotal de trabajos:/);
  assert.match(bridge,/const workSubtotal=q=>/);
  assert.match(bridge,/const commercialPrice=q=>/);
  assert.match(bridge,/Precio final automático: coincide con la suma de los trabajos agregados/);
  assert.match(bridge,/draft\.amcPriceManual=true/);
  assert.match(bridge,/reset-client-price/);
  assert.match(bridge,/Precio final restablecido al total calculado por trabajos/);
});

test('el cotizador integrado sigue el orden cliente trabajos subtotal mano de obra rentabilidad y precio final',()=>{
  const html=read('../private/presupuestos-original.html');
  const bridge=read('../public/presupuestos-bridge.js');
  const steps=read('../public/estimator-steps.js');
  assert.match(html,/2\. Trabajo a presupuestar/);
  assert.match(html,/3\. Trabajos agregados/);
  assert.match(bridge,/4\. Mano de obra estimada/);
  assert.match(bridge,/5\. Rentabilidad interna/);
  assert.match(bridge,/6\. Precio final al cliente/);
  assert.match(steps,/7\. Guardar \/ enviar presupuesto/);
  assert.match(bridge,/appRoot\.insertBefore\(banner,quoteView\).*appRoot\.insertBefore\(addView,quoteView\).*appRoot\.insertBefore\(worksCard,quoteView\).*appRoot\.insertBefore\(teamBox,quoteView\).*appRoot\.insertBefore\(profitBox,quoteView\).*appRoot\.insertBefore\(finalPriceBox,quoteView\)/s);
});

test('la vista cliente no expone la nota interna de Administración',()=>{
  const bridge=read('../public/presupuestos-bridge.js');
  assert.match(bridge,/internalAdminNote=\/\^Presupuesto iniciado por Administración/);
  assert.match(bridge,/draft\.notes=internalAdminNote\?'':/);
});

test('Vista cliente usa un modal público y no navega a la vista legacy oculta',()=>{
  const html=read('../private/presupuestos-original.html');
  assert.match(html,/function openClientPreviewDialog/);
  assert.match(html,/amc-client-preview-dialog/);
  assert.match(html,/Vista del cliente/);
  assert.match(html,/PRECIO FINAL PENDIENTE/);
  assert.match(html,/data-preview-pdf/);
  assert.match(html,/data-preview-share/);
  assert.match(html,/data-preview-print/);
  assert.match(html,/Definí el precio final antes de generar un documento/);
  assert.doesNotMatch(html,/\$\('#open-print'\)\.addEventListener\('click', \(\) => \{ renderPrintSheet\(draft\); nav\('print'\); \}\)/);
});

test('formularios Admin reducen autofill de datos ajenos sin romper login',()=>{
  const app=read('../public/app.js');
  const dialogs=read('../public/admin-client-dialogs-ui.js');
  const account=read('../public/account-ui.js');
  assert.match(app,/from '.\/admin-client-dialogs-ui\.js'/);
  assert.match(dialogs,/id="new-client-form" autocomplete="off"/);
  assert.match(dialogs,/input\.autocomplete='off'/);
  assert.match(dialogs,/input\.setAttribute\('data-form-type','other'\)/);
  assert.match(account,/autocomplete="\$\{register\?'new-password':'current-password'\}"/);
});

test('favicon PWA y notificaciones usan la identidad AMC actual',()=>{
  const html=read('../public/index.html');
  const manifest=JSON.parse(read('../public/manifest.webmanifest'));
  const sw=read('../public/sw.js');
  const staticFiles=read('../static-file-routes.mjs');
  assert.match(html,/amc-logo\.webp\?v=20260908/);
  assert.doesNotMatch(html,/amc-icon\.png/);
  assert.equal(manifest.theme_color,'#0b675f');
  assert.equal(manifest.icons[0].src,'/assets/amc-logo.webp');
  assert.match(sw,/AMC-offline-shell-v10/);
  assert.match(sw,/\/assets\/amc-logo\.webp/);
  assert.doesNotMatch(sw,/amc-icon\.png/);
  assert.match(staticFiles,/'webp':'image\/webp'/);
});

test('WhatsApp externo normaliza números argentinos',()=>{
  const bridge=read('../public/presupuestos-bridge.js');
  assert.match(bridge,/raw\.startsWith\('549'\)\?raw:raw\.startsWith\('54'\)\?'549'\+raw\.slice\(2\):'549'\+raw/);
});

test('PDF pendiente conserva el presupuesto y permite reintento explícito',()=>{
  const bridge=read('../public/presupuestos-bridge.js');
  const app=read('../public/app.js');
  const quotesUI=read('../public/admin-quotes-ui.js');
  assert.match(bridge,/storedQuote\.pdfPending=false/);
  assert.match(bridge,/El presupuesto sigue guardado\. El PDF no se pudo generar\./);
  assert.match(quotesUI,/Generar PDF/);
});

test('guardar o enviar usa el precio comercial automático o editado',()=>{
  const bridge=read('../public/presupuestos-bridge.js');
  const generation=read('../public/quote-pdf-generation.js');
  const action=bridge.indexOf("const registered=hasAccount(r),action=");
  const validation=bridge.indexOf("Agregá trabajos con un importe válido antes de '+action");
  assert.ok(action>=0);
  assert.ok(validation>action);
  assert.match(bridge,/total:clientTotal\(draft\)/);
  assert.match(bridge,/document:quoteForDocument\(draft\)/);
  assert.match(generation,/makePdf\(document\)/);
});

test('editar presupuesto restaura el modelo persistido y el precio por quoteId',()=>{
  const features=read('../public/features-ui.js');
  const wizard=read('../public/quote-wizard.js');
  assert.match(features,/openEditor\(requestId='',quoteId='',mode=''\)\{wizard\.open\(requestId,quoteId,mode\);deps\.navigate\('cotizador'\);\}/);
  assert.match(wizard,/const quote=quoteId\?quotes\(\)\.find\(item=>item\.id===quoteId\):null,editable=quote\?\.adminModel\?\.schemaVersion===1\?quote\.adminModel:null/);
  assert.match(wizard,/const quoteItems=editable\?\.works\|\|quote\?\.items\|\|\[\]/);
  assert.match(wizard,/works=quoteItems\.map\(item=>createWork\(item\)\)/);
  assert.match(wizard,/const stored=amount\(editable\?\.finalPrice\?\?quote\.amcClientPrice\?\?quote\.total,0\)/);
  assert.match(wizard,/if\(stored>0\)\{finalPrice=stored;finalPriceManual=/);
});

test('los scripts modificados conservan sintaxis JavaScript válida',()=>{
  for(const path of [
    '../public/presupuestos-bridge.js',
    '../public/estimator-steps.js',
    '../public/features-ui.js',
    '../public/features-ui-legacy.js',
    '../public/client-directory.js',
    '../public/floating-chat.js',
    '../public/team-ui.js',
    '../public/amc-busy.js',
    '../public/app.js',
    '../public/admin-quotes-ui.js',
    '../public/admin-works-ui.js'
  ]){
    execFileSync(process.execPath,['--check',fileURLToPath(new URL(path,import.meta.url))]);
  }
  const html=read('../private/presupuestos-original.html');
  for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)){
    const source=match[1].trim();
    if(source)new Function(source);
  }
});