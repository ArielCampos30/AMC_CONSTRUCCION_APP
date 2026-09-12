import test from 'node:test';
import assert from 'node:assert/strict';
import {
 directCostTotal,
 internalCostTotal,
 laborCostTotal,
 normaliseWork,
 profitabilityCostTotal,
 profitabilitySnapshot,
 suggestedPriceForMargin,
 workDirectCost,
 workLaborCost,
 workLoadedInternalCost
} from '../public/quote-wizard-model.js';

test('documenta cada componente del contrato de costos con valores manuales',()=>{
 const employeeDay=10;
 const travel=60;
 const first=normaliseWork({
  description:'Trabajo A',tariffKind:'manual-reference',quantity:2,unitPrice:200,
  materials:100,tools:20,other:30,labor:50,workers:2,days:3
 });
 const second=normaliseWork({
  description:'Trabajo B',tariffKind:'manual-reference',quantity:1,unitPrice:100,
  materials:40,tools:10,other:0,labor:0,workers:1,days:2
 });

 assert.equal(first.materials,100);
 assert.equal(first.tools,20);
 assert.equal(first.other,30);
 assert.equal(first.labor,50);
 assert.equal(first.workers,2);
 assert.equal(first.days,3);
 assert.equal(employeeDay,10);
 assert.equal(travel,60);

 assert.equal(workDirectCost(first),150);
 assert.equal(workDirectCost(second),50);
 assert.equal(directCostTotal([first,second],travel),260);
 assert.equal(workLoadedInternalCost(first),200);
 assert.equal(workLoadedInternalCost(second),50);
 assert.equal(workLaborCost(first,employeeDay),60);
 assert.equal(workLaborCost(second,employeeDay),20);
 assert.equal(laborCostTotal([first,second],employeeDay),80);
 assert.equal(internalCostTotal([first,second],travel,employeeDay),340);
 assert.equal(profitabilityCostTotal([first,second],travel),310);
});

test('distingue costo operativo estimado de costo explícito para rentabilidad',()=>{
 const work=normaliseWork({
  description:'Trabajo',tariffKind:'manual-reference',quantity:1,unitPrice:500,
  materials:100,tools:20,other:30,labor:50,workers:2,days:3
 });

 const estimatedOperatingCost=internalCostTotal([work],60,10);
 const explicitProfitabilityCost=profitabilityCostTotal([work],60);

 assert.equal(estimatedOperatingCost,270);
 assert.equal(explicitProfitabilityCost,260);
 assert.notEqual(estimatedOperatingCost,explicitProfitabilityCost);
});

test('documenta venta, ganancia, margen y precio sugerido sin cambiar fórmulas',()=>{
 const salePrice=500;
 const profitabilityCost=310;
 const snapshot=profitabilitySnapshot(salePrice,profitabilityCost);

 assert.equal(snapshot.price,500);
 assert.equal(snapshot.cost,310);
 assert.equal(snapshot.gain,190);
 assert.equal(snapshot.margin,38);
 assert.equal(suggestedPriceForMargin(profitabilityCost,38),500);
});
