const handlers=[];
window.AMCRegisterBackHandler=fn=>{handlers.push(fn);return()=>{const i=handlers.lastIndexOf(fn);if(i>=0)handlers.splice(i,1);}};
window.AMCBackHandler=()=>{const fn=handlers.at(-1);return fn?fn()!==false:false;};

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const prefersReducedMotion=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const svg=(name)=>({
 close:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
 share:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.7 10.7l6.6-4.1M8.7 13.3l6.6 4.1"/></svg>',
 save:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 20h14"/></svg>'
}[name]);

function download(url){const a=document.createElement('a');a.href=url;a.download='Foto-AMC';document.body.append(a);a.click();a.remove();}
function visibleRect(element){if(!element?.isConnected)return null;const r=element.getBoundingClientRect();return r.width>1&&r.height>1&&r.bottom>0&&r.right>0&&r.top<innerHeight&&r.left<innerWidth?r:null;}
function fittedRect(stage,ratio){const r=stage.getBoundingClientRect(),pad=12,maxW=Math.max(1,r.width-pad*2),maxH=Math.max(1,r.height-pad*2);let width=maxW,height=width/Math.max(.01,ratio);if(height>maxH){height=maxH;width=height*ratio;}return {left:r.left+(r.width-width)/2,top:r.top+(r.height-height)/2,width,height};}
function flightImage(src,rect,radius='10px'){const image=document.createElement('img');image.className='amc-viewer-flight';image.src=src;Object.assign(image.style,{left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px',borderRadius:radius});(document.querySelector('.amc-photo-viewer[open]')||document.body).append(image);return image;}
async function animateFlight(src,from,to,{opening=true}={}){if(prefersReducedMotion()||!from||!to)return;const image=flightImage(src,from,opening?'10px':'0px');const animation=image.animate([
 {left:from.left+'px',top:from.top+'px',width:from.width+'px',height:from.height+'px',borderRadius:opening?'10px':'0px',opacity:1},
 {left:to.left+'px',top:to.top+'px',width:to.width+'px',height:to.height+'px',borderRadius:opening?'0px':'10px',opacity:1}
],{duration:opening?250:220,easing:'cubic-bezier(.2,.82,.2,1)',fill:'forwards'});try{await animation.finished;}catch{}image.remove();}

document.addEventListener('click',e=>{
 const link=e.target.closest('a');
 if(!link||!link.querySelector('img')||!/^\/media\/|^blob:/.test(link.getAttribute('href')||''))return;
 e.preventDefault();
 const container=link.closest('.mini-photos,.post-grid,.panel,.chat-photo-preview,.employee-photo-preview')||link.parentElement;
 const links=[...container.querySelectorAll('a[href^="/media/"],a[href^="blob:"]')].filter(a=>a.querySelector('img'));
 let index=Math.max(0,links.indexOf(link)),scale=1,x=0,y=0,startX=0,startY=0,startDistance=0,startScale=1,pinchX=0,pinchY=0,pinchBaseX=0,pinchBaseY=0,lastTap=0,lastTapX=0,lastTapY=0,loadToken=0,tapTimer=0,closing=false,controlsHidden=false,pointers=new Map(),removeBack;
 const sourceThumb=link.querySelector('img');

 const dialog=document.createElement('dialog');dialog.className='amc-photo-viewer';dialog.setAttribute('aria-label','Visor de fotos');
 const bar=document.createElement('div');bar.className='amc-viewer-bar';
 const close=document.createElement('button');close.type='button';close.className='amc-viewer-control amc-viewer-close';close.innerHTML=svg('close');close.setAttribute('aria-label','Cerrar foto');close.title='Cerrar';
 const title=document.createElement('div');title.className='amc-viewer-title';const who=document.createElement('strong'),when=document.createElement('small');title.append(who,when);
 const share=document.createElement('button');share.type='button';share.className='amc-viewer-control';share.innerHTML=svg('share')+'<span class="amc-viewer-action-label">Compartir</span>';share.setAttribute('aria-label','Compartir foto');share.title='Compartir foto';
 const save=document.createElement('button');save.type='button';save.className='amc-viewer-control';save.innerHTML=svg('save')+'<span class="amc-viewer-action-label">Guardar</span>';save.setAttribute('aria-label','Guardar foto');save.title='Guardar foto';
 const stage=document.createElement('div');stage.className='amc-viewer-stage';
 const frame=document.createElement('div');frame.className='amc-viewer-frame';
 const previewImg=new Image();previewImg.className='amc-viewer-image amc-viewer-preview';previewImg.draggable=false;previewImg.alt='Foto ampliada';
 const qualityImg=new Image();qualityImg.className='amc-viewer-image amc-viewer-quality';qualityImg.draggable=false;qualityImg.alt='';qualityImg.setAttribute('aria-hidden','true');
 const status=document.createElement('span');status.className='amc-viewer-status';
 frame.append(previewImg,qualityImg);stage.append(frame,status);bar.append(close,title,share,save);dialog.append(bar,stage);document.body.append(dialog);

 const currentLink=()=>links[index];
 const currentThumb=()=>currentLink()?.querySelector('img');
 const currentSource=()=>currentLink()?.href||'';
 const updateZoomClass=()=>dialog.classList.toggle('amc-zoomed',scale>1.01);
 const bounds=()=>{const iw=frame.clientWidth||1,ih=frame.clientHeight||1,s=stage.getBoundingClientRect();return {x:Math.max(0,(iw*scale-s.width)/2+16),y:Math.max(0,(ih*scale-s.height)/2+16)};};
 const constrain=()=>{if(scale<=1){x=0;y=0;return;}const b=bounds();x=clamp(x,-b.x,b.x);y=clamp(y,-b.y,b.y);};
 const transform=(animate=false)=>{constrain();const transition=animate?'transform .18s cubic-bezier(.2,.8,.2,1)':'';const value=`translate3d(${x}px,${y}px,0) scale(${scale})`;for(const image of [previewImg,qualityImg]){image.style.transition=transition;image.style.transform=value;}updateZoomClass();if(animate)setTimeout(()=>{for(const image of [previewImg,qualityImg])image.style.transition='';},190);};
 const reset=(animate=false)=>{scale=1;x=0;y=0;transform(animate);};
 const setControls=hidden=>{controlsHidden=!!hidden;dialog.classList.toggle('amc-controls-hidden',controlsHidden);};
 const toggleControls=()=>setControls(!controlsHidden);
 const zoomAround=(clientX,clientY,nextScale)=>{const rect=stage.getBoundingClientRect(),cx=rect.left+rect.width/2,cy=rect.top+rect.height/2,oldScale=scale||1,ratio=nextScale/oldScale;x=(clientX-cx)*(1-ratio)+x*ratio;y=(clientY-cy)*(1-ratio)+y*ratio;scale=nextScale;transform(true);};
 const toggleZoomAt=(clientX,clientY)=>{if(scale>1.05)reset(true);else zoomAround(clientX,clientY,2.6);};
 const displayedSrc=()=>qualityImg.classList.contains('amc-quality-ready')?(qualityImg.currentSrc||qualityImg.src):(previewImg.currentSrc||previewImg.src||currentThumb()?.currentSrc||currentThumb()?.src||currentSource());

 const show=(n,{animateFrom=null}={})=>{
  index=(n+links.length)%links.length;reset();setControls(false);const token=++loadToken,a=currentLink(),source=a.href,thumb=currentThumb(),preview=thumb?.currentSrc||thumb?.src||source,label=(index+1)+' de '+links.length;
  const thumbRatio=(thumb?.naturalWidth&&thumb?.naturalHeight)?thumb.naturalWidth/thumb.naturalHeight:Math.max(.01,(thumb?.getBoundingClientRect().width||1)/(thumb?.getBoundingClientRect().height||1)),target=fittedRect(stage,thumbRatio);
  frame.style.width=target.width+'px';frame.style.height=target.height+'px';frame.classList.toggle('amc-image-transitioning',!!animateFrom&&!prefersReducedMotion());
  qualityImg.classList.remove('amc-quality-ready');qualityImg.removeAttribute('src');
  let openingStarted=false,openingPromise=Promise.resolve();
  who.textContent=a.dataset.sender||thumb?.alt||'Foto AMC';when.textContent=a.dataset.date?new Date(a.dataset.date).toLocaleString('es-AR'):label;status.textContent=preview!==source?'Mejorando calidad…':label;
  const revealOnce=()=>{
   if(!animateFrom||openingStarted||token!==loadToken)return openingPromise;
   openingStarted=true;
   openingPromise=(async()=>{const from=visibleRect(animateFrom),to=frame.getBoundingClientRect();if(from)await animateFlight(preview,from,to,{opening:true});if(token===loadToken)frame.classList.remove('amc-image-transitioning');})();
   return openingPromise;
  };
  previewImg.onerror=()=>{if(token===loadToken){status.textContent='No se pudo cargar. Reintentá.';frame.classList.remove('amc-image-transitioning');}};
  previewImg.onload=()=>{void revealOnce();};
  previewImg.src=preview;if(previewImg.complete&&previewImg.naturalWidth)queueMicrotask(()=>void revealOnce());
  if(preview!==source){qualityImg.onload=async()=>{if(token!==loadToken)return;try{await qualityImg.decode?.();}catch{}await revealOnce();if(token!==loadToken)return;qualityImg.classList.add('amc-quality-ready');status.textContent=label;};qualityImg.onerror=()=>{if(token===loadToken){void revealOnce();status.textContent=label;}};qualityImg.src=source;}else status.textContent=label;
  const before=links[(index-1+links.length)%links.length]?.href,after=links[(index+1)%links.length]?.href;for(const candidate of new Set([before,after]))if(candidate&&candidate!==source){const preload=new Image();preload.src=candidate;}
 };

 const finish=()=>{loadToken++;clearTimeout(tapTimer);removeBack?.();dialog.remove();currentLink()?.focus?.({preventScroll:true});};
 const closeViewer=async()=>{if(closing)return;closing=true;clearTimeout(tapTimer);if(scale>1.01){reset(true);await sleep(prefersReducedMotion()?0:150);}const thumb=currentThumb(),to=visibleRect(thumb),from=frame.getBoundingClientRect(),src=displayedSrc();setControls(true);frame.classList.add('amc-image-transitioning');if(to&&src)await animateFlight(src,from,to,{opening:false});dialog.close();};
 close.onclick=closeViewer;dialog.addEventListener('cancel',ev=>{ev.preventDefault();closeViewer();});dialog.addEventListener('close',finish,{once:true});removeBack=window.AMCRegisterBackHandler(()=>{closeViewer();return true;});

 share.onclick=async()=>{const response=await fetch(currentSource()),blob=await response.blob(),file=new File([blob],'Foto-AMC.'+(blob.type.split('/')[1]||'jpg'),{type:blob.type});if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]})))await navigator.share({title:'Foto de AMC',files:[file]});else download(currentSource());};
 save.onclick=()=>download(currentSource());

 stage.addEventListener('pointerdown',ev=>{stage.setPointerCapture(ev.pointerId);pointers.set(ev.pointerId,{x:ev.clientX,y:ev.clientY,startX:ev.clientX,startY:ev.clientY});if(pointers.size===1){startX=ev.clientX-x;startY=ev.clientY-y;}else if(pointers.size===2){const [a,b]=[...pointers.values()];startDistance=Math.hypot(a.x-b.x,a.y-b.y);startScale=scale;pinchX=(a.x+b.x)/2;pinchY=(a.y+b.y)/2;pinchBaseX=x;pinchBaseY=y;}},{passive:true});
 stage.addEventListener('pointermove',ev=>{const point=pointers.get(ev.pointerId);if(!point)return;point.x=ev.clientX;point.y=ev.clientY;if(pointers.size===2){const [a,b]=[...pointers.values()],next=clamp(startScale*Math.hypot(a.x-b.x,a.y-b.y)/Math.max(1,startDistance),1,5),rect=stage.getBoundingClientRect(),cx=rect.left+rect.width/2,cy=rect.top+rect.height/2,ratio=next/Math.max(1,startScale);x=(pinchX-cx)*(1-ratio)+pinchBaseX*ratio;y=(pinchY-cy)*(1-ratio)+pinchBaseY*ratio;scale=next;transform();}else if(scale>1){x=ev.clientX-startX;y=ev.clientY-startY;transform();}},{passive:true});
 stage.addEventListener('pointerup',ev=>{const point=pointers.get(ev.pointerId),dx=ev.clientX-(point?.startX??ev.clientX),dy=ev.clientY-(point?.startY??ev.clientY),now=Date.now();pointers.delete(ev.pointerId);if(scale===1&&Math.abs(dx)>65&&Math.abs(dx)>Math.abs(dy)){show(index+(dx<0?1:-1));lastTap=0;return;}if(Math.abs(dx)<20&&Math.abs(dy)<20){if(now-lastTap<300&&Math.hypot(ev.clientX-lastTapX,ev.clientY-lastTapY)<44){clearTimeout(tapTimer);toggleZoomAt(ev.clientX,ev.clientY);lastTap=0;}else{lastTap=now;lastTapX=ev.clientX;lastTapY=ev.clientY;clearTimeout(tapTimer);tapTimer=setTimeout(toggleControls,300);}}},{passive:true});
 stage.addEventListener('pointercancel',ev=>pointers.delete(ev.pointerId));
 stage.addEventListener('dblclick',ev=>{ev.preventDefault();clearTimeout(tapTimer);toggleZoomAt(ev.clientX,ev.clientY);lastTap=0;});
 stage.addEventListener('wheel',ev=>{ev.preventDefault();const next=clamp(scale*(ev.deltaY<0?1.22:.82),1,5);if(next===1)reset(true);else zoomAround(ev.clientX,ev.clientY,next);},{passive:false});
 dialog.addEventListener('keydown',ev=>{if(ev.key==='ArrowRight'&&scale===1)show(index+1);if(ev.key==='ArrowLeft'&&scale===1)show(index-1);if(ev.key==='Escape'){ev.preventDefault();closeViewer();}});
 dialog.showModal();show(index,{animateFrom:sourceThumb});
});
