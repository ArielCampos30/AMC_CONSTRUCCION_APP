import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');

test('el Tarifario usa un desplegable flotante sin empujar el detalle central',()=>{
 const css=read('../public/quote-wizard-autocomplete.css');
 const js=read('../public/quote-wizard-autocomplete.js');
 assert.match(css,/\.quote-tariff-overlay\{position:fixed/);
 assert.match(css,/quote-tariff-overlay-ready \.quote-builder-detail \.quote-tariff-results\{display:none\}/);
 assert.match(css,/quote-tariff-overlay-ready \.quote-builder-detail\{overflow:visible/);
 assert.match(css,/quote-tariff-overlay-ready \.quote-builder-summary\{overflow:auto\}/);
 assert.match(js,/buttons\.slice\(0,fitCount\(input,buttons\.length\)\)/);
 assert.match(js,/dataset\.qwSelectTariff/);
 assert.match(js,/dataset\.qwTariffWork/);
 assert.doesNotMatch(css,/\.quote-tariff-overlay[^\n]*overflow\s*:\s*auto/);
});

test('el desplegable decide si abre arriba o abajo según el espacio disponible',()=>{
 const js=read('../public/quote-wizard-autocomplete.js');
 assert.match(js,/below>=height\|\|below>=above/);
 assert.match(js,/rect\.bottom\+6/);
 assert.match(js,/rect\.top-height-6/);
 assert.match(js,/Math\.min\(total,5/);
});

test('el nombre escrito se sincroniza en la lista de trabajos y el resumen',()=>{
 const js=read('../public/quote-wizard-autocomplete.js');
 assert.match(js,/function updateWorkLabels/);
 assert.match(js,/quote-builder-work-copy strong/);
 assert.match(js,/quote-summary-rows button/);
 assert.match(js,/Trabajo sin nombre/);
});

test('index carga el refuerzo visual después del cotizador base',()=>{
 const html=read('../public/index.html');
 assert.match(html,/quote-wizard-autocomplete\.css/);
 assert.match(html,/quote-wizard-autocomplete\.js/);
 assert.ok(html.indexOf('/quote-wizard.css')<html.indexOf('/quote-wizard-autocomplete.css'));
 assert.ok(html.indexOf('/app.js')<html.indexOf('/quote-wizard-autocomplete.js'));
});
