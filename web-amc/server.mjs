import {composeApp} from './app-composition.mjs';
import {startServer} from './server-bootstrap.mjs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT=path.dirname(fileURLToPath(import.meta.url));
export const services=['Albañilería','Revoques','Cerámicos y porcelanato','Pintura','Plomería','Electricidad','Reparaciones'];
export const serviceCatalog={Albañilería:['Revoque fino','Revoque completo','Porcelanato','Cerámicos','Contrapiso','Reparación de grietas'],Pintura:['Interior','Exterior','Aberturas'],Plomería:['Canillas','Inodoro','Termotanque','Pérdidas y cañerías'],Electricidad:['Iluminación','Tomacorrientes','Tablero eléctrico'],Reparaciones:['Humedad','Techos','Arreglos generales']};
export function createApp({dbPath,demo,origin,clock,sendRecovery,twoFactorKey,fileStore}={}){
 return composeApp({services,serviceCatalog,dbPath,demo,origin,clock,sendRecovery,twoFactorKey,fileStore});
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))startServer({createApp,root:ROOT});
