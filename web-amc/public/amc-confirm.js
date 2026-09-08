(function(root){
  function ensureDialog(){
    let dialog=document.getElementById('amc-confirm-dialog');
    if(dialog)return dialog;
    dialog=document.createElement('dialog');
    dialog.id='amc-confirm-dialog';
    dialog.className='admin-v3-dialog amc-confirm-dialog';
    dialog.innerHTML='<form method="dialog" class="amc-confirm-card"><div class="amc-confirm-brand"><img src="/assets/amc-logo.webp" alt="AMC"><div><strong>AMC</strong><small>Construcciones y Arreglos</small></div></div><h2 id="amc-confirm-title">Confirmar acción</h2><p id="amc-confirm-message"></p><div class="amc-confirm-actions"><button value="cancel" type="submit" class="outline">Cancelar</button><button value="confirm" type="submit" class="primary">Confirmar</button></div></form>';
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
