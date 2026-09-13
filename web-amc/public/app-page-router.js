const LEGACY_ADMIN_ROUTES=new Set(['admin']);
const PROTECTED_PAGES=new Set(['clientes','calendario','portada','pedir','visita','perfil','presupuestos','obra','avisos','favoritos','referidos','admin','mensajes','agenda','adicionales','comprobantes','cotizador','empleados','tareas','compras','estado-presupuestos','fichas','materiales','resumen','resumen-diario','cierre','recuperar-cuentas','inicio-empleado','mis-trabajos','chat-equipo','mis-trabajos-cliente','chat-cliente','solicitar']);
const EMPLOYEE_PAGES=new Set(['perfil','avisos','mensajes','inicio-empleado','mis-trabajos','chat-equipo']);
const TEAM_PAGES=new Set(['empleados','tareas','compras','estado-presupuestos']);
const FEATURE_PAGES=new Set(['mensajes','agenda','adicionales','comprobantes','cotizador']);

export function pageFromHash(hash='',recovery=''){
 return recovery||String(hash||'').replace(/^#/,'')||'inicio';
}

export function normalizeInitialPage(page){
 return LEGACY_ADMIN_ROUTES.has(page)?'inicio':page;
}

export function normalizePageForRole(page,role){
 return role==='admin'&&LEGACY_ADMIN_ROUTES.has(page)?'inicio':page;
}

export function resolveAppPage(page,state={}){
 const role=state.user?.role;
 if(role==='client'&&page==='inicio')return {view:'client-home'};
 if(role==='client'&&(page==='obra'||page==='mis-trabajos-cliente'))return {view:'client-works'};
 if(role==='client'&&page.startsWith('mi-trabajo/'))return {view:'client-work-detail',id:page.slice(11)};
 if(role==='client'&&page.startsWith('solicitud/'))return {view:'client-work-detail',id:page.slice('solicitud/'.length)};
 if(role==='client'&&page.startsWith('presupuesto/')){const id=page.slice(12),quote=state.quotes.find(item=>item.id===id);return {view:'client-quote',id,quoteFound:!!quote,requestId:quote?.requestId};}
 if(role==='client'&&page.startsWith('obra/')){const id=page.slice(5),work=state.works.find(item=>item.id===id);return {view:'client-work',id,workFound:!!work,requestId:work?.requestId};}
 if(role==='client'&&page.startsWith('chat/')){const id=page.slice(5),request=state.requests.find(item=>item.id===id);return {view:'messages',selectChat:!!request,chatRequestId:request?.id||''};}
 if(role==='client'&&page==='chat-cliente')return {view:'messages'};
 if(role==='client'&&page==='solicitar')return {view:'request-form',visit:false};

 if(role==='admin'&&page==='inicio')return {view:'admin-dashboard'};
 if(role==='admin'&&page==='solicitudes')return {view:'admin-requests'};
 if(role==='admin'&&page==='presupuestos')return {view:'admin-quotes'};
 if(role==='admin'&&page.startsWith('presupuesto-admin/'))return {view:'admin-quote-detail',id:page.slice('presupuesto-admin/'.length)};
 if(role==='admin'&&page==='obras')return {view:'admin-works'};
 if(role==='admin'&&page.startsWith('obra-admin/'))return {view:'admin-work-detail',id:page.slice('obra-admin/'.length)};
 if(role==='admin'&&page==='chat-admin')return {view:'admin-chat'};
 if(role==='admin'&&page.startsWith('chat-admin/'))return {view:'messages',selectChat:true,chatRequestId:page.slice('chat-admin/'.length)};
 if(role==='admin'&&page.startsWith('chat-equipo/'))return {view:'admin-team-chat',employeeId:page.slice('chat-equipo/'.length)};
 if(role==='admin'&&page==='mas-admin')return {view:'admin-more'};
 if(role==='admin'&&page==='respaldos')return {view:'admin-backups'};
 if(role==='admin'&&page.startsWith('cliente/'))return {view:'admin-client-detail',id:page.slice('cliente/'.length)};
 if(page==='clientes')return {view:role==='admin'?'client-directory':'auth'};
 if(role==='admin'&&page==='resumen')return {view:'hub-dashboard'};

 if(page.startsWith('solicitud/'))return {view:state.user?'request-detail':'auth',id:page.slice('solicitud/'.length)};
 if(page.startsWith('trabajo/')&&role==='employee')return {view:'employee-work-detail',id:page.slice(8)};
 if(role==='employee'&&['inicio-empleado','mis-trabajos','chat-equipo'].includes(page))return {view:'team',page};
 if(!state.user&&PROTECTED_PAGES.has(page))return {view:'auth'};
 if(page==='calendario'||page==='portada')return {view:'planning',page};
 if(['recuperar','restablecer','recuperar-cuentas','cierre'].includes(page))return {view:'accounts',page};
 if(page==='resumen-diario')return {view:'fieldwork',page:'resumen'};
 if(page==='fichas'||page==='materiales')return {view:'fieldwork',page};
 if(role==='employee'&&!EMPLOYEE_PAGES.has(page))return ['inicio','tareas','estado-presupuestos'].includes(page)?{view:'team',page:page==='estado-presupuestos'?page:'tareas'}:{view:'employee-restricted'};
 if(TEAM_PAGES.has(page))return {view:'team',page};
 if(FEATURE_PAGES.has(page))return {view:'features',page};

 const exact={ingresar:{view:'auth'},registro:{view:'auth-register'},pedir:{view:'request-form',visit:false},visita:{view:'request-form',visit:true},perfil:{view:'profile'},presupuestos:{view:'quotes'},obra:{view:'works'},avisos:{view:'notices'},favoritos:{view:'favorites'},referidos:{view:'referrals'},resenas:{view:'reviews'},admin:{view:'legacy-admin'},servicios:{view:'services'},ideas:{view:'ideas'}};
 return exact[page]||{view:'home'};
}
