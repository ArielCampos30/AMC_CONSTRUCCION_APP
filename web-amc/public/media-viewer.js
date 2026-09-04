const style=document.createElement('style');
style.textContent=`.amc-photo-viewer{width:min(96vw,1000px);max-width:96vw;max-height:94dvh;padding:12px;border:0;border-radius:16px}.amc-photo-viewer::backdrop{background:#000b}.amc-photo-viewer img{display:block;max-width:100%;max-height:78dvh;object-fit:contain;margin:auto}.amc-photo-viewer button{margin-bottom:12px}body[data-busy]::after{content:'Procesando…';position:fixed;bottom:85px;left:50%;transform:translateX(-50%);background:#123e39;color:white;padding:12px 22px;border-radius:24px;z-index:9999;pointer-events:none}fieldset{min-width:0}legend{max-width:100%;white-space:normal}fieldset label{display:flex;align-items:center;gap:8px}fieldset input[type=checkbox]{width:auto}img{max-width:100%}.view{scroll-margin-top:75px}`;
document.head.append(style);

document.addEventListener('click',e=>{
 const link=e.target.closest('a');if(!link||!link.querySelector('img')||!link.getAttribute('href')?.startsWith('/media/'))return;e.preventDefault();
 const container=link.closest('.mini-photos,.post-grid,.panel')||link.parentElement;
 const links=[...container.querySelectorAll('a[href^="/media/"]')].filter(a=>a.querySelector('img'));let index=Math.max(0,links.indexOf(link)),zoom=1,startX=0;
 const dialog=document.createElement('dialog');dialog.className='amc-photo-viewer';dialog.style.cssText='width:100vw;max-width:100vw;height:100dvh;max-height:100dvh;margin:0;padding:16px;box-sizing:border-box;background:#102723;color:white;border-radius:0;overflow:hidden';
 const controls=document.createElement('div');controls.style.cssText='display:flex;gap:8px;flex-wrap:wrap;align-items:center';
 const close=document.createElement('button');close.textContent='Cerrar';close.onclick=()=>dialog.close();
 const previous=document.createElement('button');previous.textContent='← Anterior';previous.onclick=()=>show(index-1);
 const next=document.createElement('button');next.textContent='Siguiente →';next.onclick=()=>show(index+1);
 const magnify=document.createElement('button');magnify.textContent='Ampliar';
 const status=document.createElement('p');status.setAttribute('role','status');
 const viewport=document.createElement('div');viewport.style.cssText='height:calc(100dvh - 150px);overflow:auto;touch-action:pan-x pan-y pinch-zoom';
 const img=new Image();img.style.cssText='display:block;max-width:100%;max-height:100%;object-fit:contain;margin:auto';
 function scale(){img.style.maxWidth=zoom===1?'100%':'none';img.style.maxHeight=zoom===1?'100%':'none';img.style.width=zoom===1?'auto':'200%';magnify.textContent=zoom===1?'Ampliar':'Ver completa';}
 magnify.onclick=()=>{zoom=zoom===1?2:1;scale();};img.ondblclick=magnify.onclick;
 function show(n){index=(n+links.length)%links.length;zoom=1;scale();status.textContent='Cargando foto…';img.onload=()=>status.textContent=(index+1)+' de '+links.length;img.onerror=()=>status.textContent='No se pudo cargar la foto. Intentá nuevamente.';img.src=links[index].href;img.alt=links[index].querySelector('img').alt||'Foto del trabajo';previous.disabled=next.disabled=links.length<2;}
 viewport.addEventListener('touchstart',e=>{startX=e.touches.length===1?e.touches[0].clientX:null;},{passive:true});viewport.addEventListener('touchend',e=>{if(zoom!==1||startX===null)return;const dx=e.changedTouches[0].clientX-startX;if(Math.abs(dx)>65)show(index+(dx<0?1:-1));},{passive:true});
 dialog.addEventListener('keydown',e=>{if(e.key==='ArrowRight')show(index+1);if(e.key==='ArrowLeft')show(index-1);});
 controls.append(close,previous,next,magnify);viewport.append(img);dialog.append(controls,status,viewport);document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove(),{once:true});dialog.showModal();show(index);
});
