import {DEFAULT_TARIFF_ITEMS,DEFAULT_TARIFF_META,DEFAULT_TARIFF_RUBRICS} from './tariff-defaults.mjs';

export const TARIFF_CATALOG_ID='tariff-catalog-main';
const text=(value,max=500)=>String(value??'').trim().slice(0,max);
const number=value=>{const parsed=Number(value);return Number.isFinite(parsed)&&parsed>=0?parsed:0;};
const clean=value=>text(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const slug=value=>clean(value).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,48)||'rubro';
const clone=value=>JSON.parse(JSON.stringify(value));
const catalogError=(status,message)=>{const error=new Error(message);error.statusCode=status;throw error;};

function defaultRubrics(){return DEFAULT_TARIFF_RUBRICS.map(item=>({...item}));}
function defaultItems(){return DEFAULT_TARIFF_ITEMS.map(item=>({...item}));}

export function defaultTariffCatalog(){
 return {
  id:TARIFF_CATALOG_ID,
  schemaVersion:1,
  meta:{...DEFAULT_TARIFF_META,sources:[...DEFAULT_TARIFF_META.sources]},
  rubrics:defaultRubrics(),
  items:defaultItems(),
  seededAt:DEFAULT_TARIFF_META.baseDate,
  updatedAt:DEFAULT_TARIFF_META.baseDate,
  updatedBy:'seed',
  lastAction:'seed'
 };
}

function normalizeRubrics(raw=[]){
 const seenIds=new Set(),seenNames=new Set(),rows=[];
 for(const item of Array.isArray(raw)?raw:[]){
  const name=text(item?.name,80),id=text(item?.id,60)||slug(name),nameKey=clean(name);
  if(!name||!id||seenIds.has(id)||seenNames.has(nameKey))continue;
  seenIds.add(id);seenNames.add(nameKey);rows.push({id,name});
 }
 return rows;
}

function normalizeItems(raw=[],rubrics=[]){
 const rubricIds=new Set(rubrics.map(item=>item.id)),seenIds=new Set(),rows=[];
 for(const item of Array.isArray(raw)?raw:[]){
  const id=text(item?.id,80),rubricId=text(item?.rubricId,60),tarea=text(item?.tarea,160),unidad=text(item?.unidad,30)||'unidad',precio=number(item?.precio);
  if(!id||!rubricIds.has(rubricId)||!tarea||precio<=0||seenIds.has(id))continue;
  seenIds.add(id);rows.push({id,rubricId,tarea,unidad,precio:Math.round(precio),tipo:text(item?.tipo,40)||'mano_obra',fecha:text(item?.fecha,20),obs:text(item?.obs,500)});
 }
 return rows;
}

export function normalizeTariffCatalog(raw={}){
 const fallback=defaultTariffCatalog();
 const rubrics=normalizeRubrics(raw?.rubrics);
 const finalRubrics=rubrics.length?rubrics:fallback.rubrics;
 const items=normalizeItems(raw?.items,finalRubrics);
 return {
  id:TARIFF_CATALOG_ID,
  schemaVersion:1,
  meta:{...fallback.meta,...(raw?.meta&&typeof raw.meta==='object'?raw.meta:{}),sources:Array.isArray(raw?.meta?.sources)?raw.meta.sources.map(value=>text(value,180)).filter(Boolean):fallback.meta.sources},
  rubrics:finalRubrics,
  items:items.length||Array.isArray(raw?.items)?items:fallback.items,
  seededAt:text(raw?.seededAt,40)||fallback.seededAt,
  updatedAt:text(raw?.updatedAt,40)||fallback.updatedAt,
  updatedBy:text(raw?.updatedBy,120)||fallback.updatedBy,
  lastAction:text(raw?.lastAction,80)||fallback.lastAction
 };
}

export function loadTariffCatalog(all){
 const saved=(typeof all==='function'?all('tariffCatalog'):[]).find(item=>item?.id===TARIFF_CATALOG_ID);
 return saved?normalizeTariffCatalog(saved):defaultTariffCatalog();
}

function rubricNameMap(catalog){return new Map(catalog.rubrics.map(item=>[item.id,item.name]));}

export function estimatorTariffs(source={}){
 // Compatibilidad temporal para pruebas/datos heredados: si recibe el viejo estado
 // del estimador, sólo lo interpreta; producción usa el catálogo independiente.
 if(!Array.isArray(source?.items)&&!Array.isArray(source?.rubrics)&&(source?.overrides||source?.customTariffs)){
  const base=defaultTariffCatalog(),overrides=source?.overrides&&typeof source.overrides==='object'?source.overrides:{},custom=Array.isArray(source?.customTariffs)?source.customTariffs:[];
  for(const item of base.items){if(Object.prototype.hasOwnProperty.call(overrides,item.tarea))item.precio=number(overrides[item.tarea])||item.precio;}
  for(const [index,item] of custom.entries()){
   const rubro=text(item?.rubro,80),rubric=base.rubrics.find(entry=>clean(entry.name)===clean(rubro));
   if(!rubric)continue;
   const tarea=text(item?.tarea,160),precio=number(item?.precio);if(!tarea||precio<=0)continue;
   base.items.push({id:`legacy-${text(item?.id,60)||index}`,rubricId:rubric.id,tarea,unidad:text(item?.unidad,30)||'unidad',precio,tipo:text(item?.tipo,40)||'mano_obra',fecha:text(item?.fecha,20),obs:text(item?.obs,500)});
  }
  source=base;
 }
 const catalog=normalizeTariffCatalog(source),names=rubricNameMap(catalog),rubricOrder=new Map(catalog.rubrics.map((item,index)=>[item.id,index]));
 return catalog.items.map(item=>({
  id:item.id,
  key:`tariff:${item.id}`,
  rubricId:item.rubricId,
  rubro:names.get(item.rubricId)||'Otros',
  tarea:item.tarea,
  unidad:item.unidad,
  precio:item.precio,
  tipo:item.tipo,
  fecha:item.fecha,
  obs:item.obs,
  custom:true
 })).sort((a,b)=>(rubricOrder.get(a.rubricId)??999)-(rubricOrder.get(b.rubricId)??999)||a.tarea.localeCompare(b.tarea,'es'));
}

export function tariffCatalogPayload(catalog){
 const normalized=normalizeTariffCatalog(catalog);
 return {items:estimatorTariffs(normalized),rubrics:clone(normalized.rubrics),meta:clone(normalized.meta),updatedAt:normalized.updatedAt,updatedBy:normalized.updatedBy,lastAction:normalized.lastAction};
}

function requireRubric(catalog,rubricId){
 const rubric=catalog.rubrics.find(item=>item.id===text(rubricId,60));
 if(!rubric)catalogError(404,'El rubro ya no existe.');
 return rubric;
}
function duplicateRubric(catalog,name,exceptId=''){return catalog.rubrics.some(item=>item.id!==exceptId&&clean(item.name)===clean(name));}
function duplicateTask(catalog,rubricId,tarea,exceptId=''){return catalog.items.some(item=>item.id!==exceptId&&item.rubricId===rubricId&&clean(item.tarea)===clean(tarea));}
function validPrice(value){const price=Number(value);return Number.isFinite(price)&&price>0&&price<=1_000_000_000?Math.round(price):0;}
function touch(catalog,{now='',actor='',action=''}){catalog.updatedAt=text(now,40)||new Date().toISOString();catalog.updatedBy=text(actor,120)||'admin';catalog.lastAction=text(action,80);return catalog;}

export function mutateTariffCatalog(input,command={},context={}){
 const catalog=normalizeTariffCatalog(input),action=text(command?.action,60),stamp=text(context?.now,40)||new Date().toISOString(),actor=text(context?.actor,120)||'admin',hash=typeof context?.sha==='function'?context.sha:value=>slug(value);
 if(!action)catalogError(400,'Falta indicar la acción del Tarifario.');

 if(action==='create-rubric'){
  const name=text(command?.name,80);if(!name)catalogError(400,'Ingresá el nombre del rubro.');if(duplicateRubric(catalog,name))catalogError(409,'Ya existe un rubro con ese nombre.');
  let id=slug(name);if(catalog.rubrics.some(item=>item.id===id))id=`${id}-${text(hash(`${name}:${stamp}`),12)}`;
  catalog.rubrics.push({id,name});return touch(catalog,{now:stamp,actor,action});
 }
 if(action==='rename-rubric'){
  const rubric=requireRubric(catalog,command?.rubricId),name=text(command?.name,80);if(!name)catalogError(400,'Ingresá el nuevo nombre del rubro.');if(duplicateRubric(catalog,name,rubric.id))catalogError(409,'Ya existe un rubro con ese nombre.');
  rubric.name=name;return touch(catalog,{now:stamp,actor,action});
 }
 if(action==='delete-rubric'){
  const rubric=requireRubric(catalog,command?.rubricId),count=catalog.items.filter(item=>item.rubricId===rubric.id).length;if(count)catalogError(409,`El rubro tiene ${count} trabajo${count===1?'':'s'}. Eliminá o mové esos trabajos antes de borrar el rubro.`);
  catalog.rubrics=catalog.rubrics.filter(item=>item.id!==rubric.id);return touch(catalog,{now:stamp,actor,action});
 }
 if(action==='create-item'){
  const rubric=requireRubric(catalog,command?.rubricId),tarea=text(command?.tarea,160),unidad=text(command?.unidad,30)||'unidad',precio=validPrice(command?.precio),obs=text(command?.obs,500);
  if(!tarea)catalogError(400,'Ingresá el nombre del trabajo.');if(!precio)catalogError(400,'Ingresá un precio mayor a cero.');if(duplicateTask(catalog,rubric.id,tarea))catalogError(409,'Ese trabajo ya existe dentro del rubro.');
  const id=`tar-${text(hash(`${rubric.id}:${tarea}:${stamp}`),20)}`;catalog.items.push({id,rubricId:rubric.id,tarea,unidad,precio,tipo:'mano_obra',fecha:stamp.slice(0,10),obs});return touch(catalog,{now:stamp,actor,action});
 }
 if(action==='update-item'){
  const item=catalog.items.find(row=>row.id===text(command?.itemId,80));if(!item)catalogError(404,'El trabajo ya no existe.');const rubric=requireRubric(catalog,command?.rubricId||item.rubricId),tarea=text(command?.tarea??item.tarea,160),unidad=text(command?.unidad??item.unidad,30)||'unidad',precio=validPrice(command?.precio??item.precio),obs=text(command?.obs??item.obs,500);
  if(!tarea)catalogError(400,'Ingresá el nombre del trabajo.');if(!precio)catalogError(400,'Ingresá un precio mayor a cero.');if(duplicateTask(catalog,rubric.id,tarea,item.id))catalogError(409,'Ese trabajo ya existe dentro del rubro.');
  Object.assign(item,{rubricId:rubric.id,tarea,unidad,precio,obs,tipo:'mano_obra',fecha:stamp.slice(0,10)});return touch(catalog,{now:stamp,actor,action});
 }
 if(action==='delete-item'){
  const itemId=text(command?.itemId,80);if(!catalog.items.some(item=>item.id===itemId))catalogError(404,'El trabajo ya no existe.');catalog.items=catalog.items.filter(item=>item.id!==itemId);return touch(catalog,{now:stamp,actor,action});
 }
 if(action==='bulk-increase'){
  const percent=Number(command?.percent);if(!Number.isFinite(percent)||percent<=0||percent>1000)catalogError(400,'Ingresá un porcentaje mayor a 0 y menor o igual a 1000.');
  const requested=Array.isArray(command?.itemIds)?new Set(command.itemIds.map(value=>text(value,80)).filter(Boolean)):new Set(),rubricId=text(command?.rubricId,60);if(!requested.size&&!rubricId)catalogError(400,'Elegí un rubro o trabajos seleccionados.');if(rubricId)requireRubric(catalog,rubricId);
  const targets=catalog.items.filter(item=>requested.size?requested.has(item.id):item.rubricId===rubricId);if(!targets.length)catalogError(400,'No hay trabajos para actualizar.');
  for(const item of targets){item.precio=Math.max(1,Math.round(item.precio*(1+percent/100)));item.fecha=stamp.slice(0,10);}return touch(catalog,{now:stamp,actor,action});
 }
 catalogError(400,'Acción del Tarifario no reconocida.');
}

export function baseTariffCount(){return DEFAULT_TARIFF_ITEMS.length;}
