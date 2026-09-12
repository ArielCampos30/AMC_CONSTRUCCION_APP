import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {findTariffMatches,isGenericWorkDescription,tariffReferenceTotal,normaliseWork,commercialReferenceTotal} from '../public/quote-wizard-model.js';
import {baseTariffCount,estimatorTariffs} from '../legacy-tariff-catalog.mjs';
import {adminUtilityRoutes} from '../admin-utility-routes.mjs';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const sample=[
 {key:'a',rubro:'Albañilería',tarea:'Revoque fino',unidad:'m²',precio:18000,obs:'Terminación fina'},
 {key:'b',rubro:'Albañilería',tarea:'Revoque completo',unidad:'m²',precio:24000,obs:''},
 {key:'c',rubro:'Albañilería',tarea:'Colocación de cerámica',unidad:'m²',precio:25000,obs:''},
 {key:'d',rubro:'Jornales y estructura',tarea:'Salida corta hasta 2 h - 1 operario',unidad:'salida',precio:55000,obs:''}
];

test('reconoce referencias claras y no toma arreglos varios como tarifa literal',()=>{
 const revoque=findTariffMatches(sample,'revoque fino');
 assert.equal(revoque.status,'matched');
 assert.equal(revoque.matches[0].tariff.tarea,'Revoque fino');
 assert.equal(isGenericWorkDescription('Arreglos varios'),true);
 assert.equal(findTariffMatches(sample,'Arreglos varios').status,'visit');
 assert.equal(findTariffMatches(sample,'Revisar humedad').status,'visit');
 const work=normaliseWork({quantity:12,tariffPrice:18000});
 assert.equal(tariffReferenceTotal(work),216000);
 assert.equal(commercialReferenceTotal(work),216000);
});

test('usa como fuente el tarifario legado con overrides y trabajos propios hasta migrar Tarifario',()=>{
 assert.ok(baseTariffCount()>20);
 const base=estimatorTariffs({overrides:{'Revoque fino':19999},customTariffs:[{id:'propio-1',rubro:'Propios',tarea:'Prueba propia',unidad:'unidad',precio:77777,custom:true}]});
 assert.equal(base.find(item=>item.tarea==='Revoque fino')?.precio,19999);
 assert.equal(base.find(item=>item.tarea==='Prueba propia')?.precio,77777);
});

test('endpoint de referencias exige administrador y devuelve el tarifario vigente',()=>{
 let checked=false,sent=null;
 const route=adminUtilityRoutes({
  all:(type)=>type==='estimator'?[{db:{overrides:{'Revoque fino':21000},customTariffs:[]},updatedAt:'2026-09-11'}]:[],
  get:()=>null,put:()=>null,
  requireAdmin:()=>{checked=true;},safeFile:()=>null,
  send:(_res,status,payload)=>{sent={status,payload};},fail:()=>{},text:value=>String(value||''),sha:value=>String(value),now:()=>''
 });
 const handled=route({p:'/api/estimator-tariffs',method:'GET',b:{},user:{id:'admin'},res:{}});
 assert.equal(handled,true);
 assert.equal(checked,true);
 assert.equal(sent.status,200);
 assert.ok(sent.payload.items.some(item=>item.tarea==='Revoque fino'&&item.precio===21000));
});

test('editor consulta referencias filtradas y no ofrece un relevamiento sin precio',()=>{
 const wizard=read('../public/quote-wizard.js');
 assert.doesNotMatch(wizard,/Precio base AMC \/ unidad/);
 assert.match(wizard,/\/api\/estimator-tariffs/);
 assert.match(wizard,/Referencia del Tarifario/);
 assert.match(wizard,/findTariffMatches\(tariffs,query,5\)/);
 assert.match(wizard,/Completá el relevamiento fuera del presupuesto/i);
 assert.doesNotMatch(wizard,/data-qw-pricing-mode="visit"/);
 assert.doesNotMatch(wizard,/data-estimator-view="tariff"/);
 assert.doesNotMatch(wizard,/<iframe/i);
 assert.doesNotMatch(wizard,/!important/);
 assert.doesNotMatch(wizard,/(?:window\.)?location\.reload\s*\(/);
});
