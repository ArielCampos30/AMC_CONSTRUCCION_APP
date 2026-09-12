import {amount,commercialReferenceTotal} from './quote-wizard-model.js';

const MEASURED_UNITS=new Set(['m²','m2','m^2','m³','m3','m^3','ml','m.l.','metro lineal','metros lineales']);
const normalizedUnit=value=>String(value||'').trim().toLowerCase().replace(/\s+/g,' ');
const requiresMeasuredQuantity=unit=>MEASURED_UNITS.has(normalizedUnit(unit));
const money=value=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(Number.isFinite(Number(value))?Number(value):0);

function quantityLabel(unit){
 const value=normalizedUnit(unit);
 if(['m²','m2','m^2'].includes(value))return 'metros cuadrados (m²)';
 if(['m³','m3','m^3'].includes(value))return 'metros cúbicos (m³)';
 if(['ml','m.l.','metro lineal','metros lineales'].includes(value))return 'metros lineales (ml)';
 return 'unidades';
}

function isMeasuredHelp(node){
 if(!node?.classList?.contains('quote-price-help'))return false;
 const text=String(node.textContent||'');
 return node.dataset.qwMeasuredHelp==='1'||text.includes('Falta este dato')||text.includes('Ingresá los ');
}

function ensureMeasuredHelp(totalBox,quantity,unit){
 const previous=totalBox?.previousElementSibling;
 if(quantity>0){if(isMeasuredHelp(previous))previous.remove();return;}
 if(isMeasuredHelp(previous))return;
 const help=document.createElement('p');
 help.className='quote-price-help';
 help.dataset.qwMeasuredHelp='1';
 const strong=document.createElement('strong');
 strong.textContent='Falta este dato:';
 help.append(strong,document.createTextNode(` ingresá los ${quantityLabel(unit)} para calcular el trabajo.`));
 totalBox?.before(help);
}

function setFormulaPrefix(totalBox,{price,quantity,unit}){
 if(!totalBox)return;
 const totalNode=totalBox.querySelector('[data-qw-active-total]');
 if(!totalNode)return;
 const prefix=`${money(price)} × ${quantity} ${unit} = `;
 if(totalBox.firstChild?.nodeType===Node.TEXT_NODE)totalBox.firstChild.nodeValue=prefix;
 else totalBox.insertBefore(document.createTextNode(prefix),totalNode);
}

export function createQuotePricingSyncController({wizard}){
 function syncVisibleWork(){
  const detail=document.querySelector('.quote-wizard-host .quote-builder-detail');
  if(!detail)return;
  const quantityInput=detail.querySelector('[data-qw-work-input][data-qw-key="quantity"]');
  const workId=String(quantityInput?.dataset?.qwWorkId||'');
  if(!workId)return;
  const work=(wizard.getDraft()?.works||[]).find(item=>String(item?.id||'')===workId);
  if(!work)return;
  const totalBox=detail.querySelector('.quote-work-total');
  const totalNode=totalBox?.querySelector('[data-qw-active-total]');
  if(totalNode)totalNode.textContent=money(commercialReferenceTotal(work));
  const unit=String(work.tariffUnit||work.unit||'').trim();
  if(!requiresMeasuredQuantity(unit))return;
  const quantity=amount(work.quantity);
  const price=amount(work.tariffPrice)>0?amount(work.tariffPrice):amount(work.unitPrice);
  setFormulaPrefix(totalBox,{price,quantity,unit});
  ensureMeasuredHelp(totalBox,quantity,unit);
 }
 function schedule(event){
  if(!document.querySelector('.quote-wizard-host'))return;
  const field=event?.target?.closest?.('[data-qw-work-input]');
  if(!field)return;
  queueMicrotask(syncVisibleWork);
 }
 document.addEventListener('input',schedule);
 document.addEventListener('change',schedule);
 return {
  afterRender(page){if(page==='cotizador')queueMicrotask(syncVisibleWork);},
  destroy(){document.removeEventListener('input',schedule);document.removeEventListener('change',schedule);}
 };
}
