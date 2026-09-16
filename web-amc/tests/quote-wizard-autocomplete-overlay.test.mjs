import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');

test('el Tarifario usa un desplegable flotante y el layout queda en el CSS principal',()=>{
 const overlayCss=read('../public/quote-wizard-autocomplete.css');
 const coreCss=read('../public/quote-wizard.css');
 const js=read('../public/quote-wizard-autocomplete.js');
 const rootRule=overlayCss.match(/\.quote-tariff-overlay\{([^}]*)\}/)?.[1]||'';
 assert.match(overlayCss,/\.quote-tariff-overlay\{position:fixed/);
 assert.match(overlayCss,/quote-tariff-overlay-ready \.quote-builder-detail \.quote-tariff-results\{display:none\}/);
 assert.match(coreCss,/\.quote-builder-detail\{padding:/);
 assert.doesNotMatch(coreCss,/overflow:auto/);
 assert.match(coreCss,/\.quote-wizard-close\{display:grid;place-items:center/);
 assert.match(js,/buttons\.slice\(0,fitCount\(input,buttons\.length\)\)/);
 assert.match(js,/dataset\.qwSelectTariff/);
 assert.match(js,/dataset\.qwTariffWork/);
 assert.doesNotMatch(rootRule,/overflow\s*:\s*auto/);
 assert.doesNotMatch(overlayCss,/quote-wizard-close/);
 assert.doesNotMatch(overlayCss,/quote-wizard-dialog/);
 assert.doesNotMatch(overlayCss,/quote-wizard-controls/);
 assert.doesNotMatch(js,/function updateWorkLabels/);
});

test('el desplegable decide si abre arriba o abajo según el espacio disponible',()=>{
 const js=read('../public/quote-wizard-autocomplete.js');
 assert.match(js,/below>=height\|\|below>=above/);
 assert.match(js,/rect\.bottom\+6/);
 assert.match(js,/rect\.top-height-6/);
 assert.match(js,/Math\.min\(total,5/);
});

test('el Cotizador principal es el único dueño de sincronizar los nombres',()=>{
 const wizard=read('../public/quote-wizard.js');
 const overlay=read('../public/quote-wizard-autocomplete.js');
 assert.match(wizard,/quote-builder-work-copy strong/);
 assert.match(wizard,/quote-summary-rows button/);
 assert.match(wizard,/Trabajo sin nombre/);
 assert.doesNotMatch(overlay,/updateWorkLabels/);
});

test('la X de cierre queda sola y centrada en el CSS principal',()=>{
 const css=read('../public/quote-wizard.css');
 const wizard=read('../public/quote-wizard.js');
 assert.match(css,/quote-wizard-close\{display:grid;place-items:center/);
 assert.match(css,/border:0;border-radius:50%/);
 assert.match(wizard,/aria-labelledby="quote-wizard-title"/);
});

test('index no carga autocomplete ni estilos del Cotizador hasta necesitarlos',()=>{
 const html=read('../public/index.html');
 const loader=read('../public/quote-tools-loader.js');
 assert.doesNotMatch(html,/quote-wizard-autocomplete\.css/);
 assert.doesNotMatch(html,/quote-wizard-autocomplete\.js/);
 assert.doesNotMatch(html,/quote-wizard\.css/);
 assert.doesNotMatch(html,/quote-builder-review\.css/);
 assert.match(loader,/quote-wizard\.css/);
 assert.match(loader,/quote-builder-review\.css/);
 assert.match(loader,/quote-wizard-autocomplete\.css/);
 assert.match(loader,/importModule\('\.\/quote-wizard-autocomplete\.js'\)/);
});
