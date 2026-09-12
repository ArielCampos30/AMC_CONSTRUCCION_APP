import {createFeatures as createLegacyFeatures} from './features-ui-legacy.js';
import {createQuoteWizard} from './quote-wizard.js';
import {createQuoteSaveController} from './quote-save-controller.js';
import {createQuoteClientCreateController} from './quote-client-create-controller.js';
import {createQuotePricingSyncController} from './quote-pricing-sync-controller.js';
import {createQuotePdfBackground} from './quote-pdf-background.js';

export function createFeatures(deps){
 const legacy=createLegacyFeatures(deps);
 const pdf=createQuotePdfBackground({getState:deps.getState,toast:deps.toast});
 const wizard=createQuoteWizard({getState:deps.getState,isAdmin:deps.isAdmin,esc:deps.esc,navigate:deps.navigate,toast:deps.toast,api:deps.api,refresh:deps.refresh});
 const saver=createQuoteSaveController({getState:deps.getState,api:deps.api,navigate:deps.navigate,toast:deps.toast,wizard,generatePdf:pdf.generatePdf});
 const pricingSync=createQuotePricingSyncController({wizard});
 createQuoteClientCreateController({getState:deps.getState,api:deps.api,refresh:deps.refresh,navigate:deps.navigate,toast:deps.toast,wizard});
 return {
  ...legacy,
  generatePdf:pdf.generatePdf,
  prefillClient(id,lead=false){wizard.prefillClient(id,lead);legacy.prefillClient?.(id,lead);},
  openEditor(requestId='',quoteId='',mode=''){wizard.open(requestId,quoteId,mode);deps.navigate('cotizador');},
  render(name){return name==='cotizador'?wizard.render():legacy.render(name);},
  afterRender(page){legacy.afterRender(page);wizard.afterRender(page);saver.afterRender(page);pricingSync.afterRender(page);}
 };
}