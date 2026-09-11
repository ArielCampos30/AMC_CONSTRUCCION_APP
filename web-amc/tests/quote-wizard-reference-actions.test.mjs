import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normaliseWork,commercialReferenceTotal,jornalReference,findTariffMatches} from '../public/quote-wizard-model.js';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');

test('editor ofrece las cuatro formas de resolver el precio dentro del trabajo seleccionado',()=>{
 const wizard=read('../public/quote-wizard.js');
 assert.match(wizard,/data-qw-pricing-mode="tariff"/);
 assert.match(wizard,/data-qw-pricing-mode="manual"/);
 assert.match(wizard,/data-qw-pricing-mode="jornal"/);
 assert.match(wizard,/data-qw-pricing-mode="visit"/);
 assert.match(wizard,/Tarifario/);
 assert.match(wizard,/Manual/);
 assert.match(wizard,/Jornal/);
 assert.match(wizard,/Relevamiento/);
});

test('el mismo campo Trabajo filtra el Tarifario en vivo con precio y hasta cinco opciones',()=>{
 const wizard=read('../public/quote-wizard.js');
 assert.match(wizard,/data-qw-live-tariffs/);
 assert.match(wizard,/findTariffMatches\(tariffs,query,5\)/);
 assert.match(wizard,/Coincidencias del Tarifario/);
 assert.match(wizard,/money\(tariff\.precio\).*tariff\.unidad/s);
 assert.doesNotMatch(wizard,/data-qw-run-tariff-search/);
 assert.doesNotMatch(wizard,/data-qw-reference-search-input/);
 assert.doesNotMatch(wizard,/Buscar referencia/);
 assert.doesNotMatch(wizard,/data-estimator-view="tariff"/);
 assert.doesNotMatch(wizard,/<iframe/i);
});

test('la búsqueda parcial encuentra referencias sin exigir el nombre exacto',()=>{
 const catalog=[
  {key:'1',tarea:'Revoque fino interior',rubro:'Revoques',unidad:'m²',precio:18000},
  {key:'2',tarea:'Pintura látex interior',rubro:'Pintura',unidad:'m²',precio:12000}
 ];
 const result=findTariffMatches(catalog,'revo',5);
 assert.ok(result.matches.length>0);
 assert.equal(result.matches[0].tariff.key,'1');
});

test('editar el nombre del trabajo no borra Manual, Jornal ni Relevamiento',()=>{
 const wizard=read('../public/quote-wizard.js');
 const handler=wizard.slice(wizard.indexOf('function handleWorkInput'),wizard.indexOf("document.addEventListener('click'"));
 assert.match(handler,/if\(key==='description'\)item\.description=target\.value/);
 assert.doesNotMatch(handler,/clearReference\(item\)/);
});

test('manual, jornal y relevamiento tienen impacto comercial explícito',()=>{
 const manual=normaliseWork({quantity:3,unitPrice:20000,tariffKind:'manual-reference'});
 const jornal=normaliseWork({workers:2,hours:4,tariffKind:'jornal'});
 const visit=normaliseWork({tariffKind:'visit-pending',tariffPrice:55000});
 assert.equal(commercialReferenceTotal(manual),60000);
 assert.equal(commercialReferenceTotal(jornal),jornalReference(jornal));
 assert.equal(commercialReferenceTotal(visit),0);
 const wizard=read('../public/quote-wizard.js');
 assert.match(wizard,/No modifica el Tarifario/);
 assert.match(wizard,/suma esta referencia al total del presupuesto inmediatamente/);
 assert.match(wizard,/No se suma un precio de obra ni una visita automática al presupuesto/);
});

test('mantiene prohibidos important, reload e iframe',()=>{
 const wizard=read('../public/quote-wizard.js');
 assert.doesNotMatch(wizard,/!important/);
 assert.doesNotMatch(wizard,/(?:window\.)?location\.reload\s*\(/);
 assert.doesNotMatch(wizard,/<iframe/i);
});
