(()=>{
 const PENDING_KEY='amc-pending-floating-chat';
 let opening=false;

 function parse(hash=location.hash){
  const raw=String(hash||'').replace(/^#/,'');
  let match=raw.match(/^(?:chat|chat-admin|conversacion)\/([A-Za-z0-9_-]+)$/);
  if(match)return {kind:'client',id:decodeURIComponent(match[1]),fallback:'inicio'};
  if(raw==='chat-cliente'||raw==='chat-admin')return {kind:'client-list',id:'',fallback:'inicio'};
  return null;
 }

 function remember(target){
  if(!target)return;
  try{sessionStorage.setItem(PENDING_KEY,JSON.stringify(target));}catch{}
 }
 function pending(){
  try{return JSON.parse(sessionStorage.getItem(PENDING_KEY)||'null');}catch{return null;}
 }
 function clearPending(){try{sessionStorage.removeItem(PENDING_KEY);}catch{}}

 function normalizeInitial(){
  const target=parse();
  if(!target)return;
  remember(target);
  history.replaceState(null,'','#'+target.fallback);
 }

 function stripLegacyChatNavigation(){
  document.querySelectorAll('[data-nav="chat-cliente"],.bottom-nav a[href="#chat-cliente"]').forEach(node=>node.remove());
  document.querySelectorAll('a[href="#chat-cliente"],a[href="#chat-admin"]').forEach(link=>{
   if(link.closest('.sidebar,.bottom-nav')){link.remove();return;}
   link.dataset.openFloatingChat='1';
   link.setAttribute('href','#inicio');
  });
 }

 const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 async function waitForChatApi(tries=30){
  for(let i=0;i<tries;i++){
   if(typeof window.AMCOpenChatRequest==='function')return window.AMCOpenChatRequest;
   await delay(80);
  }
  return null;
 }

 async function openPending(){
  if(opening)return;
  const target=pending();
  if(!target)return;
  opening=true;
  try{
   stripLegacyChatNavigation();
   if(target.kind==='client-list'){
    const trigger=document.querySelector('.floating-chat-button');
    if(trigger&&!document.getElementById('amc-chat-dialog')?.open)trigger.click();
    clearPending();
    return;
   }
   const openRequest=await waitForChatApi();
   if(!openRequest)return;
   const opened=openRequest(target.id);
   if(opened!==false)clearPending();
  }finally{opening=false;}
 }

 function redirectLegacyHash(event){
  const target=parse();
  if(!target)return;
  event?.stopImmediatePropagation?.();
  remember(target);
  history.replaceState(null,'','#'+target.fallback);
  queueMicrotask(()=>window.dispatchEvent(new HashChangeEvent('hashchange')));
  setTimeout(openPending,80);
 }

 normalizeInitial();
 window.addEventListener('hashchange',redirectLegacyHash,true);
 document.addEventListener('click',event=>{
  const link=event.target.closest?.('[data-open-floating-chat]');
  if(!link)return;
  event.preventDefault();
  remember({kind:'client-list',id:'',fallback:'inicio'});
  if(location.hash!=='#inicio')location.hash='inicio';else openPending();
 },true);

 const observer=new MutationObserver(()=>queueMicrotask(()=>{stripLegacyChatNavigation();openPending();}));
 const attach=()=>{const app=document.getElementById('app');if(app)observer.observe(app,{childList:true,subtree:true});stripLegacyChatNavigation();openPending();};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attach,{once:true});else attach();
})();