export function createAdminTrashUI({getState,heading,esc,date,empty}){
 const render=()=>{
  const entries=getState().trashEntries||[];
  return heading('ADMINISTRACIÓN','Papelera','Pruebas, duplicados y errores eliminados de los circuitos activos.')+
   `<section class="panel"><h2>Archivo y Papelera no son lo mismo</h2><p><strong>Archivar</strong> conserva un presupuesto real fuera de los pendientes. <strong>Papelera</strong> es para pruebas, errores o duplicados que después podés restaurar o eliminar definitivamente.</p></section>`+
   `<section class="admin-v3-list">${entries.map(entry=>`<article class="admin-v3-card" data-trash-entry="${esc(entry.id)}"><div class="title-row"><div><small>${entry.rootType==='request'?'Solicitud':'Presupuesto'}</small><h2>${esc(entry.title||'Elemento eliminado')}</h2><p>${esc(entry.subtitle||'Sin detalle')}</p></div><span class="status">Papelera</span></div><div class="admin-v3-meta"><span>${date(entry.trashedAt)}</span><span>${Number(entry.count||1)} registro${Number(entry.count||1)===1?'':'s'} relacionado${Number(entry.count||1)===1?'':'s'}</span></div><div class="admin-v3-actions"><button data-maintenance-action="restore-trash" data-id="${esc(entry.id)}">Restaurar</button><button class="danger" data-maintenance-action="delete-trash" data-id="${esc(entry.id)}">Eliminar definitivamente</button></div></article>`).join('')||empty('La Papelera está vacía','Las solicitudes o presupuestos que elimines aparecerán acá antes del borrado definitivo.')}</section>`+
   `<a class="inline-action" href="#mas-admin">← Volver a Más</a>`;
 };
 return {render};
}
