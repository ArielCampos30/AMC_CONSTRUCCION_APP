import {createFeatures as createLegacyFeatures} from './features-ui-legacy.js';
import {createQuoteWizard} from './quote-wizard.js';

export function createFeatures(deps){
 const legacy=createLegacyFeatures(deps);
 const wizard=createQuoteWizard({getState:deps.getState,isAdmin:deps.isAdmin,esc:deps.esc,navigate:deps.navigate,toast:deps.toast});
 return {
  ...legacy,
  prefillClient(id,lead=false){wizard.prefillClient(id,lead);legacy.prefillClient?.(id,lead);},
  openEditor(requestId='',quoteId='',mode=''){wizard.open(requestId,quoteId,mode);deps.navigate('cotizador');},
  render(name){return name==='cotizador'?wizard.render():legacy.render(name);},
  afterRender(page){legacy.afterRender(page);wizard.afterRender(page);}
 };
}
