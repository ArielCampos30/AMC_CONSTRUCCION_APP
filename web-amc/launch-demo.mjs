import {createApp} from './server.mjs';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
if(Number(process.versions.node.split('.')[0])<24){console.error('AMC necesita Node.js 24 o posterior.');process.exit(1);}
const origin='http://localhost:4180';
function open(){
 console.log('Abrir AMC: '+origin);
 if(process.platform!=='win32')return;
 const chrome=[process.env.ProgramFiles,process.env['ProgramFiles(x86)'],process.env.LOCALAPPDATA].filter(Boolean).map(p=>p+'/Google/Chrome/Application/chrome.exe').find(existsSync);
 const child=chrome?spawn(chrome,[origin],{detached:true,stdio:'ignore',windowsHide:true}):spawn('rundll32.exe',['url.dll,FileProtocolHandler',origin],{detached:true,stdio:'ignore',windowsHide:true});child.on('error',()=>{});child.unref();
}
const app=createApp({demo:true,origin,dbPath:fileURLToPath(new URL('./data/demo.sqlite',import.meta.url))});
app.server.on('error',async e=>{
 if(e.code==='EADDRINUSE'){
  try{const r=await fetch(origin+'/api/config',{signal:AbortSignal.timeout(2000)}),config=await r.json();if(config.demo===true&&config.webPushKey&&Array.isArray(config.services)){console.log('AMC ya está abierto en este equipo.');open();process.exit(0);}}catch{}
  console.error('El puerto 4180 está ocupado. Cerrá la otra prueba antes de iniciar esta copia.');
 }else console.error('No se pudo iniciar AMC: '+e.message);
 process.exit(1);
});
app.server.listen(4180,'127.0.0.1',()=>{console.log('AMC · prueba local. Mantené esta ventana abierta mientras usás la aplicación.');open();});
