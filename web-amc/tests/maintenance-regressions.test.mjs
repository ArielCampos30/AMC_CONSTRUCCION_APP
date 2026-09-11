import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');

test('chat flotante conserva ancho útil, cierre exterior y supresión por ruta activa',()=>{
 const maintenance=source('public/admin-maintenance-ui.js');
 const notices=source('public/notice-ui.js');
 assert.match(maintenance,/compact-composer>textarea/);
 assert.match(maintenance,/getBoundingClientRect\(\)/);
 assert.match(maintenance,/dialog\.close\(\)/);
 assert.match(notices,/pageChatRoute/);
 assert.match(notices,/amcActiveChatRoute/);
 assert.match(notices,/amc-live-alert/);
});

test('portada pública expone gestión comprensible e historial restaurable',()=>{
 const ui=source('public/planning-ui.js');
 const routes=source('planning.mjs');
 const menu=source('public/admin-system-ui.js');
 assert.match(menu,/Portada pública/);
 assert.match(ui,/VISTA PREVIA ACTUAL/);
 assert.match(ui,/Usar como portada/);
 assert.match(ui,/Dejar sólo el logo AMC/);
 assert.match(ui,/Publicar un trabajo realizado/);
 assert.match(ui,/restore-appearance/);
 assert.match(routes,/appearanceSnapshot/);
 assert.match(routes,/api\/appearance\/restore/);
});

test('avisos y presupuestos tienen limpieza y archivado seguro',()=>{
 const notices=source('notifications.mjs');
 const noticeUI=source('public/notice-ui.js');
 const quotes=source('quote-work-routes.mjs');
 const quoteUI=source('public/admin-quotes-ui.js');
 assert.match(notices,/deleteNotices/);
 assert.match(notices,/deleteScope/);
 assert.match(noticeUI,/delete-all-notices/);
 assert.match(noticeUI,/delete-read-notices/);
 assert.match(quotes,/\/archive/);
 assert.match(quotes,/\/unarchive/);
 assert.match(quotes,/Archivá primero el presupuesto/);
 assert.match(quoteUI,/Archivados/);
 assert.match(quoteUI,/Eliminar definitivamente/);
});
