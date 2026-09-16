import {prepareQuoteToolsPage} from './quote-tools-loader.js';

const head=document.head,nativeAppend=head.append,hadOwnAppend=Object.prototype.hasOwnProperty.call(head,'append');
const nativeWindowAdd=window.addEventListener,hadOwnWindowAdd=Object.prototype.hasOwnProperty.call(window,'addEventListener');
head.append=function(...nodes){
 const allowed=nodes.filter(node=>!(node?.tagName==='LINK'&&node.getAttribute?.('href')==='/admin-v3.css'&&!node.dataset?.amcRoleStyle));
 if(allowed.length)return nativeAppend.apply(this,allowed);
};
window.addEventListener=function(type,listener,options){
 if(type==='hashchange'&&typeof listener==='function'&&Function.prototype.toString.call(listener).includes('pageFromHash(location.hash,recoveryRoute())')){
  const wrapped=async function(event){
   try{await prepareQuoteToolsPage(location.hash);}catch(error){console.warn('[AMC quote tools] route',String(error?.message||error||'Error'));}
   return listener.call(this,event);
  };
  return nativeWindowAdd.call(this,type,wrapped,options);
 }
 return nativeWindowAdd.call(this,type,listener,options);
};
try{
 try{await prepareQuoteToolsPage(location.hash);}catch(error){console.warn('[AMC quote tools] bootstrap',String(error?.message||error||'Error'));}
 await import('./app.js');
}finally{
 if(hadOwnAppend)head.append=nativeAppend;else delete head.append;
 if(hadOwnWindowAdd)window.addEventListener=nativeWindowAdd;else delete window.addEventListener;
}
