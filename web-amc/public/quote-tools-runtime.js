import {createQuoteWizard} from './quote-wizard.js';
import {createQuoteSaveController} from './quote-save-controller.js';
import {createQuoteClientCreateController} from './quote-client-create-controller.js';
import {createQuotePricingSyncController} from './quote-pricing-sync-controller.js';
import {createTariffUI} from './tariff-ui.js';

export function createQuoteToolsRuntime(deps){
 const wizard=createQuoteWizard({getState:deps.getState,isAdmin:deps.isAdmin,esc:deps.esc,navigate:deps.navigate,toast:deps.toast,api:deps.api});
 const tariff=createTariffUI({isAdmin:deps.isAdmin,heading:deps.heading,esc:deps.esc,money:deps.money,api:deps.api,toast:deps.toast});
 const saver=createQuoteSaveController({getState:deps.getState,api:deps.api,navigate:deps.navigate,toast:deps.toast,wizard,generatePdf:deps.generatePdf});
 const pricingSync=createQuotePricingSyncController({wizard});
 const clientCreate=createQuoteClientCreateController({getState:deps.getState,api:deps.api,navigate:deps.navigate,toast:deps.toast,wizard});
 return {
  prefillClient(id,lead=false){wizard.prefillClient(id,lead);},
  openEditor(requestId='',quoteId='',mode=''){wizard.open(requestId,quoteId,mode);deps.navigate('cotizador');},
  render(name){if(name==='cotizador')return wizard.render();},
  afterRender(page){wizard.afterRender(page);saver.afterRender(page);pricingSync.afterRender(page);tariff.afterRender(page);},
  destroy(){pricingSync.destroy?.();clientCreate.destroy?.();}
 };
}
