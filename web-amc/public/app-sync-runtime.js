const POLL_TICK_MS=5000,CLIENT_BACKGROUND_POLL_MS=12000;

export function createAppSyncRuntime({reload,getState,getPage,isDirty,isLoggingOut,isHidden,hasEstimator,stateSignature,syncChatAccess,render,pollState,windowTarget=globalThis.window,documentTarget=globalThis.document,schedule=(handler,delay)=>globalThis.setInterval(handler,delay),now=()=>Date.now()}){
 let refreshing=false,polling=false,lastBackgroundPoll=0;
 async function refreshVisible(){
  if(refreshing||!getState().user||isLoggingOut()||isHidden())return;
  refreshing=true;
  const before=stateSignature(getState());
  try{
   await reload();
   syncChatAccess();
   const preservingEstimator=getPage()==='cotizador'||hasEstimator(),changed=!before||before!==stateSignature(getState());
   if(!isDirty()&&!preservingEstimator&&(getState().user?.role!=='client'||changed))render();
  }catch{}finally{refreshing=false;}
 }
 async function poll(){
  const current=getState();
  if(!current.user||isLoggingOut()||isHidden()||polling)return;
  const page=getPage(),chatPage=['mensajes','chat-admin','chat-cliente','chat-equipo'].includes(page)||page.startsWith('chat/'),minimum=current.user.role==='client'&&!chatPage?CLIENT_BACKGROUND_POLL_MS:POLL_TICK_MS,stamp=now();
  if(stamp-lastBackgroundPoll<minimum)return;
  lastBackgroundPoll=stamp;polling=true;
  try{await pollState();}catch{}finally{polling=false;}
 }
 function attachVisibleRefresh(){
  documentTarget.addEventListener('visibilitychange',()=>{if(!isHidden())refreshVisible();});
  windowTarget.addEventListener('focus',refreshVisible);
 }
 return {refreshVisible,attachVisibleRefresh,startPolling:()=>schedule(poll,POLL_TICK_MS)};
}
