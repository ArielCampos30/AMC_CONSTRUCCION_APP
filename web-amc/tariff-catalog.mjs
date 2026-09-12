import {readFileSync} from 'node:fs';

function extractArray(source,marker){
 const markerAt=source.indexOf(marker);
 if(markerAt<0)throw new Error('No se encontró el tarifario base de AMC.');
 const start=source.indexOf('[',markerAt+marker.length);
 if(start<0)throw new Error('El tarifario base no contiene un arreglo válido.');
 let depth=0,quote='',escaped=false;
 for(let index=start;index<source.length;index++){
  const char=source[index];
  if(quote){
   if(escaped){escaped=false;continue;}
   if(char==='\\'){escaped=true;continue;}
   if(char===quote)quote='';
   continue;
  }
  if(char==='"'||char==="'"){quote=char;continue;}
  if(char==='[')depth++;
  if(char===']'&&--depth===0)return JSON.parse(source.slice(start,index+1));
 }
 throw new Error('No se pudo cerrar el arreglo del tarifario base.');
}

const source=readFileSync(new URL('./data/tarifario-base-source.html',import.meta.url),'utf8');
const BASE_TARIFF=Object.freeze(extractArray(source,'const BASE_TARIFF = ').map(item=>Object.freeze({...item})));
const number=value=>{const parsed=Number(value);return Number.isFinite(parsed)&&parsed>=0?parsed:0;};
const text=value=>String(value??'').trim();

export function estimatorTariffs(db={}){
 const overrides=db?.overrides&&typeof db.overrides==='object'?db.overrides:{};
 const custom=Array.isArray(db?.customTariffs)?db.customTariffs:[];
 const combined=[...BASE_TARIFF.map((item,index)=>({...item,key:`base:${index}`,custom:false})),...custom.map((item,index)=>({...item,key:`custom:${text(item.id)||index}`,custom:true}))];
 return combined.map(item=>({
  key:text(item.key),
  rubro:text(item.rubro)||'Otros',
  tarea:text(item.tarea),
  unidad:text(item.unidad)||'unidad',
  precio:item.custom?number(item.precio):number(Object.prototype.hasOwnProperty.call(overrides,item.tarea)?overrides[item.tarea]:item.precio),
  tipo:text(item.tipo),
  fecha:text(item.fecha),
  obs:text(item.obs),
  custom:Boolean(item.custom)
 })).filter(item=>item.tarea&&item.precio>0);
}

export function baseTariffCount(){return BASE_TARIFF.length;}
