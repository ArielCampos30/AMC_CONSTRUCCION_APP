import {composeApp} from './app-composition.mjs';
import {startServer} from './server-bootstrap.mjs';
import {migrateRegionDatabase} from './region-migration.mjs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT=path.dirname(fileURLToPath(import.meta.url));
export const services=['Albañilería','Revoques','Cerámicos y porcelanato','Pintura','Plomería','Electricidad','Reparaciones'];
export const serviceCatalog={Albañilería:['Revoque fino','Revoque completo','Porcelanato','Cerámicos','Contrapiso','Reparación de grietas'],Pintura:['Interior','Exterior','Aberturas'],Plomería:['Canillas','Inodoro','Termotanque','Pérdidas y cañerías'],Electricidad:['Iluminación','Tomacorrientes','Tablero eléctrico'],Reparaciones:['Humedad','Techos','Arreglos generales']};
export function createApp({dbPath,demo,origin,clock,sendRecovery,twoFactorKey,fileStore}={}){
 return composeApp({services,serviceCatalog,dbPath,demo,origin,clock,sendRecovery,twoFactorKey,fileStore});
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const sourceUrl=process.env.AMC_DATABASE_URL;
 const targetUrl=process.env.AMC_REGION_MIGRATION_TARGET_URL;
 const sourceCaFile=process.env.AMC_DATABASE_CA_FILE;
 const targetCaFile=process.env.AMC_REGION_MIGRATION_TARGET_CA_FILE||sourceCaFile;
 if(process.env.AMC_REGION_MIGRATION_PREPARE==='1'){
  await migrateRegionDatabase({
   sourceUrl,
   targetUrl,
   sourceCaFile,
   targetCaFile,
   logger:value=>console.log(JSON.stringify(value))
  });
 }
 if(process.env.AMC_REGION_TARGET_ACTIVE==='1'){
  if(!targetUrl)throw Error('Falta AMC_REGION_MIGRATION_TARGET_URL para activar la base regional.');
  process.env.AMC_DATABASE_URL=targetUrl;
  if(targetCaFile)process.env.AMC_DATABASE_CA_FILE=targetCaFile;
  console.log(JSON.stringify({event:'region-database-target-active'}));
 }
 startServer({createApp,root:ROOT});
}