const VERSIONED_PREFIX='/_amc/';

export function assetBase(moduleUrl=import.meta.url){
 try{
  const pathname=new URL(moduleUrl,globalThis.location?.origin||'http://localhost').pathname;
  const match=pathname.match(/^\/_amc\/([A-Za-z0-9_-]+)\//);
  return match?VERSIONED_PREFIX+match[1]:'';
 }catch{return '';}
}

export function canonicalAssetPath(value=''){
 try{
  const pathname=new URL(String(value||''),globalThis.location?.origin||'http://localhost').pathname;
  return pathname.replace(/^\/_amc\/[A-Za-z0-9_-]+(?=\/)/,'');
 }catch{return String(value||'');}
}

export function assetUrl(value,moduleUrl=import.meta.url){
 const raw=String(value||'');
 if(!raw||/^(?:[a-z]+:|\/\/)/i.test(raw))return raw;
 const base=assetBase(moduleUrl);
 if(!base)return raw.startsWith('/')?raw:'/'+raw.replace(/^\.\//,'');
 return base+'/'+raw.replace(/^\.?\//,'');
}
