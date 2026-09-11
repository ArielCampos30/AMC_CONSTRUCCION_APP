export const DEFAULT_QUOTE_SETTINGS=Object.freeze({
 employeeDay:30000,
 travelDefault:12000,
 shortDay:55000,
 halfDay:90000,
 fullDay:115000
});

export function amount(value,fallback=0){
 const number=Number(value);
 return Number.isFinite(number)&&number>=0?number:fallback;
}

export function normaliseWork(raw={},fallbackDescription=''){
 const details=raw.details||{};
 return {
  id:String(raw.id||''),
  description:String(raw.description||raw.clientDescription||raw.title||raw.name||raw.tarea||fallbackDescription||'').trim(),
  quantity:amount(raw.quantity??details.quantity,1),
  unit:String(raw.unit||details.unit||'unidad'),
  unitPrice:amount(raw.unitPrice??details.unitPrice,0),
  materials:amount(raw.materials??details.materials,0),
  tools:amount(raw.tools??details.tools,0),
  other:amount(raw.other??details.other,0),
  workers:Math.max(1,Math.ceil(amount(raw.workers??details.workers,1)||1)),
  days:Math.max(1,Math.ceil(amount(raw.days??raw.m2Days??details.m2Days,1)||1)),
  hours:Math.max(.25,amount(raw.hours??details.hours,8)||8)
 };
}

export const workDirectCost=work=>amount(work?.materials)+amount(work?.tools)+amount(work?.other);
export const directCostTotal=(works=[],travel=0)=>amount(travel)+works.reduce((sum,work)=>sum+workDirectCost(work),0);
export const measuredReference=work=>amount(work?.quantity,1)*amount(work?.unitPrice);
export const workLaborCost=(work,employeeDay=DEFAULT_QUOTE_SETTINGS.employeeDay)=>Math.max(1,Math.ceil(amount(work?.workers,1)||1))*Math.max(1,Math.ceil(amount(work?.days,1)||1))*amount(employeeDay);
export const laborCostTotal=(works=[],employeeDay=DEFAULT_QUOTE_SETTINGS.employeeDay)=>works.reduce((sum,work)=>sum+workLaborCost(work,employeeDay),0);
export const internalCostTotal=(works=[],travel=0,employeeDay=DEFAULT_QUOTE_SETTINGS.employeeDay)=>directCostTotal(works,travel)+laborCostTotal(works,employeeDay);

export function jornalTier(hours,settings=DEFAULT_QUOTE_SETTINGS){
 const value=Math.max(.25,amount(hours,8)||8);
 if(value<=2)return {label:'Salida hasta 2 h',rate:amount(settings.shortDay),days:1};
 if(value<=4)return {label:'Media jornada',rate:amount(settings.halfDay),days:1};
 if(value<=8)return {label:'Jornada completa',rate:amount(settings.fullDay),days:1};
 const days=Math.ceil(value/8);
 return {label:`${days} jornadas`,rate:amount(settings.fullDay),days};
}

export function jornalReference(work,settings=DEFAULT_QUOTE_SETTINGS){
 const tier=jornalTier(work?.hours,settings);
 return tier.days*Math.max(1,Math.ceil(amount(work?.workers,1)||1))*tier.rate;
}
