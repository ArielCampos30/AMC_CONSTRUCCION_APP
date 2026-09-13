const INSTANT_REQUESTS=new Set(['/api/notices/read','/api/staff-chat/read']);
const ownsFeedback=url=>url==='/api/client-chat/messages'||url==='/api/staff-chat/messages'||/^\/api\/requests\/[^/]+\/messages$/.test(url);

export function createAppHttpRuntime({getCsrf=()=>'',fetchImpl=(...args)=>globalThis.fetch(...args),getBusy=()=>globalThis.AMCBusy}={}){
 const activeRequests=new Map();
 function api(url,body,method='POST'){
  const key=method+' '+url+' '+JSON.stringify(body||{});
  if(activeRequests.has(key))return activeRequests.get(key);
  const visible=method!=='GET'&&!INSTANT_REQUESTS.has(url)&&!ownsFeedback(url);
  const task=(async()=>{
   if(visible)getBusy()?.start();
   try{
    const response=await fetchImpl(url,{method,credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':getCsrf()||''},...(method!=='GET'?{body:JSON.stringify(body||{})}:{})});
    const result=await response.json();
    if(!response.ok){const error=Error(result.error||'No se pudo completar la operación.');Object.assign(error,result);throw error;}
    return result;
   }finally{
    if(visible)getBusy()?.stop();
    activeRequests.delete(key);
   }
  })();
  activeRequests.set(key,task);
  return task;
 }
 return {api};
}
