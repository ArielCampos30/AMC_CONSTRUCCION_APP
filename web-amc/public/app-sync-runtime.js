const POLL_TICK_MS=5000,CHAT_POLL_MS=5000,BACKGROUND_POLL_MS=15000;
const isChatPage=page=>['mensajes','chat-admin','chat-cliente','chat-equipo'].includes(page)||page.startsWith('chat/')||page.startsWith('chat-admin/')||page.startsWith('chat-equipo/');
const defaultSyncIssue=(error,meta)=>globalThis.console?.warn?.('[AMC sync]',meta?.phase||'sync',String(error?.message||error||'Error'),meta||{});
const defaultSyncRecovered=meta=>globalThis.console?.info?.('[AMC sync] conexión recuperada',meta||{});

export function createAppSyncRuntime({reload,getState,getPage,isDirty,isLoggingOut,isHidden,hasEstimator,stateSignature,syncChatAccess,render,pollState,windowTarget=globalThis.window,documentTarget=globalThis.document,schedule=(handler,delay)=>globalThis.setInterval(handler,delay),now=()=>Date.now(),onSyncIssue=defaultSyncIssue,onSyncRecovered=defaultSyncRecovered,issueThreshold=3}){
 let refreshing=false,polling=false,lastBackgroundPoll=0,consecutiveFailures=0,issueOpen=false,lastFailurePhase='';
 const recordFailure=(phase,error)=>{
  if(error?.name==='AbortError')return;
  consecutiveFailures++;lastFailurePhase=phase;
  if(consecutiveFailures>=issueThreshold&&!issueOpen){issueOpen=true;onSyncIssue?.(error,{phase,consecutiveFailures});}
 };
 const recordSuccess=phase=>{
  if(issueOpen)onSyncRecovered?.({phase,previousFailurePhase:lastFailurePhase,consecutiveFailures});
  consecutiveFailures=0;issueOpen=false;lastFailurePhase='';
 };
 async function refreshVisible(){
  if(refreshing||!getState().user||isLoggingOut()||isHidden())return;
  refreshing=true;
  const before=stateSignature(getState());
  try{
   await reload();
   syncChatAccess();
   const preservingEstimator=getPage()==='cotizador'||hasEstimator(),changed=!before||before!==stateSignature(getState());
   if(!isDirty()&&!preservingEstimator&&(getState().user?.role!=='client'||changed))render();
   recordSuccess('refresh');
  }catch(error){recordFailure('refresh',error);}finally{refreshing=false;}
 }
 async function poll(){
  const current=getState();
  if(!current.user||isLoggingOut()||isHidden()||polling)return;
  const page=getPage(),minimum=isChatPage(page)?CHAT_POLL_MS:BACKGROUND_POLL_MS,stamp=now();
  if(stamp-lastBackgroundPoll<minimum)return;
  lastBackgroundPoll=stamp;polling=true;
  try{await pollState();recordSuccess('poll');}catch(error){recordFailure('poll',error);}finally{polling=false;}
 }
 function attachVisibleRefresh(){
  documentTarget.addEventListener('visibilitychange',()=>{if(!isHidden())refreshVisible();});
  windowTarget.addEventListener('focus',refreshVisible);
 }
 return {refreshVisible,attachVisibleRefresh,startPolling:()=>schedule(poll,POLL_TICK_MS),diagnostics:()=>({consecutiveFailures,issueOpen,lastFailurePhase})};
}
