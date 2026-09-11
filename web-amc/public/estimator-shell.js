(()=>{
 const app=document.getElementById('app');
 if(!app)return;
 let currentFrame=null;
 const post=view=>{const frame=document.getElementById('amc-estimator');if(frame?.contentWindow)frame.contentWindow.postMessage({type:'amc:estimator-view',view},location.origin);};
 function mount(frame){
  if(frame.closest('.amc-estimator-shell')){currentFrame=frame;document.body.classList.add('amc-estimator-active');return;}
  const main=frame.closest('main');if(!main)return;
  const heading=main.querySelector('.estimator-heading'),chooser=main.querySelector('.new-budget');
  const shell=document.createElement('section');shell.className='amc-estimator-shell';shell.setAttribute('aria-label','Cotizador AMC');
  const toolbar=document.createElement('div');toolbar.className='amc-estimator-shell-toolbar';toolbar.innerHTML='<div class="amc-estimator-shell-title"><strong>Cotizador AMC</strong><span>Presupuestos y tarifario</span></div><div class="amc-estimator-shell-actions"><button type="button" class="primary" data-estimator-view="quote">Cotizador</button><button type="button" class="outline" data-estimator-view="tariff">Tarifario</button><button type="button" class="outline" data-estimator-close>← Volver a AMC</button></div>';
  const setup=document.createElement('div');setup.className='amc-estimator-shell-setup';
  if(heading){heading.classList.add('amc-estimator-shell-heading');setup.append(heading);}
  if(chooser)setup.append(chooser);
  if(!setup.children.length)setup.hidden=true;
  const frameBox=document.createElement('div');frameBox.className='amc-estimator-shell-frame';
  frame.before(shell);shell.append(toolbar,setup,frameBox);frameBox.append(frame);
  currentFrame=frame;document.body.classList.add('amc-estimator-active');
 }
 function sync(){
  const frame=document.getElementById('amc-estimator');
  if(frame){mount(frame);return;}
  currentFrame=null;document.body.classList.remove('amc-estimator-active');
 }
 app.addEventListener('click',event=>{
  const close=event.target.closest('[data-estimator-close]');
  if(close){event.preventDefault();location.hash='#presupuestos';return;}
  const button=event.target.closest('[data-estimator-view]');
  if(!button)return;event.preventDefault();
  app.querySelectorAll('[data-estimator-view]').forEach(node=>node.classList.toggle('primary',node===button));
  app.querySelectorAll('[data-estimator-view]').forEach(node=>node.classList.toggle('outline',node!==button));
  post(button.dataset.estimatorView);
 });
 window.addEventListener('message',event=>{
  if(event.origin!==location.origin||event.source!==currentFrame?.contentWindow||event.data?.type!=='amc:estimator-ready')return;
  post('quote');
 });
 new MutationObserver(sync).observe(app,{childList:true,subtree:true});
 sync();
 const style=document.createElement('style');style.id='amc-estimator-shell-style';style.textContent=`
 body.amc-estimator-active{overflow:hidden!important}
 body.amc-estimator-active>.boot-loader{display:none!important}
 body.amc-estimator-active .sidebar,body.amc-estimator-active .workspace>header,body.amc-estimator-active .bottom-nav,body.amc-estimator-active .footer-note,body.amc-estimator-active .floating-chat-launcher{display:none!important}
 body.amc-estimator-active .workspace{margin-left:0!important;height:100dvh!important;overflow:hidden!important}
 body.amc-estimator-active .workspace>main{max-width:none!important;width:100%!important;height:100dvh!important;margin:0!important;padding:0!important;overflow:hidden!important}
 .amc-estimator-shell{position:fixed;inset:0;z-index:80;display:grid;grid-template-rows:auto auto minmax(0,1fr);width:100%;height:100dvh;background:#f3faf8;color:#163e3a;overflow:hidden}
 .amc-estimator-shell-toolbar{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:10px 16px;background:#fff;border-bottom:1px solid #cfe5df;min-height:66px}
 .amc-estimator-shell-title{display:flex;flex-direction:column;min-width:0}.amc-estimator-shell-title strong{font-size:18px}.amc-estimator-shell-title span{font-size:12px;color:#6d827c}
 .amc-estimator-shell-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.amc-estimator-shell-actions button{min-height:42px;padding:9px 14px;white-space:nowrap}
 .amc-estimator-shell-setup{background:#f3faf8;border-bottom:1px solid #cfe5df;padding:0 14px;max-height:38dvh;overflow:auto}.amc-estimator-shell-heading{display:none!important}.amc-estimator-shell-setup>.new-budget{margin:8px 0!important;padding:10px 14px!important}.amc-estimator-shell-setup>.new-budget[open]{max-height:34dvh;overflow:auto}
 .amc-estimator-shell-frame{min-height:0;overflow:hidden;background:#fff}.amc-estimator-shell #amc-estimator{display:block!important;width:100%!important;height:100%!important;min-height:0!important;border:0!important;border-radius:0!important;background:#fff}
 @media(max-width:700px){.amc-estimator-shell-toolbar{padding:8px 10px;gap:8px;min-height:58px}.amc-estimator-shell-title span{display:none}.amc-estimator-shell-title strong{font-size:15px}.amc-estimator-shell-actions{gap:5px;justify-content:flex-end}.amc-estimator-shell-actions button{min-height:38px;padding:7px 9px;font-size:12px}.amc-estimator-shell-setup{padding:0 8px;max-height:42dvh}.amc-estimator-shell-setup>.new-budget{padding:8px 10px!important}}
 @media(max-width:430px){.amc-estimator-shell-title{display:none}.amc-estimator-shell-toolbar{justify-content:center}.amc-estimator-shell-actions{width:100%;display:grid;grid-template-columns:1fr 1fr}.amc-estimator-shell-actions [data-estimator-close]{grid-column:1/-1}}
 `;document.head.append(style);
})();
