import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DEFAULT_QUOTE_SETTINGS,normaliseWork,workDirectCost,directCostTotal,measuredReference,workLaborCost,laborCostTotal,internalCostTotal,jornalTier,jornalReference} from '../public/quote-wizard-model.js';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');

test('3B.2 calcula costos directos una sola vez por presupuesto y conserva datos del legado',()=>{
 const first=normaliseWork({description:'Revoque',details:{quantity:12,unit:'m²',unitPrice:17000,materials:42000,tools:5000,other:3000,workers:2,m2Days:2,hours:12}});
 const second=normaliseWork({description:'Pintura',quantity:8,unit:'m²',unitPrice:15000,materials:25000,tools:2000,other:1000,workers:1,days:1,hours:6});
 assert.equal(measuredReference(first),204000);
 assert.equal(workDirectCost(first),50000);
 assert.equal(directCostTotal([first,second],12000),90000);
 assert.equal(first.days,2);
 assert.equal(first.workers,2);
});

test('3B.2 calcula mano de obra interna y referencia comercial por jornal con las reglas AMC',()=>{
 const work=normaliseWork({description:'Trabajo mixto',workers:2,days:3,hours:10});
 assert.equal(workLaborCost(work,30000),180000);
 assert.equal(laborCostTotal([work],30000),180000);
 assert.equal(internalCostTotal([work],12000,30000),192000);
 assert.deepEqual(jornalTier(2),{label:'Salida hasta 2 h',rate:55000,days:1});
 assert.deepEqual(jornalTier(4),{label:'Media jornada',rate:90000,days:1});
 assert.deepEqual(jornalTier(8),{label:'Jornada completa',rate:115000,days:1});
 assert.deepEqual(jornalTier(10),{label:'2 jornadas',rate:115000,days:2});
 assert.equal(jornalReference(work),460000);
 assert.equal(DEFAULT_QUOTE_SETTINGS.employeeDay,30000);
});

test('3B.2 habilita Costos y Mano de obra pero deja Rentabilidad para el siguiente corte',()=>{
 const wizard=read('../public/quote-wizard.js');
 assert.match(wizard,/PASO 3 DE 7/);
 assert.match(wizard,/Costos directos/);
 assert.match(wizard,/PASO 4 DE 7/);
 assert.match(wizard,/Mano de obra/);
 assert.match(wizard,/Continuar a Costos →/);
 assert.match(wizard,/Continuar a Mano de obra →/);
 assert.match(wizard,/Continuar a Rentabilidad →/);
 assert.match(wizard,/if\(step===3\)return validWorks\(\);return false/);
 assert.match(wizard,/Movilidad total del presupuesto/);
 assert.match(wizard,/Jornal interno por operario/);
});

test('3B.2 mantiene el código nuevo sin important ni recargas de página',()=>{
 const wizard=read('../public/quote-wizard.js');
 const model=read('../public/quote-wizard-model.js');
 const css=read('../public/quote-wizard.css');
 for(const source of [wizard,model,css]){
  assert.doesNotMatch(source,/!important/);
  assert.doesNotMatch(source,/(?:window\.)?location\.reload\s*\(/);
 }
});
