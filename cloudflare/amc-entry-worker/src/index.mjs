const DEFAULT_ORIGIN='https://amc-o0xb.onrender.com';
const WAKE_PATH='/_amc/wakeup-status';
const DEFAULT_PROBE_TIMEOUT_MS=900;
const DEFAULT_MAX_WAIT_MS=90000;

const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const asNumber=(value,fallback)=>Number.isFinite(Number(value))?Number(value):fallback;

function originFromEnv(env={}){
  const raw=String(env.ORIGIN_URL||DEFAULT_ORIGIN).trim();
  const url=new URL(raw);
  if(url.protocol!=='https:')throw new Error('AMC Worker requiere un origen HTTPS.');
  return url.origin;
}

function isInitialHtmlNavigation(request){
  if(request.method!=='GET')return false;
  const url=new URL(request.url);
  if(url.pathname!=='/')return false;
  const accept=request.headers.get('accept')||'';
  if(!accept.toLowerCase().includes('text/html'))return false;
  const mode=request.headers.get('sec-fetch-mode');
  const dest=request.headers.get('sec-fetch-dest');
  if(mode&&mode!=='navigate')return false;
  if(dest&&dest!=='document')return false;
  return true;
}

async function probeOrigin(fetchImpl,origin,timeoutMs){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort('probe-timeout'),timeoutMs);
  const started=Date.now();
  try{
    const response=await fetchImpl(new Request(origin+'/healthz',{
      method:'GET',
      headers:{accept:'application/json,text/plain;q=0.9,*/*;q=0.1','cache-control':'no-cache'},
      redirect:'manual',
      signal:controller.signal,
    }));
    return {ready:response.ok,status:response.status,elapsedMs:Date.now()-started};
  }catch(error){
    return {ready:false,status:0,elapsedMs:Date.now()-started,error:error?.name||'fetch_error'};
  }finally{
    clearTimeout(timer);
  }
}

async function proxyToOrigin(request,fetchImpl,origin){
  const incoming=new URL(request.url);
  const target=new URL(incoming.pathname+incoming.search,origin);
  const outbound=new Request(target.toString(),request);
  return fetchImpl(outbound);
}

function jsonResponse(payload,status=200){
  return new Response(JSON.stringify(payload),{
    status,
    headers:{
      'content-type':'application/json; charset=utf-8',
      'cache-control':'no-store, max-age=0',
      'pragma':'no-cache',
      'x-content-type-options':'nosniff',
    },
  });
}

function loaderHtml(maxWaitMs){
  const safeMax=clamp(Math.round(maxWaitMs),30000,180000);
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#0b2422"><title>AMC Construcciones</title>
<style>
:root{color-scheme:dark;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}*{box-sizing:border-box}body{margin:0;min-height:100dvh;display:grid;place-items:center;overflow:hidden;background:radial-gradient(circle at 50% 35%,#164642 0,#0d2f2c 34%,#071a19 72%,#051312 100%);color:#f4fbfa}.glow{position:fixed;inset:auto 10% -20vh;width:80%;height:45vh;background:#2cae9d18;filter:blur(70px);border-radius:50%;pointer-events:none}.shell{width:min(92vw,560px);padding:36px 26px 30px;text-align:center}.brand{display:inline-flex;align-items:center;gap:11px;margin-bottom:22px;font-weight:800;letter-spacing:.03em}.mark{width:54px;height:54px;border-radius:14px;display:grid;place-items:center;overflow:hidden;background:#071a19;box-shadow:0 14px 35px #0005}.mark img{width:100%;height:100%;display:block;object-fit:cover}.scene{position:relative;width:min(78vw,360px);height:230px;margin:0 auto 12px}.scene svg{width:100%;height:100%;overflow:visible}.line{fill:none;stroke:#8ce9dc;stroke-width:3;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:700;stroke-dashoffset:700;filter:drop-shadow(0 0 8px #59dfc555);animation:draw 2.8s ease-in-out infinite alternate}.line.two{animation-delay:.3s;stroke:#5dcfc0}.line.three{animation-delay:.6s;stroke:#c2fff6}.block{fill:#5ed8c7;opacity:.15;animation:block 2.4s ease-in-out infinite}.block.b2{animation-delay:.35s}.block.b3{animation-delay:.7s}.floor{stroke:#ffffff2a;stroke-width:1.5;stroke-dasharray:7 9}.pulse{position:absolute;left:50%;bottom:23px;width:180px;height:16px;transform:translateX(-50%);border-radius:50%;background:#55d9c533;filter:blur(12px);animation:pulse 1.8s ease-in-out infinite}.title{margin:2px 0 9px;font-size:clamp(25px,6vw,36px);line-height:1.08;letter-spacing:-.035em}.status{min-height:48px;margin:0 auto;color:#b9d8d4;font-size:15px;line-height:1.55}.dots{display:flex;justify-content:center;gap:7px;margin:19px 0 0}.dots i{width:7px;height:7px;border-radius:50%;background:#88e6d9;animation:dot 1.25s infinite ease-in-out}.dots i:nth-child(2){animation-delay:.16s}.dots i:nth-child(3){animation-delay:.32s}.retry{display:none;margin:20px auto 0;padding:11px 18px;border-radius:12px;border:1px solid #75dccc66;background:#123d39;color:#f3fffd;font:inherit;font-weight:700;cursor:pointer}.slow .retry{display:inline-flex}.slow .dots{display:none}.ready .scene{animation:finish .45s ease forwards}.ready .status{color:#9ff1e5}.foot{margin-top:26px;color:#789b97;font-size:12px}@keyframes draw{0%{stroke-dashoffset:700;opacity:.3}55%,100%{stroke-dashoffset:0;opacity:1}}@keyframes block{0%,100%{opacity:.12;transform:translateY(2px)}50%{opacity:.48;transform:translateY(-3px)}}@keyframes pulse{0%,100%{opacity:.28;transform:translateX(-50%) scale(.8)}50%{opacity:.7;transform:translateX(-50%) scale(1.15)}}@keyframes dot{0%,70%,100%{transform:translateY(0);opacity:.35}35%{transform:translateY(-5px);opacity:1}}@keyframes finish{to{transform:scale(1.025);filter:brightness(1.14)}}@media(prefers-reduced-motion:reduce){*,*:before,*:after{animation:none!important;transition:none!important}.line{stroke-dashoffset:0}.block{opacity:.32}}
</style></head><body><div class="glow"></div><main class="shell" role="status" aria-live="polite"><div class="brand"><span class="mark" aria-hidden="true"><img src="/amc-logo-brand.webp" alt=""></span><span>AMC Construcciones</span></div><div class="scene" aria-hidden="true"><div class="pulse"></div><svg viewBox="0 0 360 230"><path class="floor" d="M34 199H326"/><path class="line" d="M75 192V104L180 45l105 59v88M106 192v-67h148v67M139 192v-43h37v43M203 192v-43h28v43"/><path class="line two" d="M58 111L180 34l122 77M119 118h122M95 192h170"/><path class="line three" d="M157 86h46v34h-46zM148 45v-16h64v16"/><rect class="block" x="98" y="164" width="30" height="12" rx="2"/><rect class="block b2" x="239" y="152" width="30" height="12" rx="2"/><rect class="block b3" x="243" y="169" width="30" height="12" rx="2"/></svg></div><h1 class="title">Preparando tu espacio AMC</h1><p class="status" id="status">Conectando tus presupuestos…</p><div class="dots" aria-hidden="true"><i></i><i></i><i></i></div><button class="retry" id="retry" type="button">Reintentar</button><div class="foot">Tu información sigue protegida. Estamos preparando la conexión.</div></main><script>
(()=>{const messages=['Conectando tus presupuestos…','Preparando mensajes y obras…','Organizando tu espacio de trabajo…','Ya casi estamos…'];const maxWait=${safeMax};const status=document.getElementById('status');const retry=document.getElementById('retry');let started=Date.now(),tickTimer,messageTimer,stopped=false,index=0;const setMessage=()=>{if(stopped)return;index=(index+1)%messages.length;status.textContent=messages[index]};const stop=()=>{clearTimeout(tickTimer);clearInterval(messageTimer)};const ready=()=>{stopped=true;stop();document.body.classList.add('ready');status.textContent='Todo listo';setTimeout(()=>location.reload(),520)};const slow=()=>{stopped=true;stop();document.body.classList.add('slow');status.textContent='Está tardando más de lo habitual.'};const check=async()=>{if(stopped)return;if(Date.now()-started>=maxWait){slow();return}try{const r=await fetch('${WAKE_PATH}',{cache:'no-store',credentials:'omit',headers:{accept:'application/json'}});const data=await r.json();if(data&&data.ready){ready();return}}catch{}tickTimer=setTimeout(check,1800)};retry.addEventListener('click',()=>{stop();stopped=false;started=Date.now();index=0;document.body.classList.remove('slow','ready');status.textContent=messages[0];messageTimer=setInterval(setMessage,2600);check()});messageTimer=setInterval(setMessage,2600);check()})();
</script></body></html>`;
}

function loaderResponse(maxWaitMs){
  return new Response(loaderHtml(maxWaitMs),{
    status:200,
    headers:{
      'content-type':'text/html; charset=utf-8',
      'cache-control':'no-store, max-age=0',
      'pragma':'no-cache',
      'x-content-type-options':'nosniff',
      'referrer-policy':'same-origin',
      'content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    },
  });
}

export function createHandler({fetchImpl=fetch}={}){
  return async function handle(request,env={}){
    const origin=originFromEnv(env);
    const probeTimeout=clamp(asNumber(env.PROBE_TIMEOUT_MS,DEFAULT_PROBE_TIMEOUT_MS),400,2500);
    const maxWait=clamp(asNumber(env.WAKE_MAX_WAIT_MS,DEFAULT_MAX_WAIT_MS),30000,180000);
    const url=new URL(request.url);

    if(url.pathname===WAKE_PATH){
      if(request.method!=='GET')return jsonResponse({ready:false,error:'method_not_allowed'},405);
      const probe=await probeOrigin(fetchImpl,origin,probeTimeout);
      return jsonResponse({ready:probe.ready,status:probe.status,elapsedMs:probe.elapsedMs});
    }

    if(isInitialHtmlNavigation(request)){
      const probe=await probeOrigin(fetchImpl,origin,probeTimeout);
      if(!probe.ready)return loaderResponse(maxWait);
      try{
        const response=await proxyToOrigin(request,fetchImpl,origin);
        if(response.status>=500)return loaderResponse(maxWait);
        return response;
      }catch{
        return loaderResponse(maxWait);
      }
    }

    try{
      return await proxyToOrigin(request,fetchImpl,origin);
    }catch{
      if(url.pathname.startsWith('/api/'))return jsonResponse({error:'upstream_unavailable'},502);
      return new Response('AMC temporalmente no disponible.',{status:502,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
    }
  };
}

const handle=createHandler();
export default {fetch(request,env){return handle(request,env);}};
