(function(root){
  function ensureStyle(){
    if(document.getElementById('amc-confirm-style'))return;
    const style=document.createElement('style');
    style.id='amc-confirm-style';
    style.textContent='.amc-confirm-dialog{position:fixed;inset:0;margin:auto;max-width:min(440px,calc(100vw - 32px));max-height:min(620px,calc(100dvh - 32px));overflow:auto;border:0;border-radius:22px;padding:0;box-shadow:0 24px 70px #0005}.amc-confirm-dialog::backdrop{background:#071f1c99;backdrop-filter:blur(2px)}.amc-confirm-card{padding:22px;margin:0;background:#fff;color:#17211f;font:inherit}.amc-confirm-brand{display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:16px}.amc-confirm-brand img{width:44px;height:44px;border-radius:12px;object-fit:cover}.amc-confirm-brand strong,.amc-confirm-brand small{display:block}.amc-confirm-brand small{color:#64716f;margin-top:2px}.amc-confirm-card h2{margin:0 0 8px}.amc-confirm-card p{margin:0 0 20px;line-height:1.5;white-space:pre-line;overflow-wrap:anywhere}.amc-confirm-actions{display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap}.amc-confirm-actions button{min-height:42px;border-radius:10px;padding:9px 14px;border:1px solid #cbd7d4;background:#fff;font-weight:700}.amc-confirm-actions .primary{background:#0b675f;color:#fff;border-color:#0b675f}@media(max-width:560px){.amc-confirm-dialog{inset:max(12px,env(safe-area-inset-top)) 12px max(12px,env(safe-area-inset-bottom));width:auto;max-width:none;max-height:none}.amc-confirm-card{padding:20px}.amc-confirm-actions{flex-wrap:nowrap}.amc-confirm-actions button{flex:1}}';
    document.head.append(style);
  }
  function ensureDialog(){ensureStyle();
    let dialog=document.getElementById('amc-confirm-dialog');
    if(dialog)return dialog;
    dialog=document.createElement('dialog');
    dialog.id='amc-confirm-dialog';
    dialog.className='admin-v3-dialog amc-confirm-dialog';
    dialog.innerHTML='<div class="amc-confirm-card"><div class="amc-confirm-brand"><img src="/assets/amc-logo.webp" alt="AMC"><div><strong>AMC</strong><small>Construcciones y Arreglos</small></div></div><h2 id="amc-confirm-title">Confirmar acción</h2><p id="amc-confirm-message"></p><div class="amc-confirm-actions"><button value="cancel" type="button" class="outline">Cancelar</button><button value="confirm" type="button" class="primary">Confirmar</button></div></div>';
    document.body.append(dialog);
    return dialog;
  }
  function confirmAction(message,options={}){
    return new Promise(resolve=>{
      const dialog=ensureDialog(),
            title=dialog.querySelector('#amc-confirm-title'),
            body=dialog.querySelector('#amc-confirm-message'),
            confirmButton=dialog.querySelector('button[value="confirm"]'),
            cancelButton=dialog.querySelector('button[value="cancel"]');
      title.textContent=options.title||'Confirmar acción';
      body.textContent=String(message||'');
      confirmButton.textContent=options.confirmLabel||'Confirmar';
      cancelButton.textContent=options.cancelLabel||'Cancelar';
      cancelButton.hidden=options.singleAction===true;
      dialog.returnValue='';
      confirmButton.onclick=()=>dialog.close('confirm');
      cancelButton.onclick=()=>dialog.close('cancel');
      const finish=()=>{
        dialog.removeEventListener('close',finish);
        resolve(dialog.returnValue==='confirm');
      };
      dialog.addEventListener('close',finish,{once:true});
      dialog.showModal();
      requestAnimationFrame(()=>confirmButton.focus());
    });
  }
  root.AMCConfirm=confirmAction;
})(globalThis);
