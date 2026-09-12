import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {applyTariffSelection,findTariffMatches,normaliseWork} from '../public/quote-wizard-model.js';
import {createQuoteWizard} from '../public/quote-wizard.js';

const tariff={
 key:'albanileria-revoque-grueso-interior',
 rubro:'Albañilería',
 tarea:'Revoque grueso interior',
 unidad:'m²',
 precio:18000
};

test('la selección reemplaza la búsqueda parcial por el nombre canónico',()=>{
 const work=normaliseWork({description:'revo'});
 const result=findTariffMatches([tariff],'revo',5);

 assert.equal(result.matches[0].tariff,tariff);
 assert.equal(work.description,'revo');

 applyTariffSelection(work,result.matches[0].tariff,'manual-tariff');

 assert.deepEqual({
  description:work.description,
  tariffKey:work.tariffKey,
  tariffTask:work.tariffTask,
  tariffRubric:work.tariffRubric,
  tariffUnit:work.tariffUnit,
  tariffPrice:work.tariffPrice,
  tariffKind:work.tariffKind,
  unit:work.unit,
  unitPrice:work.unitPrice
 },{
  description:'Revoque grueso interior',
  tariffKey:'albanileria-revoque-grueso-interior',
  tariffTask:'Revoque grueso interior',
  tariffRubric:'Albañilería',
  tariffUnit:'m²',
  tariffPrice:18000,
  tariffKind:'manual-tariff',
  unit:'m²',
  unitPrice:0
 });
 assert.notEqual(work.description,'revo');
});

test('un trabajo con metadata de tarifa se normaliza siempre con su nombre canónico',()=>{
 const work=normaliseWork({
  description:'revoq',
  tariffTask:'Revoque grueso interior',
  tariffKey:tariff.key,
  tariffPrice:tariff.precio
 });

 assert.equal(work.description,'Revoque grueso interior');
 assert.equal(work.tariffTask,'Revoque grueso interior');
});

test('el wizard aplica la selección en el modelo y getDraft conserva ese estado',()=>{
 const source=readFileSync(new URL('../public/quote-wizard.js',import.meta.url),'utf8');
 assert.match(source,/applyTariffSelection\(work,tariff,kind\)/);
 assert.doesNotMatch(source,/querySelector[^\n]*textContent\s*=\s*tariff\.tarea/);

 globalThis.document={addEventListener(){},querySelector(){return null;}};
 globalThis.location={hash:'#presupuestos'};
 globalThis.fetch=()=>new Promise(()=>{});
 try{
  const wizard=createQuoteWizard({
   getState:()=>({
    clients:[{id:'client-1',hasAccount:1,name:'Cliente'}],
    quotes:[{id:'quote-1',items:[{id:'work-1',description:'revo',tariffTask:tariff.tarea,tariffKey:tariff.key,tariffPrice:tariff.precio}]}]
   }),
   isAdmin:()=>true,
   esc:value=>String(value),
   navigate(){},
   toast(){}
  });
  wizard.prefillClient('client-1');
  wizard.open('','quote-1');
  const draft=wizard.getDraft();

  assert.equal(draft.works[0].description,'Revoque grueso interior');
  assert.notEqual(draft.works[0].description,'revo');
 }finally{
  delete globalThis.document;
  delete globalThis.location;
  delete globalThis.fetch;
 }
});
