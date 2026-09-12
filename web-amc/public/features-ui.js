import {createFeatures as createLegacyFeatures} from './features-ui-legacy.js';
import {createQuoteWizard} from './quote-wizard.js';
import {createQuoteSaveController} from './quote-save-controller.js';
import {createQuoteClientCreateController} from './quote-client-create-controller.js';

export function createFeatures(deps){
 const legacy=createLegacyFeatures(deps);
 const wizard=createQuoteWizard({getState:deps.getState,isAdmin:deps.isAdmin,esc:deps.esc,navigate:deps.navigate,toast:deps.toast,api:deps.api,refresh:deps.refresh});
 const saver=createQuoteSaveController({getState:deps.getState,api:deps.api,refresh:deps.refresh,navigate:deps.navigate,toast:deps.toast,wizard});
 createQuoteClientCreateController({getState:deps.getState,api:deps.api,refresh:deps.refresh,navigate:deps.navigate,toast:deps.toast,wizard});
 return {
  ...legacy,
  prefillClient(id,lead=false){wizard.prefillClient(id,lead);legacy.prefillClient?.(id,lead);},
  openEditor(requestId='',quoteId='',mode=''){wizard.open(requestId,quoteId,mode);deps.navigate('cotizador');},
  render(name){return name==='cotizador'?wizard.render():legacy.render(name);},
  afterRender(page){legacy.afterRender(page);wizard.afterRender(page);saver.afterRender(page);}
 };
}
