import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normaliseWork,commercialReferenceTotal} from '../public/quote-wizard-model.js';

const wizard=readFileSync(new URL('../public/quote-wizard.js',import.meta.url),'utf8');

test('una tarifa por m² multiplica precio unitario por metros cargados',()=>{
 const work=normaliseWork({description:'Revoque fino',quantity:12,tariffPrice:18000,tariffUnit:'m²',tariffKind:'tariff'});
 assert.equal(commercialReferenceTotal(work),216000);
});

test('el cotizador exige medida explícita para tarifas por superficie o longitud',()=>{
 assert.match(wizard,/MEASURED_UNITS/);
 assert.match(wizard,/Metros cuadrados \(m²\)/);
 assert.match(wizard,/Metros lineales \(ml\)/);
 assert.match(wizard,/requiresMeasuredQuantity\(tariff\.unidad\)&&!work\.quantityExplicit\)work\.quantity=0/);
 assert.match(wizard,/!requiresMeasuredQuantity\(unit\)\|\|amount\(work\.quantity\)>0/);
 assert.match(wizard,/data-qw-key="quantity"/);
 assert.match(wizard,/Falta este dato:/);
});

test('al elegir una tarifa medida muestra la medida antes de los modos y enfoca el campo',()=>{
 const pricing=wizard.slice(wizard.indexOf('function pricingPanel'),wizard.indexOf('function internalCosts'));
 assert.match(pricing,/tariffActive\?`\$\{content\}\$\{tabs\}`:`\$\{tabs\}\$\{content\}`/);
 assert.match(wizard,/focus=requiresMeasuredQuantity\(tariff\.unidad\)\?`\[data-qw-work-id=.*data-qw-key=\\"quantity\\"\]`/s);
 assert.match(wizard,/preserveScroll:!focus/);
});
