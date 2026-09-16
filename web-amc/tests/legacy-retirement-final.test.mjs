import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');

test('Tarifario y Cotizador quedan como herramientas independientes y diferidas',()=>{
 const system=read('../public/admin-system-ui.js');
 const features=read('../public/features-ui.js');
 const runtime=read('../public/quote-tools-runtime.js');
 const loader=read('../public/quote-tools-loader.js');
 const tariff=read('../public/tariff-ui.js');
 assert.match(system,/\['tarifario','Tarifario'\]/);
 assert.match(system,/\['cotizador','Cotizador'\]/);
 assert.doesNotMatch(system,/Tarifario y cotizador/);
 assert.doesNotMatch(features,/from '\.\/tariff-ui\.js'/);
 assert.match(features,/prepareQuoteToolsPage/);
 assert.match(runtime,/createTariffUI/);
 assert.match(runtime,/tariff\.afterRender\(page\)/);
 assert.match(loader,/importModule\('\.\/quote-tools-runtime\.js'\)/);
 assert.match(tariff,/page!=='tarifario'/);
 assert.match(tariff,/\/api\/estimator-tariffs/);
 assert.match(tariff,/amc-tariff-search/);
 assert.match(tariff,/href="#cotizador"/);
 assert.doesNotMatch(tariff,/quote-save|quote-pdf|createQuoteWizard|\/api\/quotes/);
});

test('retiro legacy no deja ejecutables antiguos del estimador',()=>{
 for(const path of ['../public/features-ui-legacy.js','../public/presupuestos-bridge.js','../public/estimator-sync.js','../public/estimator-steps.js','../public/estimator-v1.js','../public/estimator-v1.css','../public/pdf-logo.js','../private/presupuestos-original.html'])assert.equal(existsSync(new URL(path,import.meta.url)),false,path);
 const route=read('../estimator-page-routes.mjs');
 assert.match(route,/Location:'\/#cotizador'/);
 assert.doesNotMatch(route,/presupuestos-original|presupuestos-bridge|estimator-steps/);
});

test('extracciones conservan estilos y saltos de línea del chat',()=>{
 const actions=read('../public/project-actions-features.js');
 const chat=read('../public/chat-features.js');
 assert.ok(actions.includes('value="Rechazado" class="outline">Rechazar'));
 assert.match(chat,/\.replace\(\/\\n\/g,'<br>'\)/,'el chat debe convertir saltos de línea reales');
 assert.doesNotMatch(chat,/\.replace\(\/\\\\n\/g,'<br>'\)/,'no debe buscar el texto literal \\n');
});
