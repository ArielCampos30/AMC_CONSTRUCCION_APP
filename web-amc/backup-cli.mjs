import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createApp} from './server.mjs';
import {exportBackup,verifyBackup,restoreBackup} from './secure-backup.mjs';
const [mode,file,target]=process.argv.slice(2);let app;
try{
 if(!['export','verify','restore'].includes(mode)||!file)throw Error('Uso: node backup-cli.mjs export|verify|restore archivo.amcbak [base-nueva.sqlite]');
 const password=process.env.AMC_BACKUP_PASSWORD;
 if(mode==='verify')console.log('Respaldo verificado:',verifyBackup(file,password).records,'registros.');
 else{
  if(mode==='restore'){
   if(process.env.AMC_RESTORE_DATABASE_URL){process.env.AMC_DATABASE_URL=process.env.AMC_RESTORE_DATABASE_URL;}
   else{if(!target||existsSync(target))throw Error('Indicá una base local nueva, o AMC_RESTORE_DATABASE_URL apuntando a una base vacía.');delete process.env.AMC_DATABASE_URL;}
   // Restores never bootstrap an administrator from the host environment.
   delete process.env.AMC_ADMIN_EMAIL;delete process.env.AMC_ADMIN_PASSWORD;
  }
  const localSource=process.env.AMC_DB_PATH||fileURLToPath(new URL('./data/amc.sqlite',import.meta.url));if(mode==='export'&&!process.env.AMC_DATABASE_URL&&!existsSync(localSource))throw Error('No se encontró la base de origen. No se creó ningún respaldo.');app=createApp({dbPath:mode==='restore'?target||':memory:':localSource});
  const result=mode==='export'?exportBackup(app.db,file,password):restoreBackup(app.db,file,password);
  console.log(mode==='export'?'Respaldo cifrado creado. Guardalo fuera del servidor.':'Restauración completa. Las cuentas deben volver a iniciar sesión y habilitar avisos.',result.records,'registros.');
 }
}catch(e){console.error(e.message);process.exitCode=1;}finally{if(app)app.server.close();}
