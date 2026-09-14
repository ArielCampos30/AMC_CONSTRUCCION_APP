import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');

test('chat flotante conserva ancho útil, cierre exterior y supresión por ruta activa',()=>{
 const maintenance=source('public/admin-maintenance-ui.js');
 const mobile=source('public/mobile-runtime-fixes.js');
 const notices=source('public/notice-ui.js');
 assert.match(maintenance,/compact-composer>textarea/);
 assert.match(maintenance,/getBoundingClientRect\(\)/);
 assert.match(maintenance,/dialog\.close\(\)/);
 assert.doesNotMatch(maintenance,/fetch\(|csrfValue|archive-quote|delete-read-notices|restore-appearance/);
 assert.match(mobile,/matchMedia\('\(max-width:560px\)'\)\.matches/);
 assert.match(mobile,/@media\(max-width:560px\)[\s\S]*amc-keyboard-open/);
 assert.match(notices,/pageChatRoute/);
 assert.match(notices,/amcActiveChatRoute/);
 assert.match(notices,/amc-live-alert/);
});

test('chat flotante de empleado hidrata historial desde runtime dedicado y abre mostrando el final',()=>{
 const maintenance=source('public/admin-maintenance-ui.js');
 const runtime=source('public/app-admin-staff-chat-runtime.js');
 const index=source('public/index.html');
 assert.doesNotMatch(maintenance,/staff-chat\/messages\?employeeId=/);
 assert.doesNotMatch(maintenance,/renderFloatingStaffMessages/);
 assert.match(runtime,/staff-chat\/messages\?employeeId=/);
 assert.match(runtime,/credentials:'same-origin'/);
 assert.match(runtime,/scrollTop=log\.scrollHeight/);
 assert.match(runtime,/empty-conversation/);
 assert.match(runtime,/floating-staff-message/);
 assert.match(index,/admin-maintenance-ui\.js[\s\S]*app-admin-staff-chat-runtime\.js[\s\S]*app-employee-staff-chat-runtime\.js/);
});

test('portada pública expone una sola entrada y gestión comprensible con historial',()=>{
 const ui=source('public/planning-ui.js');
 const appearance=source('appearance.mjs');
 const planning=source('planning.mjs');
 const menu=source('public/admin-system-ui.js');
 const index=source('public/index.html');
 const controller=source('public/app-admin-appearance-controller.js');
 const maintenance=source('public/admin-maintenance-ui.js');
 assert.match(menu,/\['Sitio público',\[\['portada','Portada pública'\]\]\]/);
 assert.match(menu,/const uniqueMoreSections=/);
 assert.match(menu,/if\(routes\.has\(route\)\)return false/);
 assert.doesNotMatch(index,/admin-menu-extras\.js/);
 assert.match(index,/admin-appearance\.css/);
 assert.match(ui,/VISTA PREVIA ACTUAL/);
 assert.match(ui,/Usar como portada/);
 assert.match(ui,/Dejar sólo el logo AMC/);
 assert.match(ui,/Publicar un trabajo realizado/);
 assert.match(ui,/restore-appearance/);
 assert.match(ui,/createAdminAppearanceController/);
 assert.match(controller,/refreshAppearanceLabels/);
 assert.match(controller,/api\('\/api\/appearance\/restore'/);
 assert.doesNotMatch(maintenance,/restore-appearance|refreshAppearanceLabels/);
 assert.match(appearance,/appearanceSnapshot/);
 assert.match(appearance,/api\/appearance\/restore/);
 assert.doesNotMatch(planning,/appearanceSnapshot/);
 assert.doesNotMatch(planning,/api\/appearance\/restore/);
});

test('avisos y presupuestos tienen limpieza y archivado seguro sin recargar la página',()=>{
 const notices=source('notifications.mjs');
 const noticeUI=source('public/notice-ui.js');
 const noticeController=source('public/app-shell-notice-click-controller.js');
 const quoteController=source('public/app-admin-quote-maintenance-controller.js');
 const quotes=source('quote-work-routes.mjs');
 const quoteUI=source('public/admin-quotes-ui.js');
 const shell=source('public/app-shell-click-controller.js');
 const maintenance=source('public/admin-maintenance-ui.js');
 const index=source('public/index.html');
 assert.match(notices,/deleteNotices/);
 assert.match(notices,/deleteScope/);
 assert.match(noticeUI,/delete-all-notices/);
 assert.match(noticeUI,/delete-read-notices/);
 assert.match(noticeController,/deleteScope/);
 assert.match(noticeController,/\{deleteScope:scope\}/);
 assert.match(noticeController,/syncNoticeCount/);
 assert.doesNotMatch(maintenance,/delete-read-notices|delete-all-notices|syncNoticeChrome/);
 assert.match(index,/notice-ui\.css/);
 assert.match(quotes,/\/archive/);
 assert.match(quotes,/\/unarchive/);
 assert.match(quotes,/Archivá primero el presupuesto/);
 assert.match(quoteUI,/Archivados/);
 assert.match(quoteUI,/Eliminar definitivamente/);
 assert.match(quoteController,/archive-quote/);
 assert.match(quoteController,/unarchive-quote/);
 assert.match(quoteController,/delete-quote/);
 assert.match(quoteController,/const detachCard=button=>/);
 assert.match(shell,/createAdminQuoteMaintenanceController/);
 assert.match(shell,/quoteMaintenanceController\.attach\(\)/);
 assert.doesNotMatch(maintenance,/archive-quote|unarchive-quote|delete-quote|location\.reload|function detachNodes|csrfValue|fetch\(/);
});
