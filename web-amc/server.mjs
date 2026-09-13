import {staticResponse} from './static-response.mjs';
import {staticFileRoutes} from './static-file-routes.mjs';
import {createRequestRuntime} from './request-runtime.mjs';
import {createResourceViews} from './resource-views.mjs';
import {createInputValues} from './input-values.mjs';
import {now,id,sha,fail} from './server-primitives.mjs';
import {createBackgroundRuntime} from './background-runtime.mjs';
import {createHttpServer} from './http-server.mjs';
import {applyHttpSecurity} from './http-security.mjs';
import {planningFeatures} from './planning.mjs';
import {recoveryFeatures} from './recovery.mjs';
import {closureFeatures} from './closure.mjs';
import {fieldworkFeatures} from './fieldwork.mjs';
import {quoteLifecycle} from './quote-lifecycle.mjs';
import {quoteWorkRoutes} from './quote-work-routes.mjs';
import {stateRoutes} from './state-routes.mjs';
import {communityRoutes} from './community-routes.mjs';
import {adminUtilityRoutes} from './admin-utility-routes.mjs';
import {profileRoutes} from './profile-routes.mjs';
import {mediaUploadRoutes} from './media-upload-routes.mjs';
import {deviceRoutes} from './device-routes.mjs';
import {publicSystemRoutes} from './public-system-routes.mjs';
import {estimatorPageRoutes} from './estimator-page-routes.mjs';
import {twoFactorFeatures} from './twofactor.mjs';
import {authRoutes} from './auth-routes.mjs';
import {createAuthCore} from './auth-core.mjs';
import {chatFeatures} from './chat-core.mjs';
import {clientRequestFeatures} from './client-requests.mjs';
import {notificationFeatures} from './notifications.mjs';
import {mediaStorageFeatures} from './media-storage.mjs';
import {mediaAccessFeatures} from './media-access.mjs';
import {createMediaUploadParser} from './media-upload-parser.mjs';
import {createSupabaseFileStore} from './storage-supabase.mjs';
import {createSystemHealth} from './system-health.mjs';
import {createDatabaseCore} from './database-core.mjs';
import {teamFeatures} from './team.mjs';
import {featureRoutes} from './features.mjs';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {pushKeys,deliver,validSubscription} from './push.mjs';
const ROOT=path.dirname(fileURLToPath(import.meta.url));
export const services=['Albañilería','Revoques','Cerámicos y porcelanato','Pintura','Plomería','Electricidad','Reparaciones'];
export const serviceCatalog={Albañilería:['Revoque fino','Revoque completo','Porcelanato','Cerámicos','Contrapiso','Reparación de grietas'],Pintura:['Interior','Exterior','Aberturas'],Plomería:['Canillas','Inodoro','Termotanque','Pérdidas y cañerías'],Electricidad:['Iluminación','Tomacorrientes','Tablero eléctrico'],Reparaciones:['Humedad','Techos','Arreglos generales']};
const {text,amount,optionalAmount,validDate}=createInputValues({fail});
export function createApp({dbPath=path.join(ROOT,'data/amc.sqlite'),demo=false,origin='http://localhost:4180',clock=Date.now,sendRecovery,twoFactorKey=process.env.AMC_2FA_KEY,fileStore}={}){
 const version=(process.env.RENDER_GIT_COMMIT||process.env.GITHUB_SHA||process.env.AMC_VERSION||'dev').slice(0,7),startedAt=Date.now();
 const recentServerErrors=[];const recentErrorCount=()=>{const cutoff=Date.now()-15*60*1000;while(recentServerErrors.length&&recentServerErrors[0]<cutoff)recentServerErrors.shift();return recentServerErrors.length;};
 const {db,remoteUrl,all,allEntries,activeUsers,docPosition,get,put,transaction,beginStateSnapshot,endStateSnapshot}=createDatabaseCore({dbPath,id,sha,now,fail});
 const objectStore=fileStore||createSupabaseFileStore();
 const {backupHealth,systemStatus}=createSystemHealth({db,version,remoteUrl,objectStore,recentErrorCount,startedAt});
 const {userView,passwordHash,addUser,own,requireAdmin,canAccessRequest,canAccessQuote,canAccessWork,requireResource,createAdminVerifier}=createAuthCore({db,all,id,fail});
 const {publicWork,publicQuote,employeeWork}=createResourceViews();
 const keys=pushKeys(db);
 if(demo&&!db.prepare("SELECT id FROM users WHERE email='admin@amc.test'").get()){
  addUser('admin@amc.test','AMC-Prueba-2026!','Ariel · AMC','admin');addUser('cliente@amc.test','Cliente-Prueba-2026!','Cliente de prueba');
  put('post','',{id:id(),title:'Inspiración para tu próximo proyecto',service:'Reparaciones',town:'Imagen ilustrativa',date:now(),description:'Publicación de ejemplo. Desde el panel podés subir tus propios trabajos.',image:'/assets/living.jpg',before:null,demo:true});
 }
 if(process.env.AMC_ADMIN_EMAIL&&process.env.AMC_ADMIN_PASSWORD&&!db.prepare("SELECT id FROM users WHERE role='admin'").get())addUser(process.env.AMC_ADMIN_EMAIL.toLowerCase(),process.env.AMC_ADMIN_PASSWORD,'AMC','admin');
 const {send,readRaw,readBody,rate,checkRate}=createRequestRuntime({fail});
 const background=createBackgroundRuntime({db,keys,deliver,text});
 const {flushPush}=background;
 const notifications=notificationFeatures({db,all,put,origin,now,id,schedulePush:()=>queueMicrotask(()=>flushPush()),send,requireAdmin,text,fail});
 const {notify,notifyAdmins,markNoticeRead,markNoticesForRoute,route:notificationRoutes}=notifications;
 const readMultipart=createMediaUploadParser({readRaw,text,fail});
 const verifyAdmin=createAdminVerifier(checkRate);
 const mediaStorage=mediaStorageFeatures({db,all,put,transaction,objectStore,text,fail,id,now});
 const {safeFile,cleanupOrphanFiles}=mediaStorage;
 const planning=planningFeatures({db,all,get,put,transaction,requireAdmin,safeFile,notify,notifyAdmins,send,fail,text,validDate,now,id,sha});
 const lifecycle=quoteLifecycle({all,put,transaction,notify,notifyAdmins,clock});
 const twoFactor=twoFactorFeatures({db,all,put,transaction,requireAdmin,verifyAdmin,send,fail,now,keyValue:twoFactorKey});
 const authentication=authRoutes({db,addUser,userView,passwordHash,twoFactor,checkRate,rate,text,sha,send,fail,origin,readBody});
 const recovery=recoveryFeatures({db,all,put,transaction,requireAdmin,verifyAdmin,notifyAdmins,send,fail,text,sha,passwordHash,origin,clock,sendRecovery});
 const closure=closureFeatures({db,all,get,put,transaction,requireAdmin,safeFile,notify,notifyAdmins,send,fail,text,now,id,sha});
 const fieldwork=fieldworkFeatures({all,get,put,transaction,requireAdmin,safeFile,notify,notifyAdmins,send,fail,text,validDate,now,id,sha});
 const team=teamFeatures({db,all,get,put,transaction,requireAdmin,safeFile,notify,notifyAdmins,send,fail,text,amount,validDate,now,id,sha,addUser,passwordHash,planning});
 const chat=chatFeatures({db,all,allEntries,activeUsers,docPosition,get,put,own,safeFile,notify,notifyAdmins,send,fail,text,now,sha,markNoticesForRoute});
 const {clientChatIds,chatOwn,chatSummary,staffMessages,staffUnread,staffReadByEmployee,staffReadByAdmin}=chat;
 const mediaAccess=mediaAccessFeatures({db,all,objectStore,planning,team,fieldwork,closure,staffMessages,canAccessRequest,canAccessWork,clientChatIds,fail});
 const {canAccessPrivateFile}=mediaAccess;
 const clientRequests=clientRequestFeatures({db,all,get,put,transaction,requireAdmin,safeFile,notify,notifyAdmins,send,fail,text,validDate,now,id,services,serviceCatalog,planning});
 const handleQuoteWork=quoteWorkRoutes({db,all,get,put,transaction,own,requireAdmin,safeFile,notify,notifyAdmins,send,fail,text,amount,optionalAmount,validDate,now,id,sha,lifecycle});
 const handleFeature=featureRoutes({db,all,get,put,transaction,own,chatOwn,requireAdmin,safeFile,notify,notifyAdmins,send,fail,text,amount,validDate,now,id,sha,planning,markNoticesForRoute});
 const handleState=stateRoutes({all,activeUsers,userView,chatSummary,planning,services,serviceCatalog,team,fieldwork,recovery,closure,staffMessages,staffUnread,staffReadByAdmin,staffReadByEmployee,canAccessWork,employeeWork,clientChatIds,publicQuote,publicWork,systemStatus,twoFactor,beginStateSnapshot,endStateSnapshot,send});
 const handleCommunity=communityRoutes({db,all,get,put,requireAdmin,safeFile,notifyAdmins,send,fail,text,services,now,id});
 const handleAdminUtility=adminUtilityRoutes({all,get,put,requireAdmin,safeFile,send,fail,text,sha,now});
 const handleProfile=profileRoutes({db,put,send,fail,text});
 const handleMediaUpload=mediaUploadRoutes({mediaStorage,send});
 const handleDevices=deviceRoutes({db,transaction,sha,fail,validSubscription,send});
 const handlePublicSystem=publicSystemRoutes({db,remoteUrl,version,recentErrorCount,backupHealth,startedAt,demo,keys,services,send});
 const handleEstimatorPage=estimatorPageRoutes({ROOT,all,requireAdmin,readFileSync,path});
 const staticFiles=staticFileRoutes({ROOT,path,readFileSync,staticResponse,send,fail});
 async function handle(req,res){
  const url=new URL(req.url,origin),p=url.pathname,method=req.method;
  applyHttpSecurity({res,origin,pathname:p});
  if(staticFiles.serveEarly({req,res,p,method}))return;
  const {session,user}=authentication.resolve(req);
  try{
   if(!['GET','HEAD'].includes(method)){if(req.headers.origin!==origin)fail(403,'Origen no permitido.');if(!['/api/login','/api/register','/api/forgot-password','/api/reset-password'].includes(p)&&(!session||req.headers['x-csrf-token']!==session.csrf))fail(403,'Sesión vencida. Volvé a ingresar.');}
   if(['/api/forgot-password','/api/reset-password'].includes(p)){if(method!=='POST')fail(405,'Método no permitido.');checkRate(req.socket.remoteAddress+':recovery',8);const b=await readBody(req);if(await recovery.route({p,method,b,user,res}))return;}
   if(handlePublicSystem({p,method,res}))return;
   if(await authentication.handlePublic({p,method,req,res}))return;
   if(handleState({p,method,user,session,res}))return;
   if(await mediaAccess.serve({user,p,method,req,res}))return;
   if(p.startsWith('/api/')){
    if(!user)fail(401,'Ingresá a tu cuenta para continuar.');checkRate(user.id+':api',400);if(p.startsWith('/api/admin/2fa/')){const twoFactorBody=method==='GET'?{}:await readBody(req);if(await twoFactor.route({p,method,b:twoFactorBody,user,res,session}))return;}if(chat.routeBeforeBody({p,method,user,url,res}))return;const b=p==='/api/upload'&&String(req.headers['content-type']||'').startsWith('multipart/form-data')?await readMultipart(req):await readBody(req);
    if(chat.routeAfterBody({p,method,b,user,url,res}))return;
    if(user.role==='employee'&&/^\/api\/requests\/[^/]+\/messages(?:\/read)?$/.test(p))fail(404,'Conversación no encontrada.');
    if(user.role==='employee'&&!['/api/logout','/api/profile','/api/upload','/api/devices','/api/notices/read','/api/notices/test'].includes(p)&&!/^\/api\/assignments\/[^/]+\/(report|visit-sheet|materials)$/.test(p))fail(403,'Tu acceso está limitado a tus asignaciones.');
    if(method==='POST'&&(p==='/api/assignments'||/^\/api\/assignments\/[^/]+\/edit$/.test(p)))planning.validateTime(b.day,b.time);
    if(method==='POST'&&/^\/api\/requests\/[^/]+\/appointment$/.test(p))planning.validateTime(b.day,b.time,Number(b.duration));
    if(handleAdminUtility({p,method,b,user,res}))return;
    if(await planning.route({p,method,b,user,res}))return;
    if(await recovery.route({p,method,b,user,res}))return;
    if(await closure.route({p,method,b,user,res}))return;
    if(await fieldwork.route({p,method,b,user,res}))return;
    if(await team.route({p,method,b,user,res}))return;
    if(await handleFeature({p,method,b,user,res}))return;
    if(await clientRequests.route({p,method,b,user,res}))return;
    if(authentication.logout({p,method,user,session,b,res}))return;
    if(handleProfile({p,method,b,user,res}))return;
    if(await handleMediaUpload({p,method,b,user,res}))return;
    if(await handleQuoteWork({p,method,b,user,res}))return;
    if(handleCommunity({p,method,b,user,res}))return;
    if(notificationRoutes({p,method,b,user,res}))return;
    if(handleDevices({p,method,b,user,res}))return;
    fail(404,'Acción no encontrada.');
   }
   staticFiles.requirePageMethod(method);
   if(handleEstimatorPage({p,method,user,session,res}))return;
   staticFiles.serveFallback({res,p,method});
  }catch(e){if((!e.status||e.status>=500)&&process.env.NODE_ENV!=='test')console.error(JSON.stringify({level:'error',requestId:req.amcRequestId||'',method:req.method,path:p,status:e.status||500,error:e.code||e.name||'Error'}));else if(process.env.NODE_ENV==='test'&&!e.status)console.error(e);if(!res.headersSent)send(res,e.status||500,{error:e.status?e.message:'Ocurrió un error. Intentá nuevamente.',...(e.requiresTwoFactor?{requiresTwoFactor:true}:{})});else res.end();}
 }
 const server=createHttpServer({handle,send,recentServerErrors,recentErrorCount});background.attach({server,lifecycle,cleanupOrphanFiles});return {server,db,addUser,flushPush,processQuotes:lifecycle.run,cleanupOrphanFiles};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const demo=process.argv.includes('--demo'),port=Number(process.env.PORT||4180),origin=process.env.AMC_ORIGIN||process.env.RENDER_EXTERNAL_URL||`http://localhost:${port}`;
 if(!demo&&(!origin.startsWith('https:'))){console.error('Producción requiere AMC_ORIGIN=https://tu-dominio. Para prueba local usá node server.mjs --demo.');process.exit(1);}
 if(process.env.RENDER&&!process.env.AMC_DATABASE_URL&&!demo){console.error('Render producción requiere AMC_DATABASE_URL: no se permite guardar en disco temporal.');process.exit(1);}
 const app=createApp({demo,origin,dbPath:process.env.AMC_DB_PATH||path.join(ROOT,'data',demo?'demo.sqlite':'amc.sqlite')});app.server.listen(port,demo&&!process.env.RENDER?'127.0.0.1':'0.0.0.0',()=>console.log('AMC conectado: '+origin+(demo?' · entorno de prueba, cuentas de ejemplo':' ')));
}
