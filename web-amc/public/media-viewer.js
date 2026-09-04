const style=document.createElement('style');
style.textContent=`.amc-photo-viewer{width:min(96vw,1000px);max-width:96vw;max-height:94dvh;padding:12px;border:0;border-radius:16px}.amc-photo-viewer::backdrop{background:#000b}.amc-photo-viewer img{display:block;max-width:100%;max-height:78dvh;object-fit:contain;margin:auto}.amc-photo-viewer button{margin-bottom:12px}body[data-busy]::after{content:'Procesando…';position:fixed;bottom:85px;left:50%;transform:translateX(-50%);background:#123e39;color:white;padding:12px 22px;border-radius:24px;z-index:9999;pointer-events:none}fieldset{min-width:0}legend{max-width:100%;white-space:normal}fieldset label{display:flex;align-items:center;gap:8px}fieldset input[type=checkbox]{width:auto}img{max-width:100%}.view{scroll-margin-top:75px}`;
document.head.append(style);
document.addEventListener('click',e=>{
 const link=e.target.closest('a');if(!link||!link.querySelector('img')||!link.getAttribute('href')?.startsWith('/media/'))return;
 e.preventDefault();const dialog=document.createElement('dialog');dialog.className='amc-photo-viewer';
 const close=document.createElement('button');close.textContent='← Cerrar foto';close.onclick=()=>dialog.close();
 const status=document.createElement('p');status.textContent='Cargando foto…';const img=new Image();img.alt=link.querySelector('img').alt||'Foto del proyecto';img.onload=()=>status.remove();img.onerror=()=>{status.textContent='No se pudo cargar. Cerrá la foto y volvé a intentar.';};
 dialog.append(close,status,img);document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove(),{once:true});dialog.showModal();img.src=link.href;
});

