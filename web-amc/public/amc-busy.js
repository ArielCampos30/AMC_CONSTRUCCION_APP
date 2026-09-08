(function(root){
  let count=0;
  function ensure(){
    let overlay=document.getElementById('amc-busy-overlay');
    if(overlay)return overlay;
    const style=document.createElement('style');
    style.id='amc-busy-style';
    style.textContent='#amc-busy-overlay{position:fixed;inset:0;z-index:3000;display:grid;place-items:center;background:#071f1c24;backdrop-filter:blur(1px)}#amc-busy-overlay[hidden]{display:none}#amc-busy-spinner{width:52px;height:52px;border-radius:50%;border:5px solid #ffffff;border-top-color:#0b675f;box-shadow:0 6px 24px #0002;animation:amc-spin .75s linear infinite}@keyframes amc-spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){#amc-busy-spinner{animation-duration:1.5s}}';
    document.head.append(style);
    overlay=document.createElement('div');
    overlay.id='amc-busy-overlay';
    overlay.hidden=true;
    overlay.setAttribute('role','status');
    overlay.setAttribute('aria-live','polite');
    overlay.setAttribute('aria-label','Procesando');
    overlay.innerHTML='<div id="amc-busy-spinner" aria-hidden="true"></div>';
    document.body.append(overlay);
    return overlay;
  }
  function start(){
    count++;
    ensure().hidden=false;
  }
  function stop(){
    count=Math.max(0,count-1);
    if(!count)ensure().hidden=true;
  }
  async function run(task){
    start();
    try{return await task();}
    finally{stop();}
  }
  root.AMCBusy={start,stop,run};
})(globalThis);
