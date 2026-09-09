import test from 'node:test';
import assert from 'node:assert/strict';
import {createAccountUI} from '../public/account-ui.js';

const esc=v=>String(v??'');
const heading=(tag,title,body='')=>'<h1>'+tag+'|'+title+'|'+body+'</h1>';
const field=(label,name,type='text',value='',required=true)=>'<label>'+label+'<input name="'+name+'" type="'+type+'" value="'+esc(value)+'" '+(required?'required':'')+'></label>';
const btn=(label,action)=>'<button data-action="'+action+'">'+label+'</button>';

function fixture(){
 let state={},config={},setup=null;
 const team={render:()=>''};
 const ui=createAccountUI({
  getState:()=>state,
  getConfig:()=>config,
  getTwoFactorSetup:()=>setup,
  isAdmin:()=>state.user?.role==='admin',
  team,heading,field,btn,esc
 });
 return {ui,setState:v=>state=v,setConfig:v=>config=v,setSetup:v=>setup=v,team};
}

test('login y registro conservan la validación y el segundo factor del administrador',()=>{
 const x=fixture();
 assert.match(x.ui.auth(),/two-factor-login/);
 assert.match(x.ui.auth(),/Código de seguridad/);
 assert.match(x.ui.auth(true),/Confirmar contraseña/);
 assert.match(x.ui.auth(true),/passwordConfirm/);
});

test('perfil administrador conserva los estados completos de 2FA',()=>{
 const x=fixture();
 x.setState({user:{role:'admin',name:'Admin',email:'admin@amc.local',sound:1},twoFactor:{available:false}});
 assert.match(x.ui.profile(),/falta la llave segura del servidor/);
 x.setState({user:{role:'admin',name:'Admin',email:'admin@amc.local',sound:1},twoFactor:{available:true,enabled:false}});
 assert.match(x.ui.profile(),/twofactor-setup/);
 x.setSetup({uri:'otpauth://amc',secret:'ABC123'});
 assert.match(x.ui.profile(),/twofactor-enable/);
 assert.match(x.ui.profile(),/Clave manual/);
 x.setSetup(null);
 x.setState({user:{role:'admin',name:'Admin',email:'admin@amc.local',sound:1},twoFactor:{available:true,enabled:true}});
 assert.match(x.ui.profile(),/twofactor-disable/);
 assert.match(x.ui.profile(),/Activada/);
});

test('perfil cliente conserva accesos y reseña según obra finalizada',()=>{
 const x=fixture();
 x.setState({user:{role:'client',name:'Cliente',email:'c@amc.local',sound:1},works:[],twoFactor:{}});
 assert.match(x.ui.profile(),/Notificaciones/);
 assert.match(x.ui.profile(),/Cambiar o recuperar contraseña/);
 assert.match(x.ui.profile(),/Ver reseñas/);
 x.setState({user:{role:'client',name:'Cliente',email:'c@amc.local',sound:1},works:[{status:'Finalizado'}],twoFactor:{}});
 assert.match(x.ui.profile(),/Dejar o editar reseña/);
});
