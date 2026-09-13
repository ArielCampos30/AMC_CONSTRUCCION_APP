import {createChatFeatures} from './chat-features.js';
import {createProjectActionsFeatures} from './project-actions-features.js';
import {createQuoteViewTracker} from './quote-view-tracker.js';
import {createQuoteWizard} from './quote-wizard.js';
import {createQuoteSaveController} from './quote-save-controller.js';
import {createQuoteClientCreateController} from './quote-client-create-controller.js';
import {createQuotePricingSyncController} from './quote-pricing-sync-controller.js';
import {createQuotePdfController} from './quote-pdf-controller.js';
import {createTariffUI} from './tariff-ui.js';

export function createFeatures(deps){
 const chat=createChatFeatures(deps);
 const projects=createProjectActionsFeatures(deps);
 const quoteViews=createQuoteViewTracker({getState:deps.getState,isAdmin:deps.isAdmin,api:deps.api,onNoticesRead:deps.onNoticesRead});
 const wizard=createQuoteWizard({getState:deps.getState,isAdmin:deps.isAdmin,esc:deps.esc,navigate:deps.navigate,toast:deps.toast,api:deps.api});
 const pdf=createQuotePdfController({getState:deps.getState,toast:deps.toast});
 const tariff=createTariffUI({isAdmin:deps.isAdmin,heading:deps.heading,esc:deps.esc,money:deps.money,api:deps.api,toast:deps.toast});
 const saver=createQuoteSaveController({getState:deps.getState,api:deps.api,navigate:deps.navigate,toast:deps.toast,wizard,generatePdf:pdf.generatePdf});
 const pricingSync=createQuotePricingSyncController({wizard});
 createQuoteClientCreateController({getState:deps.getState,api:deps.api,navigate:deps.navigate,toast:deps.toast,wizard});
 return {
  prepareAppointment:projects.prepareAppointment,
  selectChat:chat.selectChat,
  syncChatAccess:chat.syncChatAccess,
  updateChat:chat.updateChat,
  openChat:chat.openChat,
  generatePdf:pdf.generatePdf,
  prefillClient(id,lead=false){wizard.prefillClient(id,lead);},
  openEditor(requestId='',quoteId='',mode=''){wizard.open(requestId,quoteId,mode);deps.navigate('cotizador');},
  render(name){if(name==='cotizador')return wizard.render();const chatView=chat.render(name);return chatView===undefined?projects.render(name):chatView;},
  async submit(form,data,submitter){const chatResult=await chat.submit(form,data,submitter);return chatResult||projects.submit(form,data,submitter);},
  change(target){return chat.change(target);},
  afterRender(page){chat.afterRender(page);quoteViews.afterRender(page);wizard.afterRender(page);saver.afterRender(page);pricingSync.afterRender(page);tariff.afterRender(page);}
 };
}
