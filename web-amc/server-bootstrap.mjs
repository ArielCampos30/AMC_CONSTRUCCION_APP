import path from 'node:path';
import {createSupabaseFileStore} from './storage-supabase.mjs';
import {migrateHistoricalFiles} from './file-storage-migration.mjs';

const HTTPS_ERROR='Producción requiere AMC_ORIGIN=https://tu-dominio. Para prueba local usá node server.mjs --demo.';
const RENDER_DB_ERROR='Render producción requiere AMC_DATABASE_URL: no se permite guardar en disco temporal.';

export function resolveServerRuntime({argv=process.argv,env=process.env,root}={}){
 const demo=argv.includes('--demo');
 const port=Number(env.PORT||4180);
 const origin=env.AMC_ORIGIN||env.RENDER_EXTERNAL_URL||`http://localhost:${port}`;
 const dbPath=env.AMC_DB_PATH||path.join(root,'data',demo?'demo.sqlite':'amc.sqlite');
 const host=demo&&!env.RENDER?'127.0.0.1':'0.0.0.0';
 return {demo,port,origin,dbPath,host};
}

export function validateServerRuntime(runtime,{env=process.env}={}){
 if(!runtime.demo&&!runtime.origin.startsWith('https:'))return HTTPS_ERROR;
 if(env.RENDER&&!env.AMC_DATABASE_URL&&!runtime.demo)return RENDER_DB_ERROR;
 return null;
}

export function scheduleFileStorageMigration({env=process.env,db,consoleRef=console,queue=queueMicrotask,fileStoreFactory=createSupabaseFileStore,migrate=migrateHistoricalFiles}={}){
 if(String(env.AMC_FILE_STORAGE_MIGRATE_ON_START||'')!=='1')return false;
 queue(async()=>{
  try{
   const objectStore=fileStoreFactory({env});
   consoleRef.info(JSON.stringify({level:'info',event:'file-storage-migration-start',mode:objectStore.mode}));
   const result=await migrate({db,objectStore});
   consoleRef.info(JSON.stringify({level:'info',event:'file-storage-migration-complete',...result}));
  }catch(error){
   consoleRef.error(JSON.stringify({level:'error',event:'file-storage-migration-failed',error:error?.code||error?.name||'Error',message:String(error?.message||'No se pudo completar la migración de archivos.').slice(0,240)}));
  }
 });
 return true;
}

export function startServer({createApp,root,argv=process.argv,env=process.env,processRef=process,consoleRef=console}={}){
 const runtime=resolveServerRuntime({argv,env,root});
 const problem=validateServerRuntime(runtime,{env});
 if(problem){consoleRef.error(problem);processRef.exit(1);return null;}
 const app=createApp({demo:runtime.demo,origin:runtime.origin,dbPath:runtime.dbPath});
 app.server.listen(runtime.port,runtime.host,()=>{
  consoleRef.log('AMC conectado: '+runtime.origin+(runtime.demo?' · entorno de prueba, cuentas de ejemplo':' '));
  scheduleFileStorageMigration({env,db:app.db,consoleRef});
 });
 return app;
}
