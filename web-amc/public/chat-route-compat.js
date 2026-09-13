(()=>{
 const PENDING_KEY='amc-pending-floating-chat';
 const CLIENT_GROUP='Clientes';
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
 async function waitFor(selector,root=document,tries=30){
  for(let i=0;i<tries;i++){
   const node=root.querySelector(selector);
   if(node)return node;
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
   const trigger=await waitFor('.floating-chat-button');
   if(!trigger)return;
   if(!document.getElementById('amc-chat-dialog')?.open)trigger.click();
   const dialog=await waitFor('#amc-chat-dialog[open]');
   if(!dialog)return;
   if(target.kind==='client-list'){clearPending();return;}

   let contact=dialog.querySelector('.chat-contact[data-contact="'+CSS.escape(target.id)+'"]');
   if(!contact){
    const groups=[...dialog.querySelectorAll('.chat-group')];
    const clients=groups.find(node=>node.querySelector('strong')?.textContent?.trim()===CLIENT_GROUP)||groups[0];
    if(clients){clients.click();await delay(60);}
    contact=dialog.querySelector('.chat-contact[data-contact="'+CSS.escape(target.id)+'"]');
   }
   if(!contact){clearPending();return;}
   contact.click();
   clearPending();
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