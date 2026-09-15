const handlers=[];
window.AMCRegisterBackHandler=fn=>{handlers.push(fn);return()=>{const i=handlers.lastIndexOf(fn);if(i>=0)handlers.splice(i,1);}};
window.AMCBackHandler=()=>{const fn=handlers.at(-1);return fn?fn()!==false:false;};

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const prefersReducedMotion=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const svg=name=>({
 close:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
 share:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.7 10.7l6.6-4.1M8.7 13.3l6.6 4.1"/></svg>',
 save:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 20h14"/></svg>'
}[name]);

const viewerCache=new Map(),VIEWER_CACHE_LIMIT=14;
function mediaViewerUrl(source){
 if(!source||source.startsWith('blob:'))return source;
 try{
  const url=new URL(source,location.href);
  if(!url.pathname.startsWith('/media/'))return source;
  url.searchParams.delete('thumb');
  url.searchParams.set('view','1');
  return url.href;
 }catch{return source;}
}
function trimViewerCache(){
 while(viewerCache.size>VIEWER_CACHE_LIMIT){
  const [key,entry]=viewerCache.entries().next().value;
  viewerCache.delete(key);
  entry.evicted=true;
  if(entry.objectUrl)URL.revokeObjectURL(entry.objectUrl);
 }
}
function loadViewerSource(source){
 const url=mediaViewerUrl(source);
 if(!url||url.startsWith('blob:'))return Promise.resolve(url||source);
 const existing=viewerCache.get(url);
 if(existing){viewerCache.delete(url);viewerCache.set(url,existing);return existing.promise;}
 const entry={objectUrl:'',evicted:false,promise:null};
 entry.promise=fetch(url,{credentials:'same-origin'}).then(response=>{
  if(!response.ok)throw Error('viewer-'+response.status);
  return response.blob();
 }).then(blob=>{
  const objectUrl=URL.createObjectURL(blob);
  if(entry.evicted){URL.revokeObjectURL(objectUrl);return source;}
  entry.objectUrl=objectUrl;
  return objectUrl;
 }).catch(()=>source);
 viewerCache.set(url,entry);
 trimViewerCache();
 return entry.promise;
}
function warmViewerLink(link){
 const href=link?.href||'';
 if(!href||navigator.connection?.saveData)return;
 void loadViewerSource(href);
}
function mediaLinkFor(target){
 const link=target?.closest?.('a');
 if(!link||!link.querySelector('img'))return null;
 const href=link.getAttribute('href')||'';
 return /^\/media\/|^blob:/.test(href)?link:null;
}
document.addEventListener('load',event=>{
 if(!(event.target instanceof HTMLImageElement))return;
 const link=mediaLinkFor(event.target);
 if(link)setTimeout(()=>warmViewerLink(link),40);
},true);
document.addEventListener('pointerover',event=>{const link=mediaLinkFor(event.target);if(link)warmViewerLink(link);},{passive:true});
document.addEventListener('touchstart',event=>{const link=mediaLinkFor(event.target);if(link)warmViewerLink(link);},{passive:true});

function download(url){const a=document.createElement('a');a.href=url;a.download='Foto-AMC';document.body.append(a);a.click();a.remove();}
function visibleRect(element){if(!element?.isConnected)return null;const r=element.getBoundingClientRect();return r.width>1&&r.height>1&&r.bottom>0&&r.right>0&&r.top<innerHeight&&r.left<innerWidth?r:null;}
function fittedRect(stage,ratio){const r=stage.getBoundingClientRect(),pad=12,maxW=Math.max(1,r.width-pad*2),maxH=Math.max(1,r.height-pad*2);let width=maxW,height=width/Math.max(.01,ratio);if(height>maxH){height=maxH;width=height*ratio;}return {left:r.left+(r.width-width)/2,top:r.top+(r.height-height)/2,width,height};}
function flightImage(src,rect,radius='10px'){const image=document.createElement('img');image.className='amc-viewer-flight';image.src=src;Object.assign(image.style,{left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px',borderRadius:radius});(document.querySelector('.amc-photo-viewer[open]')||document.body).append(image);return image;}
function beginFlight(src,from,to,{opening=true}={}){
 if(prefersReducedMotion()||!from||!to)return {image:null,finished:Promise.resolve()};
 const image=flightImage(src,from,opening?'10px':'0px');
 const animation=image.animate([
  {left:from.left+'px',top:from.top+'px',width:from.width+'px',height:from.height+'px',borderRadius:opening?'10px':'0px',opacity:1},
  {left:to.left+'px',top:to.top+'px',width:to.width+'px',height:to.height+'px',borderRadius:opening?'0px':'10px',opacity:1}
 ],{duration:opening?250:220,easing:'cubic-bezier(.2,.82,.2,1)',fill:'forwards'});
 return {image,finished:animation.finished.catch(()=>{})};
}
async function removeFlight(flight,{fade=false}={}){
 if(!flight?.image)return;
 if(fade&&!prefersReducedMotion()){
  try{await flight.image.animate([{opacity:1},{opacity:0}],{duration:75,easing:'ease-out',fill:'forwards'}).finished;}catch{}
 }
 flight.image.remove();
}
async function animateFlight(src,from,to,{opening=true}={}){const flight=beginFlight(src,from,to,{opening});await flight.finished;await removeFlight(flight);}
function decodeSource(src){
 return new Promise((resolve,reject)=>{
  const image=new Image();
  image.decoding='async';
  image.onload=async()=>{try{await image.decode?.();}catch{}resolve(src);};
  image.onerror=()=>reject(Error('image-load'));
  image.src=src;
  if(image.complete&&image.naturalWidth)queueMicrotask(async()=>{try{await image.decode?.();}catch{}resolve(src);});
 });
}

document.addEventListener('click',e=>{
 const link=mediaLinkFor(e.target);
 if(!link)return;
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
 const viewerImg=new Image();viewerImg.className='amc-viewer-image';viewerImg.draggable=false;viewerImg.alt='Foto ampliada';
 const status=document.createElement('span');status.className='amc-viewer-status';
 frame.append(viewerImg);stage.append(frame,status);bar.append(close,title,share,save);dialog.append(bar,stage);document.body.append(dialog);

 const currentLink=()=>links[index];
 const currentThumb=()=>currentLink()?.querySelector('img');
 const currentSource=()=>currentLink()?.href||'';
 const updateZoomClass=()=>dialog.classList.toggle('amc-zoomed',scale>1.01);
 const bounds=()=>{const iw=frame.clientWidth||1,ih=frame.clientHeight||1,s=stage.getBoundingClientRect();return {x:Math.max(0,(iw*scale-s.width)/2+16),y:Math.max(0,(ih*scale-s.height)/2+16)};};
 const constrain=()=>{if(scale<=1){x=0;y=0;return;}const b=bounds();x=clamp(x,-b.x,b.x);y=clamp(y,-b.y,b.y);};
 const transform=(animate=false)=>{constrain();viewerImg.style.transition=animate?'transform .18s cubic-bezier(.2,.8,.2,1)':'';viewerImg.style.transform=`translate3d(${x}px,${y}px,0) scale(${scale})`;updateZoomClass();if(animate)setTimeout(()=>{viewerImg.style.transition='';},190);};
 const reset=(animate=false)=>{scale=1;x=0;y=0;transform(animate);};
 const setControls=hidden=>{controlsHidden=!!hidden;dialog.classList.toggle('amc-controls-hidden',controlsHidden);};
 const toggleControls=()=>setControls(!controlsHidden);
 const zoomAround=(clientX,clientY,nextScale)=>{const rect=stage.getBoundingClientRect(),cx=rect.left+rect.width/2,cy=rect.top+rect.height/2,oldScale=scale||1,ratio=nextScale/oldScale;x=(clientX-cx)*(1-ratio)+x*ratio;y=(clientY-cy)*(1-ratio)+y*ratio;scale=nextScale;transform(true);};
 const toggleZoomAt=(clientX,clientY)=>{if(scale>1.05)reset(true);else zoomAround(clientX,clientY,2.6);};
 const displayedSrc=()=>viewerImg.currentSrc||viewerImg.src||currentThumb()?.currentSrc||currentThumb()?.src||currentSource();

 const show=(n,{animateFrom=null}={})=>{
  index=(n+links.length)%links.length;reset();setControls(false);
  const token=++loadToken,a=currentLink(),source=a.href,thumb=currentThumb(),preview=thumb?.currentSrc||thumb?.src||source,label=(index+1)+' de '+links.length,
   thumbRatio=(thumb?.naturalWidth&&thumb?.naturalHeight)?thumb.naturalWidth/thumb.naturalHeight:Math.max(.01,(thumb?.getBoundingClientRect().width||1)/(thumb?.getBoundingClientRect().height||1)),target=fittedRect(stage,thumbRatio);
  who.textContent=a.dataset.sender||thumb?.alt||'Foto AMC';when.textContent=a.dataset.date?new Date(a.dataset.date).toLocaleString('es-AR'):label;status.textContent=label;
  let flight=null;
  if(animateFrom){
   frame.style.width=target.width+'px';frame.style.height=target.height+'px';frame.classList.add('amc-image-waiting');
   const from=visibleRect(animateFrom),to=frame.getBoundingClientRect();
   flight=beginFlight(preview,from,to,{opening:true});
  }
  (async()=>{
   let displaySource=await loadViewerSource(source);
   if(token!==loadToken)return;
   try{await decodeSource(displaySource);}catch{
    displaySource=preview;
    try{await decodeSource(displaySource);}catch{}
   }
   if(token!==loadToken)return;
   if(!animateFrom){frame.style.width=target.width+'px';frame.style.height=target.height+'px';}
   viewerImg.src=displaySource;
   try{await viewerImg.decode?.();}catch{}
   if(token!==loadToken)return;
   if(flight)await flight.finished;
   if(token!==loadToken){await removeFlight(flight);return;}
   frame.classList.remove('amc-image-waiting');
   await new Promise(requestAnimationFrame);
   await removeFlight(flight,{fade:true});
   status.textContent=label;
  })();
  const before=links[(index-1+links.length)%links.length],after=links[(index+1)%links.length];
  for(const candidate of new Set([before,after]))if(candidate&&candidate!==a)warmViewerLink(candidate);
 };

 const finish=()=>{loadToken++;clearTimeout(tapTimer);removeBack?.();dialog.remove();currentLink()?.focus?.({preventScroll:true});};
 const closeViewer=async()=>{if(closing)return;closing=true;clearTimeout(tapTimer);if(scale>1.01){reset(true);await sleep(prefersReducedMotion()?0:150);}const thumb=currentThumb(),to=visibleRect(thumb),from=frame.getBoundingClientRect(),src=displayedSrc();setControls(true);frame.classList.add('amc-image-waiting');if(to&&src)await animateFlight(src,from,to,{opening:false});dialog.close();};
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
