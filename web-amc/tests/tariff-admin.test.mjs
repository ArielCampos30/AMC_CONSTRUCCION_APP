import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {applyTariffSelection} from '../public/quote-wizard-model.js';
import {defaultTariffCatalog,estimatorTariffs,loadTariffCatalog,mutateTariffCatalog,tariffCatalogPayload,TARIFF_CATALOG_ID} from '../tariff-catalog.mjs';
import {adminUtilityRoutes} from '../admin-utility-routes.mjs';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const context={now:'2026-09-12T21:30:00-03:00',actor:'admin-1',sha:value=>'abc123def4567890'+String(value).length};

test('base comercial contiene sólo los seis rubros definidos para AMC',()=>{
 const catalog=defaultTariffCatalog();
 assert.deepEqual(catalog.rubrics.map(item=>item.name),['Albañilería','Plomería','Herrería','Electricidad','Gas','Pinturería']);
 assert.ok(catalog.items.length>=50);
 assert.ok(catalog.items.every(item=>catalog.rubrics.some(rubric=>rubric.id===item.rubricId)));
 assert.ok(catalog.items.every(item=>item.precio>0&&item.tipo==='mano_obra'));
 assert.match(catalog.meta.region,/La Falda|Punilla/);
});

test('CRUD de rubros y trabajos valida duplicados y protege rubros con trabajos',()=>{
 let catalog=defaultTariffCatalog();
 catalog=mutateTariffCatalog(catalog,{action:'create-rubric',name:'Impermeabilización'},context);
 const rubric=catalog.rubrics.find(item=>item.name==='Impermeabilización');assert.ok(rubric);
 catalog=mutateTariffCatalog(catalog,{action:'rename-rubric',rubricId:rubric.id,name:'Aislaciones'},context);
 assert.equal(catalog.rubrics.find(item=>item.id===rubric.id).name,'Aislaciones');
 catalog=mutateTariffCatalog(catalog,{action:'create-item',rubricId:rubric.id,tarea:'Membrana líquida',unidad:'m²',precio:12345,obs:'Prueba'},context);
 const item=catalog.items.find(row=>row.tarea==='Membrana líquida');assert.ok(item);assert.equal(item.precio,12345);
 assert.throws(()=>mutateTariffCatalog(catalog,{action:'create-item',rubricId:rubric.id,tarea:'Membrana líquida',unidad:'m²',precio:14000},context),/ya existe/i);
 assert.throws(()=>mutateTariffCatalog(catalog,{action:'delete-rubric',rubricId:rubric.id},context),/tiene 1 trabajo/i);
 catalog=mutateTariffCatalog(catalog,{action:'update-item',itemId:item.id,rubricId:rubric.id,tarea:'Membrana líquida aplicada',unidad:'m²',precio:15000,obs:'Actualizada'},context);
 assert.equal(catalog.items.find(row=>row.id===item.id).precio,15000);
 catalog=mutateTariffCatalog(catalog,{action:'delete-item',itemId:item.id},context);
 catalog=mutateTariffCatalog(catalog,{action:'delete-rubric',rubricId:rubric.id},context);
 assert.equal(catalog.rubrics.some(row=>row.id===rubric.id),false);
});

test('aumento masivo funciona por rubro y por selección',()=>{
 let catalog=defaultTariffCatalog();
 const masonry=catalog.rubrics.find(item=>item.name==='Albañilería');
 const before=new Map(catalog.items.filter(item=>item.rubricId===masonry.id).map(item=>[item.id,item.precio]));
 catalog=mutateTariffCatalog(catalog,{action:'bulk-increase',rubricId:masonry.id,percent:10},context);
 for(const item of catalog.items.filter(item=>item.rubricId===masonry.id))assert.equal(item.precio,Math.round(before.get(item.id)*1.10));
 const chosen=catalog.items.filter(item=>item.rubricId!==masonry.id).slice(0,2),chosenBefore=chosen.map(item=>item.precio);
 catalog=mutateTariffCatalog(catalog,{action:'bulk-increase',itemIds:chosen.map(item=>item.id),percent:5},context);
 chosen.forEach((item,index)=>assert.equal(catalog.items.find(row=>row.id===item.id).precio,Math.round(chosenBefore[index]*1.05)));
 assert.throws(()=>mutateTariffCatalog(catalog,{action:'bulk-increase',rubricId:masonry.id,percent:0},context),/porcentaje/i);
});

test('un presupuesto conserva la referencia histórica aunque el Tarifario cambie',()=>{
 let catalog=defaultTariffCatalog();
 const tariff=estimatorTariffs(catalog).find(item=>item.tarea==='Revoque fino');
 const work=applyTariffSelection({id:'w1',quantity:10},tariff);
 const historical=work.tariffPrice;
 catalog=mutateTariffCatalog(catalog,{action:'update-item',itemId:tariff.id,rubricId:tariff.rubricId,tarea:tariff.tarea,unidad:tariff.unidad,precio:historical+5000,obs:tariff.obs},context);
 assert.equal(work.tariffPrice,historical);
 assert.equal(estimatorTariffs(catalog).find(item=>item.id===tariff.id).precio,historical+5000);
});

test('endpoint POST persiste catálogo independiente y GET lo entrega al Cotizador',()=>{
 const docs=[];let sent=null,adminChecks=0;
 const all=kind=>kind==='tariffCatalog'?docs:[];
 const put=(kind,owner,body)=>{assert.equal(kind,'tariffCatalog');assert.equal(owner,'');const at=docs.findIndex(row=>row.id===body.id);if(at>=0)docs[at]=body;else docs.push(body);return body;};
 const route=adminUtilityRoutes({all,get:()=>null,put,requireAdmin:()=>{adminChecks++;},safeFile:()=>null,send:(_res,status,payload)=>{sent={status,payload};},fail:(status,message)=>{throw Object.assign(new Error(message),{status});},text:value=>String(value||''),sha:value=>'abc'+String(value).length,now:()=>context.now});
 assert.equal(route({p:'/api/estimator-tariffs',method:'POST',b:{action:'create-item',rubricId:'plomeria',tarea:'Trabajo prueba',unidad:'unidad',precio:123000,obs:''},user:{id:'admin-1'},res:{}}),true);
 assert.equal(sent.status,200);assert.equal(docs[0].id,TARIFF_CATALOG_ID);assert.ok(sent.payload.items.some(item=>item.tarea==='Trabajo prueba'));
 route({p:'/api/estimator-tariffs',method:'GET',b:{},user:{id:'admin-1'},res:{}});
 assert.ok(sent.payload.items.some(item=>item.tarea==='Trabajo prueba'));assert.equal(adminChecks,2);
});

test('catálogo ya no depende en ejecución del HTML del estimador legacy',()=>{
 const catalog=read('../tariff-catalog.mjs'),routes=read('../admin-utility-routes.mjs'),ui=read('../public/tariff-ui.js');
 assert.doesNotMatch(catalog,/tarifario-base-source\.html|readFileSync/);
 assert.doesNotMatch(routes,/all\('estimator'/);
 assert.match(routes,/all\('tariffCatalog'/);
 assert.match(ui,/data-tariff-new-item/);
 assert.match(ui,/data-tariff-rubrics/);
 assert.match(ui,/data-tariff-bulk/);
 assert.match(ui,/Vista previa/);
 assert.match(ui,/data-tariff-delete-item/);
 assert.doesNotMatch(ui,/quote-save|quote-pdf|createQuoteWizard|\/api\/quotes/);
});

test('payload público mantiene contrato que consume el Cotizador',()=>{
 const payload=tariffCatalogPayload(loadTariffCatalog(()=>[]));
 const sample=payload.items[0];
 assert.ok(sample.key.startsWith('tariff:'));
 for(const field of ['rubro','tarea','unidad','precio'])assert.ok(Object.hasOwn(sample,field));
 assert.equal(payload.rubrics.length,6);
});
