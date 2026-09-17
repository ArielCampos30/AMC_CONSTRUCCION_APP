import {createChatFeatures} from './chat-features.js';
import {createProjectActionsFeatures} from './project-actions-features.js';
import {createQuoteViewTracker} from './quote-view-tracker.js';
import {createOperationalUX} from './operational-ux.js';
import {prepareQuoteToolsPage,getLoadedQuoteToolsModule,isQuoteToolsPage} from './quote-tools-loader.js';

export function createFeatures(deps){
 const chat=createChatFeatures(deps);
 const projects=createProjectActionsFeatures(deps);
 const operational=createOperationalUX(deps);
 const quoteViews=createQuoteViewTracker({getState:deps.getState,isAdmin:deps.isAdmin,api:deps.api,onNoticesRead:deps.onNoticesRead});
 let quoteTools=null,quoteToolsPending=null,pendingClient=null,rerenderPending=false;
 let pdfController=null,pdfControllerPromise=null;
 const createRuntime=module=>{
  if(!module)return null;
  if(!quoteTools){
   quoteTools=module.createQuoteToolsRuntime({...deps,generatePdf});
   if(pendingClient){quoteTools.prefillClient(pendingClient.id,pendingClient.lead);pendingClient=null;}
  }
  return quoteTools;
 };
 const loadedRuntime=()=>quoteTools||createRuntime(getLoadedQuoteToolsModule());
 async function ensureQuoteTools(page='cotizador'){
  if(quoteTools)return quoteTools;
  if(quoteToolsPending)return quoteToolsPending;
  quoteToolsPending=prepareQuoteToolsPage(page).then(createRuntime).finally(()=>quoteToolsPending=null);
  return quoteToolsPending;
 }
 async function ensurePdfController(){
  if(pdfController)return pdfController;
  if(pdfControllerPromise)return pdfControllerPromise;
  pdfControllerPromise=import('./quote-pdf-controller.js').then(module=>pdfController=module.createQuotePdfController({getState:deps.getState,toast:deps.toast})).catch(error=>{pdfControllerPromise=null;throw error;});
  return pdfControllerPromise;
 }
 function generatePdf(requestId='',quoteId=''){
  return ensurePdfController().then(controller=>controller.generatePdf(requestId,quoteId));
 }
 function requestQuoteRerender(page){
  if(rerenderPending)return;rerenderPending=true;
  ensureQuoteTools(page).then(()=>{rerenderPending=false;globalThis.dispatchEvent?.(new Event('hashchange'));}).catch(error=>{rerenderPending=false;deps.toast?.(error?.message||'No se pudieron cargar las herramientas de presupuesto.');});
 }
 return {
  preparePage(page){return isQuoteToolsPage(page)?ensureQuoteTools(page):Promise.resolve(null);},
  prepareAppointment:projects.prepareAppointment,
  selectChat:chat.selectChat,
  syncChatAccess:chat.syncChatAccess,
  updateChat:chat.updateChat,
  openChat:chat.openChat,
  generatePdf,
  prefillClient(id,lead=false){const runtime=loadedRuntime();if(runtime)runtime.prefillClient(id,lead);else pendingClient={id,lead};},
  openEditor(requestId='',quoteId='',mode=''){
   return ensureQuoteTools('cotizador').then(runtime=>runtime.openEditor(requestId,quoteId,mode)).catch(error=>deps.toast?.(error?.message||'No se pudo abrir el Cotizador.'));
  },
  render(name){
   if(name==='cotizador'){
    const runtime=loadedRuntime();if(runtime)return runtime.render(name);
    requestQuoteRerender(name);return deps.empty?.('Cargando Cotizador','Preparando las herramientas de presupuesto…')||'';
   }
   const chatView=chat.render(name);return chatView===undefined?projects.render(name):chatView;
  },
  async submit(form,data,submitter){const chatResult=await chat.submit(form,data,submitter);if(chatResult)return chatResult;const operationalResult=await operational.submit(form,data,submitter);return operationalResult||projects.submit(form,data,submitter);},
  change(target){return chat.change(target);},
  afterRender(page){
   chat.afterRender(page);quoteViews.afterRender(page);operational.afterRender(page);
   const runtime=loadedRuntime();if(runtime)runtime.afterRender(page);else if(isQuoteToolsPage(page))requestQuoteRerender(page);
  }
 };
}
