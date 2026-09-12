import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normaliseWork,workLoadedInternalCost,profitabilityCostTotal,profitabilitySnapshot,suggestedPriceForMargin,commercialReferenceTotal,workLaborCost,workEffectiveLaborCost} from '../public/quote-wizard-model.js';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');

test('rentabilidad usa costos directos y mano de obra estimada cuando no hay explícita',()=>{
 const work=normaliseWork({description:'Revoque fino',quantity:12,unitPrice:18000,tariffKind:'manual-reference',materials:120000,tools:10000,other:5000});
 assert.equal(commercialReferenceTotal(work),216000);
 assert.equal(workLaborCost(work),30000);
 assert.equal(work.labor,0);
 assert.equal(workLoadedInternalCost(work),135000);
 assert.equal(workEffectiveLaborCost(work),30000);
 assert.equal(profitabilityCostTotal([work],12000),177000);
});

test('mano de obra explícita entra una sola vez al costo interno',()=>{
 const work=normaliseWork({description:'Pintura',quantity:20,unitPrice:15000,tariffKind:'manual-reference',materials:90000,labor:80000,workers:2,days:2});
 assert.equal(workLaborCost(work),120000);
 assert.equal(workLoadedInternalCost(work),170000);
 assert.equal(profitabilityCostTotal([work],10000),180000);
});

test('relevamiento queda fuera del precio y de la rentabilidad',()=>{
 const priced=normaliseWork({description:'Pintura',quantity:20,unitPrice:15000,tariffKind:'manual-reference',materials:90000,labor:80000});
 const visit=normaliseWork({description:'Humedad a revisar',tariffKind:'visit-pending',materials:50000,labor:40000});
 assert.equal(commercialReferenceTotal(visit),0);
 assert.equal(profitabilityCostTotal([priced,visit],10000),270000);
 assert.equal(profitabilityCostTotal([visit],10000),100000);
});

test('calcula ganancia, margen y precio sugerido con la fórmula histórica de AMC',()=>{
 const snapshot=profitabilitySnapshot(850000,510000);
 assert.equal(snapshot.gain,340000);
 assert.equal(snapshot.margin,40);
 assert.equal(suggestedPriceForMargin(510000,40),850000);
 const discounted=profitabilitySnapshot(820000,510000);
 assert.equal(discounted.gain,310000);
 assert.ok(Math.abs(discounted.margin-37.80487804878049)<1e-9);
});

test('la revisión es una etapa nativa del asistente y conserva rentabilidad y precio final',()=>{
 const wizard=read('../public/quote-wizard.js');
 const reviewCss=read('../public/quote-builder-review.css');
 const coreCss=read('../public/quote-wizard.css');
 assert.match(wizard,/Revisar presupuesto/);
 assert.match(wizard,/class="quote-review-stage"/);
 assert.doesNotMatch(wizard,/quote-wizard-step quote-review-stage/);
 assert.doesNotMatch(wizard,/<h2>Rentabilidad y precio final<\/h2>/);
 assert.match(wizard,/Margen objetivo/);
 assert.match(wizard,/Precio final editable/);
 assert.match(wizard,/La carga explícita reemplaza la estimación; nunca se suman ambas/);
 assert.match(wizard,/data-qw-use-suggested-price/);
 assert.match(wizard,/data-qw-reset-final-price/);
 assert.match(wizard,/Guardar \/ enviar · siguiente bloque/);
 assert.match(reviewCss,/\.quote-review-layout\{display:grid/);
 assert.doesNotMatch(reviewCss,/\.quote-review-stage\{max-width:980px/);
 assert.doesNotMatch(coreCss,/overflow:auto/);
 assert.match(coreCss,/\.quote-wizard-close\{display:grid;place-items:center/);
 assert.doesNotMatch(wizard,/iframe/);
 for(const source of [wizard,reviewCss,coreCss]){
  assert.doesNotMatch(source,/!important/);
  assert.doesNotMatch(source,/(?:window\.)?location\.reload\s*\(/);
 }
});
