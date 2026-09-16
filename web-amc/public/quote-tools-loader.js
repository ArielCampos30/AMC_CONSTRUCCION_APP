import {assetUrl,canonicalAssetPath} from './asset-url.js';

const QUOTE_PAGE='cotizador',TARIFF_PAGE='tarifario';
export const QUOTE_TOOL_STYLES=Object.freeze(['/quote-wizard.css','/quote-builder-review.css','/quote-wizard-autocomplete.css']);

const pageName=value=>String(value||'').replace(/^.*#/,'').split('?')[0].split('/')[0];
export const isQuoteToolsPage=value=>[QUOTE_PAGE,TARIFF_PAGE].includes(pageName(value));
export const isQuoteWizardPage=value=>pageName(value)===QUOTE_PAGE;

export function createQuoteToolsLoader({documentRef=globalThis.document,locationRef=globalThis.location,importModule=specifier=>import(specifier),logger=globalThis.console}={}){
 let runtimeModule=null,runtimePromise=null,autocompletePromise=null;
 const stylePromises=new Map();
 const hrefPath=link=>canonicalAssetPath(link?.href||link?.getAttribute?.('href')||'');
 const existingStyle=href=>[...(documentRef?.querySelectorAll?.('link[rel="stylesheet"]')||[])].find(link=>hrefPath(link)===href);
 const ensureStyle=href=>{
  const existing=existingStyle(href);if(existing)return Promise.resolve(existing);
  if(stylePromises.has(href))return stylePromises.get(href);
  const promise=new Promise((resolve,reject)=>{
   if(!documentRef?.head||!documentRef?.createElement){resolve(null);return;}
   const link=documentRef.createElement('link');link.rel='stylesheet';link.href=assetUrl(href);link.dataset.amcQuoteStyle='1';
   link.onload=()=>resolve(link);link.onerror=()=>reject(Error('No se pudo cargar '+href));documentRef.head.append(link);
  }).catch(error=>{stylePromises.delete(href);throw error;});
  stylePromises.set(href,promise);return promise;
 };
 const loadRuntime=()=>{
  if(runtimeModule)return Promise.resolve(runtimeModule);
  if(runtimePromise)return runtimePromise;
  runtimePromise=Promise.resolve().then(()=>importModule('./quote-tools-runtime.js')).then(module=>runtimeModule=module).catch(error=>{runtimePromise=null;logger?.warn?.('[AMC quote tools] runtime',String(error?.message||error||'Error'));throw error;});
  return runtimePromise;
 };
 const loadAutocomplete=()=>{
  if(autocompletePromise)return autocompletePromise;
  autocompletePromise=Promise.resolve().then(()=>importModule('./quote-wizard-autocomplete.js')).catch(error=>{autocompletePromise=null;logger?.warn?.('[AMC quote tools] autocomplete',String(error?.message||error||'Error'));throw error;});
  return autocompletePromise;
 };
 async function preparePage(value){
  const page=pageName(value);if(!isQuoteToolsPage(page))return null;
  const tasks=[loadRuntime()];
  if(page===QUOTE_PAGE)tasks.push(...QUOTE_TOOL_STYLES.map(ensureStyle),loadAutocomplete());
  const [module]=await Promise.all(tasks);return module;
 }
 return {preparePage,getLoadedModule:()=>runtimeModule,diagnostics:()=>({runtimeLoaded:!!runtimeModule,runtimePending:!!runtimePromise,autocompletePending:!!autocompletePromise,styles:[...stylePromises.keys()]})};
}

const defaultLoader=createQuoteToolsLoader();
export const prepareQuoteToolsPage=value=>defaultLoader.preparePage(value);
export const getLoadedQuoteToolsModule=()=>defaultLoader.getLoadedModule();
export const quoteToolsDiagnostics=()=>defaultLoader.diagnostics();
