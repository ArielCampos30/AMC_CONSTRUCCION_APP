(()=>{
 if(!window.AMCStored)return;
 let revision=AMCStored.saved?.revision||0,last=AMCStored.saved?JSON.stringify({db:AMCStored.saved.db,draft:AMCStored.saved.draft}):'',busy=false,conflict=false;
 const box=document.createElement('div');box.style.cssText='position:sticky;top:0;z-index:30;padding:10px;background:#e7f3e9;color:#153d28;border-bottom:1px solid #a8c4ae';
 const label=document.createElement('span'),backup=document.createElement('button');backup.textContent='Respaldo del cotizador';backup.title='Copia manual de tus borradores y precios. No se envía al cliente.';backup.style.marginLeft='12px';backup.onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify({db,draft},null,2)],{type:'application/json'}));a.download='AMC-respaldo-cotizador.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);};box.append(label,backup);document.body.prepend(box);
 const snapshot=()=>JSON.stringify({db,draft});
 async function flush(){if(busy||conflict)return;const current=snapshot();if(current===last){label.textContent='Guardado en tu cuenta AMC';return;}busy=true;label.textContent='Guardando en tu cuenta…';try{const r=await fetch('/api/estimator-state',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':AMCStored.csrf},body:JSON.stringify({...JSON.parse(current),revision})});const result=await r.json();if(!r.ok){if(r.status===409)conflict=true;throw Error(result.error||'No se pudo guardar');}revision=result.revision;last=current;label.textContent='Guardado en tu cuenta AMC';}catch(e){label.textContent=conflict?'Cambios en otra ventana: descargá tu copia y recargá antes de continuar.':'Pendiente de guardar: revisá la conexión. Tu copia local se conserva.';}finally{busy=false;}}
 const oldSaveDb=saveDb,oldSaveDraft=saveDraft;saveDb=function(){oldSaveDb();label.textContent='Cambios pendientes de guardar…';};saveDraft=function(){oldSaveDraft();label.textContent='Cambios pendientes de guardar…';};
 window.addEventListener('beforeunload',e=>{if(snapshot()!==last){e.preventDefault();e.returnValue='';}});
 window.addEventListener('online',flush);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')flush();});setInterval(flush,1000);flush();
})();

