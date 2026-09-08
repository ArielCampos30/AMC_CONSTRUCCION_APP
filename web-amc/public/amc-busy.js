(function(root){
  let count=0,shownAt=0,hideTimer=null;
  const MIN_VISIBLE=420;
  function ensure(){
    let overlay=document.getElementById('amc-busy-overlay');
    if(overlay)return overlay;
    const style=document.createElement('style');
    style.id='amc-busy-style';
    style.textContent='#amc-busy-overlay{position:fixed;inset:0;z-index:3000;display:grid;place-items:center;background:#071f1c2b;backdrop-filter:blur(2px)}#amc-busy-overlay[hidden]{display:none}.amc-busy-card{min-width:138px;padding:18px 22px 16px;border:1px solid #dbe9e6;border-radius:24px;background:#fffffff2;box-shadow:0 18px 55px #0a2d2740;display:grid;justify-items:center;gap:9px}.amc-busy-logo-wrap{position:relative;width:76px;height:76px}.amc-busy-ring{position:absolute;inset:0;border-radius:50%;background:conic-gradient(from 30deg,transparent 0 18%,#0b675f 18% 44%,#6fc5b8 44% 59%,transparent 59% 100%);animation:amc-busy-turn 1.05s linear infinite}.amc-busy-logo{position:absolute;inset:7px;width:62px;height:62px;border-radius:50%;object-fit:cover;border:4px solid #fff;box-shadow:0 5px 16px #0b675f33}.amc-busy-card strong{font-size:14px;letter-spacing:.12em;color:#0b4943}.amc-busy-dots{display:flex;gap:5px;height:7px}.amc-busy-dots i{width:6px;height:6px;border-radius:50%;background:#0b675f;opacity:.3;animation:amc-busy-dot 1s ease-in-out infinite}.amc-busy-dots i:nth-child(2){animation-delay:.16s}.amc-busy-dots i:nth-child(3){animation-delay:.32s}@keyframes amc-busy-turn{to{transform:rotate(360deg)}}@keyframes amc-busy-dot{0%,60%,100%{transform:translateY(0);opacity:.25}30%{transform:translateY(-3px);opacity:1}}@media(prefers-reduced-motion:reduce){.amc-busy-ring,.amc-busy-dots i{animation:none}.amc-busy-ring{background:#0b675f26}}';
    document.head.append(style);
    overlay=document.createElement('div');
    overlay.id='amc-busy-overlay';
    overlay.hidden=true;
    overlay.setAttribute('role','status');
    overlay.setAttribute('aria-live','polite');
    overlay.setAttribute('aria-label','Procesando');
    overlay.innerHTML='<div class="amc-busy-card" aria-hidden="true"><div class="amc-busy-logo-wrap"><span class="amc-busy-ring"></span><img class="amc-busy-logo" src="/assets/amc-logo.webp" alt=""></div><strong>AMC</strong><span class="amc-busy-dots"><i></i><i></i><i></i></span></div>';
    document.body.append(overlay);
    return overlay;
  }
  function start(){
    count++;
    if(hideTimer){clearTimeout(hideTimer);hideTimer=null;}
    const overlay=ensure();
    if(overlay.hidden){overlay.hidden=false;shownAt=performance.now();}
  }
  function stop(){
    count=Math.max(0,count-1);
    if(count)return;
    const overlay=ensure(),remaining=Math.max(0,MIN_VISIBLE-(performance.now()-shownAt));
    hideTimer=setTimeout(()=>{if(!count)overlay.hidden=true;hideTimer=null;},remaining);
  }
  async function run(task){
    start();
    try{return await task();}
    finally{stop();}
  }
  root.AMCBusy={start,stop,run};
})(globalThis);
