import test from 'node:test';
import assert from 'node:assert/strict';
import {
 economicSnapshot,
 internalCostTotal,
 laborEstimatedCost,
 laborExplicitCost,
 normaliseWork,
 profitabilityCostTotal,
 suggestedPriceForMargin,
 workEffectiveLaborCost
} from '../public/quote-wizard-model.js';

const baseWork=overrides=>normaliseWork({
 description:'Revoque grueso interior',tariffKind:'manual-reference',quantity:1,unitPrice:955000,
 materials:100000,tools:20000,other:10000,labor:0,workers:2,days:3,costsConfirmed:true,
 ...overrides
});

test('caso A: usa mano de obra estimada cuando no existe una carga explícita positiva',()=>{
 const work=baseWork({labor:0});
 const snapshot=economicSnapshot({works:[work],travel:30000,employeeDay:25000,salePrice:955000,goalMargin:30,tariffReference:955000});
 assert.equal(laborExplicitCost(work),0);
 assert.equal(laborEstimatedCost(work,25000),150000);
 assert.equal(workEffectiveLaborCost(work,25000),150000);
 assert.equal(snapshot.materials,100000);
 assert.equal(snapshot.tools,20000);
 assert.equal(snapshot.other,10000);
 assert.equal(snapshot.travel,30000);
 assert.equal(snapshot.laborExplicit,0);
 assert.equal(snapshot.laborEstimated,150000);
 assert.equal(snapshot.laborEffective,150000);
 assert.equal(snapshot.internalCost,310000);
 assert.equal(snapshot.gain,645000);
 assert.ok(Math.abs(snapshot.margin-67.5392670157)<1e-9);
 assert.ok(Math.abs(snapshot.minimumPrice-442857.142857)<.001);
 assert.equal(snapshot.tariffReference,955000);
 assert.equal(snapshot.profitabilityComplete,true);
});

test('caso B: la mano de obra explícita reemplaza a la estimada sin doble conteo',()=>{
 const work=baseWork({labor:180000});
 const snapshot=economicSnapshot({works:[work],travel:30000,employeeDay:25000,salePrice:955000,goalMargin:30});
 assert.equal(snapshot.laborExplicit,180000);
 assert.equal(snapshot.laborEstimated,150000);
 assert.equal(snapshot.laborEffective,180000);
 assert.equal(snapshot.internalCost,340000);
 assert.equal(snapshot.gain,615000);
 assert.ok(Math.abs(snapshot.margin-64.3979057592)<1e-9);
 assert.ok(Math.abs(snapshot.minimumPrice-485714.285714)<.001);
});

test('internalCostTotal y profitabilityCostTotal comparten la misma fuente canónica',()=>{
 const works=[baseWork({labor:0}),baseWork({materials:40000,tools:0,other:0,labor:50000,workers:1,days:2})];
 assert.equal(internalCostTotal(works,30000,25000),profitabilityCostTotal(works,30000,25000));
 assert.equal(internalCostTotal(works,30000,25000),400000);
});

test('costos reales de relevamiento no desaparecen pero la rentabilidad queda incompleta',()=>{
 const visit=baseWork({tariffKind:'visit-pending',unitPrice:0,materials:25000,tools:5000,other:0,labor:0,workers:1,days:1});
 const snapshot=economicSnapshot({works:[visit],travel:12000,employeeDay:30000,salePrice:0,goalMargin:30});
 assert.equal(snapshot.internalCost,72000);
 assert.equal(snapshot.unpricedWorks,1);
 assert.equal(snapshot.margin,null);
 assert.equal(snapshot.profitabilityComplete,false);
});

test('cero puede ser un costo confirmado y no se confunde con dato faltante',()=>{
 const noCosts=normaliseWork({description:'Diagnóstico',tariffKind:'manual-reference',unitPrice:1000,workers:1,days:1,costsConfirmed:true});
 const incomplete=normaliseWork({description:'Diagnóstico',tariffKind:'manual-reference',unitPrice:1000,workers:1,days:1});
 assert.equal(economicSnapshot({works:[noCosts],employeeDay:0,salePrice:1000}).costsComplete,true);
 assert.equal(economicSnapshot({works:[incomplete],employeeDay:0,salePrice:1000}).costsComplete,false);
});

test('precio sin venta e invalidación de margen objetivo son explícitos',()=>{
 const snapshot=economicSnapshot({works:[baseWork({})],salePrice:0,goalMargin:100});
 assert.equal(snapshot.margin,null);
 assert.equal(snapshot.goalValid,false);
 assert.equal(snapshot.minimumPrice,0);
 assert.equal(suggestedPriceForMargin(310000,-1),0);
 assert.equal(suggestedPriceForMargin(310000,100),0);
 assert.equal(suggestedPriceForMargin(310000,'invalido'),0);
});

test('varios trabajos suman costos, viaje y mano de obra efectiva una sola vez',()=>{
 const first=normaliseWork({description:'Manual',tariffKind:'manual-reference',unitPrice:1000,materials:10,workers:2,days:2,costsConfirmed:true});
 const second=normaliseWork({description:'Jornal',tariffKind:'jornal',materials:20,labor:90,workers:5,days:5,costsConfirmed:true});
 const snapshot=economicSnapshot({works:[first,second],travel:30,employeeDay:10,salePrice:2000,goalMargin:20});
 assert.equal(snapshot.laborEstimated,290);
 assert.equal(snapshot.laborExplicit,90);
 assert.equal(snapshot.laborEffective,130);
 assert.equal(snapshot.internalCost,190);
 assert.equal(snapshot.minimumPrice,237.5);
});
