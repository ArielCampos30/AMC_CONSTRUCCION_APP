(()=>{
 const form=document.getElementById('accountDeletionForm');
 const status=document.getElementById('accountDeletionStatus');
 if(!form||!status)return;
 const endpoint='https://app.amcconstrucciones.com.ar/api/public/account-deletion';
 const submissionId=()=>{
  if(globalThis.crypto?.randomUUID)return globalThis.crypto.randomUUID().replace(/[^\w-]/g,'');
  return 'web-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,12);
 };
 form.addEventListener('submit',async event=>{
  event.preventDefault();
  if(!form.reportValidity())return;
  const button=form.querySelector('button[type="submit"]'),data=new FormData(form);
  button.disabled=true;status.textContent='Enviando solicitud…';
  try{
   const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({submissionId:submissionId(),email:String(data.get('email')||'').trim(),reason:String(data.get('reason')||'').trim(),website:String(data.get('website')||'')})});
   const body=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(body.error||'No se pudo enviar la solicitud.');
   form.reset();status.textContent=body.message||'Recibimos la solicitud. AMC va a verificar la identidad antes de procesarla.';
  }catch(error){status.textContent=error?.message||'No se pudo enviar la solicitud. Intentá nuevamente.';}
  finally{button.disabled=false;}
 });
})();