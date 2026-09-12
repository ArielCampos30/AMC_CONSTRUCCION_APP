import {createAndAttach} from './quote-pdf-generation.js';
import {buildQuotePdfDocument,makeQuotePdf,blobToBase64} from './quote-pdf-document.js';

export function createQuotePdfController({getState,toast}){
 const jobs=new Map();
 const state=()=>getState();
 const upsertQuote=quote=>{
  if(!quote?.id)return;
  const current=state(),rows=Array.isArray(current.quotes)?current.quotes:(current.quotes=[]),index=rows.findIndex(item=>item.id===quote.id);
  if(index>=0)rows[index]={...rows[index],...quote};else rows.unshift(quote);
 };
 const requestFor=(quote,requestId='')=>(state().requests||[]).find(request=>request.id===(requestId||quote?.requestId||quote?.solicitudId))||{};
 const clientFor=(quote,request)=>{
  const id=request?.leadId||request?.userId||quote?.userId,rows=[...(state().agendaClients||[]),...(state().clients||[])];
  return rows.find(client=>client.id===id)||{};
 };
 const backgroundRequest=async(url,body)=>{
  const response=await fetch(url,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':state().csrf||''},body:JSON.stringify(body||{})});
  let result={};try{result=await response.json();}catch{}
  if(!response.ok)throw Error(result.error||'No se pudo completar la generación del PDF.');
  return result;
 };
 function matchingButtons(quoteId){return [...document.querySelectorAll('[data-action="generate-pdf-admin"]')].filter(button=>button.dataset.quote===quoteId);}
 function paintPending(quoteId){
  for(const button of matchingButtons(quoteId)){button.disabled=true;button.dataset.pdfGenerating='1';button.textContent='Preparando PDF…';button.setAttribute('aria-busy','true');}
 }
 function paintRetry(quoteId){
  for(const button of matchingButtons(quoteId)){button.disabled=false;delete button.dataset.pdfGenerating;button.textContent='Generar PDF';button.removeAttribute('aria-busy');}
 }
 function paintReady(quoteId){
  for(const button of matchingButtons(quoteId)){
   const download=document.createElement('button'),share=document.createElement('button');
   download.type='button';download.dataset.action='download-pdf-admin';download.dataset.id=quoteId;download.textContent='Descargar PDF';
   share.type='button';share.dataset.action='share-pdf-admin';share.dataset.id=quoteId;share.textContent='Compartir PDF';
   button.replaceWith(download,share);
  }
 }
 async function run(requestId,quoteId){
  const current=state(),quote=(current.quotes||[]).find(item=>item.id===quoteId);
  if(!quote)throw Error('AMC no encontró el presupuesto guardado para preparar el PDF.');
  if(quote.pdf){paintReady(quoteId);return quote;}
  const request=requestFor(quote,requestId),client=clientFor(quote,request),document=buildQuotePdfDocument({quote,request,client,settings:current.settings||{}});
  if(!document.items.length)throw Error('El presupuesto quedó sin trabajos para generar el PDF.');
  if(!(document.total>0))throw Error('El presupuesto quedó sin importe válido para generar el PDF.');
  const updated=await createAndAttach({quoteId,document,makePdf:makeQuotePdf,blobToBase64,request:backgroundRequest});
  upsertQuote(updated);paintReady(quoteId);
  toast?.(request?.leadId?'PDF listo para descargar o compartir.':'PDF listo. El cliente ya fue avisado y puede descargarlo desde AMC.');
  return updated;
 }
 function generatePdf(requestId='',quoteId=''){
  if(!quoteId)return Promise.resolve(null);
  const quote=(state().quotes||[]).find(item=>item.id===quoteId);
  if(quote?.pdf){paintReady(quoteId);return Promise.resolve(quote);}
  if(jobs.has(quoteId))return jobs.get(quoteId);
  paintPending(quoteId);
  const task=run(requestId,quoteId).catch(error=>{
   paintRetry(quoteId);
   toast?.('El presupuesto quedó guardado. No se pudo generar el PDF automáticamente. Podés usar “Generar PDF” para reintentar.');
   throw error;
  }).finally(()=>jobs.delete(quoteId));
  jobs.set(quoteId,task);return task;
 }
 return {generatePdf,isPending:quoteId=>jobs.has(quoteId)};
}
