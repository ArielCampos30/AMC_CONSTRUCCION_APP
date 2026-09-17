import {assetUrl,canonicalAssetPath} from './asset-url.js';

export const ROLE_ASSETS=Object.freeze({
 admin:Object.freeze({styles:Object.freeze(['/admin-v3.css','/admin-appearance.css']),modules:Object.freeze(['./app-admin-staff-chat-runtime.js'])}),
 employee:Object.freeze({styles:Object.freeze(['/employee-v4.css','/employee-staff-chat.css','/operational-ux.css']),modules:Object.freeze(['./app-admin-staff-chat-runtime.js','./app-employee-staff-chat-runtime.js'])}),
 client:Object.freeze({styles:Object.freeze(['/client-v5.css','/operational-ux.css']),modules:Object.freeze([])}),
 public:Object.freeze({styles:Object.freeze([]),modules:Object.freeze([])}),
});

const KNOWN_ROLE_STYLES=new Set(Object.values(ROLE_ASSETS).flatMap(config=>config.styles));
const moduleLoads=new Map(),styleLoads=new Map();

function normalizedRole(role){return Object.prototype.hasOwnProperty.call(ROLE_ASSETS,role)?role:'public';}
function stylesheetPath(link){return canonicalAssetPath(link.href||link.getAttribute?.('href')||'');}
function stylesheetLinks(documentRef){return [...(documentRef?.querySelectorAll?.('link[rel="stylesheet"]')||[])];}
function existingStylesheet(documentRef,href){return stylesheetLinks(documentRef).find(link=>stylesheetPath(link)===href);}
function pruneRoleStyles(documentRef,keep){
 for(const link of stylesheetLinks(documentRef)){
  const href=stylesheetPath(link);
  if(KNOWN_ROLE_STYLES.has(href)&&!keep.has(href)){link.remove?.();styleLoads.delete(href);}
 }
}
function ensureStylesheet(documentRef,href){
 const existing=existingStylesheet(documentRef,href);
 if(existing){existing.dataset.amcRoleStyle='1';return Promise.resolve(existing);}
 if(styleLoads.has(href))return styleLoads.get(href);
 const promise=new Promise((resolve,reject)=>{
  const link=documentRef.createElement('link');
  link.rel='stylesheet';link.href=assetUrl(href);link.dataset.amcRoleStyle='1';
  link.onload=()=>resolve(link);link.onerror=()=>reject(Error('No se pudo cargar '+href));
  documentRef.head.append(link);
 }).catch(error=>{styleLoads.delete(href);throw error;});
 styleLoads.set(href,promise);
 return promise;
}
function loadModule(specifier,importModule){
 if(moduleLoads.has(specifier))return moduleLoads.get(specifier);
 const promise=Promise.resolve().then(()=>importModule(specifier)).catch(error=>{moduleLoads.delete(specifier);throw error;});
 moduleLoads.set(specifier,promise);return promise;
}
function warnFailures(results,logger,label){
 for(const result of results)if(result.status==='rejected')logger?.warn?.('[AMC role assets] '+label,String(result.reason?.message||result.reason||'Error'));
}

export async function syncRoleAssets(role,{documentRef=globalThis.document,importModule=specifier=>import(specifier),logger=globalThis.console}={}){
 const key=normalizedRole(role),config=ROLE_ASSETS[key];
 if(!documentRef?.head)return {role:key,styles:[],modules:[]};
 const keep=new Set(config.styles);
 const styleResults=await Promise.allSettled(config.styles.map(href=>ensureStylesheet(documentRef,href)));
 pruneRoleStyles(documentRef,keep);
 warnFailures(styleResults,logger,'stylesheet');
 const moduleResults=await Promise.allSettled(config.modules.map(specifier=>loadModule(specifier,importModule)));
 warnFailures(moduleResults,logger,'module');
 return {role:key,styles:config.styles,modules:config.modules};
}

export function pruneRoleAssetsForBody(documentRef=globalThis.document){
 if(!documentRef?.body)return;
 const role=documentRef.body.classList.contains('admin-v3')?'admin':documentRef.body.classList.contains('employee-v4')?'employee':documentRef.body.classList.contains('client-v5')?'client':'public';
 pruneRoleStyles(documentRef,new Set(ROLE_ASSETS[role].styles));
}

if(typeof document!=='undefined'&&document.body&&typeof MutationObserver!=='undefined'){
 new MutationObserver(()=>pruneRoleAssetsForBody(document)).observe(document.body,{attributes:true,attributeFilter:['class']});
}
