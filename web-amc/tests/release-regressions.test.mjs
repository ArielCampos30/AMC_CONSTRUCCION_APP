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

test('agregar trabajo sincroniza el borrador y evita doble alta inmediata',()=>{
  const html=read('../private/presupuestos-original.html');
  const steps=read('../public/estimator-steps.js');
  const features=read('../public/features-ui.js');
  assert.match(html,/let addItemBusy=false/);
  assert.match(html,/if \(addItemBusy\) return/);
  assert.match(html,/notifyDraftUpdated\(clientDesc\)/);
  assert.match(html,/type:'amc:draft-updated'/);
  assert.match(html,/Estimación elegida:/);
  assert.match(steps,/document\.addEventListener\('amc:draft-updated',update\)/);
  assert.match(steps,/count===1\?'trabajo':'trabajos'/);
  assert.match(features,/data-estimator-summary/);
  assert.match(features,/data\.type==='amc:draft-updated'/);
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
  assert.match(app,/id="new-client-form" autocomplete="off"/);
  assert.match(app,/input\.autocomplete='off'/);
  assert.match(app,/input\.setAttribute\('data-form-type','other'\)/);
  assert.match(app,/autocomplete="\$\{register\?'new-password':'current-password'\}"/);
});

test('favicon PWA y notificaciones usan la identidad AMC actual',()=>{
  const html=read('../public/index.html');
  const manifest=JSON.parse(read('../public/manifest.webmanifest'));
  const sw=read('../public/sw.js');
  const server=read('../server.mjs');
  assert.match(html,/amc-logo\.webp\?v=20260908/);
  assert.doesNotMatch(html,/amc-icon\.png/);
  assert.equal(manifest.theme_color,'#0b675f');
  assert.equal(manifest.icons[0].src,'/assets/amc-logo.webp');
  assert.match(sw,/AMC-offline-shell-v10/);
  assert.match(sw,/\/assets\/amc-logo\.webp/);
  assert.doesNotMatch(sw,/amc-icon\.png/);
  assert.match(server,/'webp':'image\/webp'/);
});

test('WhatsApp externo normaliza números argentinos',()=>{
  const bridge=read('../public/presupuestos-bridge.js');
  assert.match(bridge,/raw\.startsWith\('549'\)\?raw:raw\.startsWith\('54'\)\?'549'\+raw\.slice\(2\):'549'\+raw/);
});

test('guardar o enviar usa el precio comercial automático o editado',()=>{
  const bridge=read('../public/presupuestos-bridge.js');
  const action=bridge.indexOf("const registered=hasAccount(r),action=");
  const validation=bridge.indexOf("Agregá trabajos con un importe válido antes de '+action");
  assert.ok(action>=0);
  assert.ok(validation>action);
  assert.match(bridge,/total:clientTotal\(draft\)/);
  assert.match(bridge,/makePdf\(quoteForDocument\(draft\)\)/);
});

test('los scripts modificados conservan sintaxis JavaScript válida',()=>{
  for(const path of [
    '../public/presupuestos-bridge.js',
    '../public/estimator-steps.js',
    '../public/features-ui.js',
    '../public/app.js'
  ]){
    execFileSync(process.execPath,['--check',fileURLToPath(new URL(path,import.meta.url))]);
  }
  const html=read('../private/presupuestos-original.html');
  for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)){
    const source=match[1].trim();
    if(source)new Function(source);
  }
});
