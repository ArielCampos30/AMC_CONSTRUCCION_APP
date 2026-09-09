export function createAdminSystemUI({getState,getConfig,heading,esc,date}){
 const more=()=>{
  const state=getState(),config=getConfig(),sys=state.system||{},mb=Number(sys.storageBytes||0)/1024/1024;
  return heading('ADMINISTRACIÓN','Más','Gestión, herramientas y sistema.')+
   [['Gestión',[['chat-admin','Chat'],['clientes','Clientes'],['empleados','Empleados'],['resenas','Reseñas']]],
    ['Herramientas',[['cotizador','Tarifario y cotizador'],['resumen-diario','Resumen diario']]],
    ['Sistema',[['perfil','Configuración'],['respaldos','Respaldos']]]]
   .map(([title,items])=>`<section class="admin-v3-more"><h2>${title}</h2>${items.map(([p,t])=>`<a href="#${p}"><span>${t}</span><b>›</b></a>`).join('')}</section>`).join('')+
   `<section class="panel"><h2>Estado de AMC</h2><p><strong>Versión:</strong> ${esc(config.version||sys.version||'local')}</p><p><strong>Base:</strong> ${esc(sys.database||'')}</p><p><strong>Datos:</strong> ${Number(sys.documents||0)} registros · ${Number(sys.files||0)} archivos · ${mb.toFixed(1)} MB</p><p><strong>Dispositivos con avisos:</strong> ${Number(sys.devices||0)}</p><p class="muted">Este identificador permite saber exactamente qué versión está usando el servidor cuando reportás un problema.</p></section>`;
 };
 const backups=()=>{
  const state=getState(),config=getConfig(),demo=!!config.demo,sys=state.system||{},backupStatus=sys.backupStatus||'unknown',
   last=sys.backupLastSuccessAt?date(sys.backupLastSuccessAt):'',healthy=backupStatus==='ok',failed=backupStatus==='failed',
   badge=demo?'Prueba / staging':healthy?'Correcto':failed?'Atención':'Sin datos todavía';
  return heading('SISTEMA','Respaldos','Protección y recuperación de los datos de AMC.')+
   `<section class="panel"><div class="title-row"><h2>Respaldo automático</h2><span class="status">${badge}</span></div>${demo?'<p>Esta instancia es de prueba y no ejecuta el respaldo externo de producción.</p>':`<p>AMC realiza un respaldo externo cifrado automáticamente todos los días a las 03:00 (hora de Argentina).</p><p><strong>Último respaldo correcto:</strong> ${last||'todavía sin registro de monitorización'}</p><p><strong>Estado del último intento:</strong> ${failed?'falló y requiere revisión':backupStatus==='running'?'en ejecución':healthy?'correcto':'sin datos todavía'}</p><p><strong>Retención:</strong> 30 días.</p><p><strong>Destino:</strong> almacenamiento privado externo.</p>`}<p class="muted">No necesitás descargar, subir ni confirmar nada desde esta pantalla. El proceso se ejecuta en el servidor.</p></section><section class="panel"><h2>Monitorización</h2><p><strong>Errores del servidor en los últimos 15 minutos:</strong> ${Number(sys.errors5xx15m||0)}</p><p class="muted">El monitor externo comprueba periódicamente que producción responda, que la base esté disponible y que el respaldo siga saludable.</p></section><section class="panel"><h2>Restauración</h2><p>Una restauración se hace sólo ante una falla o pérdida real de datos y siempre sobre una base vacía o un entorno aislado. AMC no permite restaurar directamente sobre producción desde esta pantalla.</p><p class="muted">Esto evita sobrescribir datos reales por accidente.</p></section><section class="panel"><h2>Archivos</h2><p>Las fotos y PDF nuevos usan el almacenamiento externo configurado para AMC. Los archivos de prueba históricos no necesitan migrarse antes del lanzamiento real.</p></section><a class="inline-action" href="#mas-admin">← Volver a Más</a>`;
 };
 return {more,backups};
}
