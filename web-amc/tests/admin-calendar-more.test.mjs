import test from 'node:test';
import assert from 'node:assert/strict';
import {createAdminSystemUI} from '../public/admin-system-ui.js';
import {resolveAppPage} from '../public/app-page-router.js';

test('Más del administrador ofrece acceso directo al Calendario existente',()=>{
 const ui=createAdminSystemUI({
  getState:()=>({user:null}),
  getConfig:()=>({}),
  heading:()=>'',
  esc:value=>String(value??''),
  date:value=>String(value??'')
 });
 const html=ui.more();
 assert.match(html,/<a href="#calendario"><span>Calendario<\/span><b>›<\/b><\/a>/);
 assert.ok(html.indexOf('>Empleados<')<html.indexOf('>Calendario<'));
 assert.ok(html.indexOf('>Calendario<')<html.indexOf('>Reseñas<'));
 assert.deepEqual(resolveAppPage('calendario',{user:{role:'admin'}}),{view:'planning',page:'calendario'});
});
