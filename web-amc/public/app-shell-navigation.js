const ADMIN_LINKS=[['inicio','Inicio','⌂'],['solicitudes','Solicitudes','▤'],['presupuestos','Presupuestos','▤'],['obras','Obras','⌂'],['mas-admin','Más','•••']];
const EMPLOYEE_LINKS=[['inicio-empleado','Inicio','⌂'],['mis-trabajos','Mis trabajos','▦'],['perfil','Perfil','○']];
const CLIENT_LINKS=[['inicio','Inicio','⌂'],['mis-trabajos-cliente','Mis trabajos','▦'],['chat-cliente','Chat','◌'],['perfil','Perfil','○']];
const PUBLIC_SIDEBAR_LINKS=[['inicio','Inicio','⌂'],['servicios','Servicios','▦'],['ideas','Ideas para tu casa','✧'],['favoritos','Guardados','♡'],['presupuestos','Presupuestos','▤'],['obra','Mi obra','⌂'],['resenas','Reseñas','☆'],['perfil','Mi perfil','○'],['mensajes','Mensajes','◌'],['agenda','Agenda','▦'],['adicionales','Adicionales','＋'],['comprobantes','Comprobantes','▤'],['compras','Compras y facturas','▤']];
const PUBLIC_BOTTOM_LINKS=[['inicio','Inicio','⌂'],['servicios','Servicios','▦'],['pedir','Pedir','＋'],['obra','Mi obra','▤'],['perfil','Perfil','○']];

const linksFor=(links,page)=>links.map(([route,label,icon])=>({route,label,icon,active:route===page}));

export function getShellNavigation({role,page}){
 const sidebar=role==='admin'?ADMIN_LINKS:role==='employee'?EMPLOYEE_LINKS:role==='client'?CLIENT_LINKS:PUBLIC_SIDEBAR_LINKS;
 const bottom=role==='admin'?ADMIN_LINKS:role==='employee'?EMPLOYEE_LINKS:role==='client'?CLIENT_LINKS:PUBLIC_BOTTOM_LINKS;
 return {sidebar:linksFor(sidebar,page),bottom:linksFor(bottom,page)};
}

export function getShellRoleClasses(role){
 return {'admin-v3':role==='admin','employee-v4':role==='employee','client-v5':role==='client'};
}
