import {migrateRegionDatabase} from './region-migration.mjs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const required=(name,value)=>{
 if(!value)throw Error('Falta '+name+'.');
 return value;
};

export async function runRegionMigration({env=process.env,logger=value=>console.log(JSON.stringify(value))}={}){
 if(env.AMC_REGION_MIGRATION_CONFIRM!=='MIGRATE')throw Error('La migración regional requiere AMC_REGION_MIGRATION_CONFIRM=MIGRATE.');
 const sourceUrl=required('AMC_REGION_MIGRATION_SOURCE_URL',env.AMC_REGION_MIGRATION_SOURCE_URL);
 const targetUrl=required('AMC_REGION_MIGRATION_TARGET_URL',env.AMC_REGION_MIGRATION_TARGET_URL);
 if(sourceUrl===targetUrl)throw Error('Origen y destino de la migración regional no pueden ser iguales.');
 const sourceCaFile=env.AMC_REGION_MIGRATION_SOURCE_CA_FILE||env.AMC_DATABASE_CA_FILE;
 const targetCaFile=env.AMC_REGION_MIGRATION_TARGET_CA_FILE||sourceCaFile;
 return migrateRegionDatabase({sourceUrl,targetUrl,sourceCaFile,targetCaFile,logger});
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 runRegionMigration().catch(error=>{
  console.error(error?.message||'Falló la migración regional.');
  process.exitCode=1;
 });
}
