const normalize=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();

function updateSearch(input){
 const container=document.getElementById('admin-global-search-results');if(!container)return;
 const term=normalize(input.value),rows=[...container.querySelectorAll('[data-admin-search-row]')],hint=container.querySelector('[data-admin-search-hint]');
 let shown=0;
 for(const row of rows){const visible=term.length>=2&&shown<14&&String(row.dataset.search||'').includes(term);row.hidden=!visible;if(visible)shown++;}
 if(!hint)return;
 if(term.length<2){hint.hidden=false;hint.textContent='Escribí al menos 2 caracteres para buscar.';return;}
 hint.hidden=false;hint.textContent=shown?`${shown} resultado${shown===1?'':'s'} encontrado${shown===1?'':'s'}.`:'No encontramos clientes, solicitudes, presupuestos ni obras con esa búsqueda.';
}

if(typeof document!=='undefined')document.addEventListener('input',event=>{if(event.target?.id==='admin-global-search-input')updateSearch(event.target);});

export {updateSearch};
