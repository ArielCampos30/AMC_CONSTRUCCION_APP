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
 if(process.env.AMC_REGION_MIGRATION_PREPARE==='1'){
  await migrateRegionDatabase({
   sourceUrl:process.env.AMC_DATABASE_URL,
   targetUrl:process.env.AMC_REGION_MIGRATION_TARGET_URL,
   sourceCaFile:process.env.AMC_DATABASE_CA_FILE,
   targetCaFile:process.env.AMC_REGION_MIGRATION_TARGET_CA_FILE||process.env.AMC_DATABASE_CA_FILE,
   logger:value=>console.log(JSON.stringify(value))
  });
 }
 startServer({createApp,root:ROOT});
}
