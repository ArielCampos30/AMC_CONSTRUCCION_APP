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
  labor:amount(raw.labor??details.labor,0),
  workers:Math.max(1,Math.ceil(amount(raw.workers??details.workers,1)||1)),
  days:Math.max(1,Math.ceil(amount(raw.days??raw.m2Days??details.m2Days,1)||1)),
  hours:Math.max(.25,amount(raw.hours??details.hours,8)||8),
  tariffKey:String(raw.tariffKey??details.tariffKey??''),
  tariffTask:String(raw.tariffTask??details.tariffTask??''),
  tariffRubric:String(raw.tariffRubric??details.tariffRubric??''),
  tariffUnit:String(raw.tariffUnit??details.tariffUnit??''),
  tariffPrice:amount(raw.tariffPrice??details.tariffPrice,0),
  tariffKind:String(raw.tariffKind??details.tariffKind??'')
 };
}

export const workDirectCost=work=>amount(work?.materials)+amount(work?.tools)+amount(work?.other);
export const directCostTotal=(works=[],travel=0)=>amount(travel)+works.reduce((sum,work)=>sum+workDirectCost(work),0);
export const workLoadedInternalCost=work=>workDirectCost(work)+amount(work?.labor);
export const measuredReference=work=>amount(work?.quantity,1)*amount(work?.unitPrice);
export const tariffReferenceTotal=work=>amount(work?.quantity,1)*amount(work?.tariffPrice);
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

export function commercialReferenceTotal(work,settings=DEFAULT_QUOTE_SETTINGS){
 if(!work||work.tariffKind==='visit-pending')return 0;
 if(work.tariffKind==='jornal')return jornalReference(work,settings);
 if(amount(work.tariffPrice)>0)return tariffReferenceTotal(work);
 if(work.tariffKind==='manual-reference'||amount(work.unitPrice)>0)return measuredReference(work);
 return 0;
}

export function profitabilityCostTotal(works=[],travel=0){
 const priced=(Array.isArray(works)?works:[]).filter(work=>work?.tariffKind!=='visit-pending'&&commercialReferenceTotal(work)>0);
 if(!priced.length)return 0;
 return amount(travel)+priced.reduce((sum,work)=>sum+workLoadedInternalCost(work),0);
}

export function profitabilitySnapshot(price,cost){
 const sale=amount(price),internal=amount(cost),gain=sale-internal;
 return {price:sale,cost:internal,gain,margin:sale>0?gain/sale*100:0};
}

export function suggestedPriceForMargin(cost,margin){
 const internal=amount(cost),goal=Math.min(95,amount(margin));
 const ratio=goal/100;
 return ratio>=0&&ratio<1?internal/(1-ratio):0;
}

const STOP_WORDS=new Set(['de','del','la','las','el','los','un','una','unos','unas','y','o','en','para','por','con','sin','al','a','que','se','hacer','trabajo','trabajos','servicio','servicios']);
const GENERIC_PATTERNS=[
 /\barreglos? varios?\b/,
 /\bvarios arreglos?\b/,
 /\breparaciones? varias?\b/,
 /\bvarias reparaciones?\b/,
 /\bcosas? varias?\b/,
 /\bmantenimiento general\b/,
 /\btrabajos? varios?\b/
];

export function normalizeSearchText(value=''){
 return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9²]+/g,' ').replace(/\s+/g,' ').trim();
}

function searchTerms(value){return normalizeSearchText(value).split(' ').filter(word=>word.length>2&&!STOP_WORDS.has(word));}

export function isGenericWorkDescription(description=''){
 const value=normalizeSearchText(description);
 if(!value)return false;
 if(GENERIC_PATTERNS.some(pattern=>pattern.test(value)))return true;
 if(/^(ver|revisar|visita|presupuestar|cotizar|diagnosticar)\b/.test(value))return true;
 if(/\b(no se|a revisar|para revisar|hay que ver|ver que|revisar que)\b/.test(value))return true;
 return false;
}

function scoreTariff(tariff,description){
 const query=normalizeSearchText(description),task=normalizeSearchText(tariff?.tarea),rubric=normalizeSearchText(tariff?.rubro),notes=normalizeSearchText(tariff?.obs);
 if(!query||!task)return 0;
 if(task===query)return 140;
 let score=0;
 if(task.includes(query))score+=80;
 if(query.includes(task)&&task.length>5)score+=68;
 const terms=searchTerms(query),taskTerms=new Set(searchTerms(task)),haystack=`${task} ${rubric} ${notes}`;
 let matched=0;
 for(const term of terms){
  if(taskTerms.has(term)){score+=18;matched++;continue;}
  if(task.includes(term)){score+=12;matched++;continue;}
  if(haystack.includes(term)){score+=5;matched++;}
 }
 if(terms.length){
  const coverage=matched/terms.length;
  score+=Math.round(coverage*32);
  if(coverage<.5)score-=20;
 }
 if(rubric&&query.includes(rubric))score+=8;
 return Math.max(0,score);
}

export function findTariffMatches(catalog=[],description='',limit=3){
 if(isGenericWorkDescription(description))return {status:'visit',matches:[]};
 const query=normalizeSearchText(description),terms=searchTerms(description);
 const ranked=(Array.isArray(catalog)?catalog:[]).map(tariff=>({tariff,score:scoreTariff(tariff,description)})).filter(item=>item.score>0&&amount(item.tariff?.precio)>0).sort((a,b)=>b.score-a.score||String(a.tariff?.tarea||'').localeCompare(String(b.tariff?.tarea||''))).slice(0,Math.max(1,limit));
 if(!ranked.length||ranked[0].score<42)return {status:'none',matches:ranked};
 const best=ranked[0],second=ranked[1],exact=normalizeSearchText(best.tariff?.tarea)===query,gap=second?best.score-second.score:best.score;
 const clear=exact||!second||gap>=18||(terms.length>=2&&best.score>=72&&gap>=8);
 return {status:clear?'matched':'ambiguous',matches:ranked};
}

export function visitTariff(catalog=[]){
 const list=Array.isArray(catalog)?catalog:[];
 return list.find(tariff=>normalizeSearchText(tariff?.tarea).includes('salida corta hasta 2 h'))||null;
}
