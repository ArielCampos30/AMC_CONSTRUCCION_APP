import {staticResponse} from './static-response.mjs';
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
import http from 'node:http';
import {teamFeatures} from './team.mjs';
import {featureRoutes} from './features.mjs';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {pushKeys,deliver,validSubscription} from './push.mjs';
const ROOT=path.dirname(fileURLToPath(import.meta.url));
export const services=['Albañilería','Revoques','Cerámicos y porcelanato','Pintura','Plomería','Electricidad','Reparaciones'];
export const serviceCatalog={Albañilería:['Revoque fino','Revoque completo','Porcelanato','Cerámicos','Contrapiso','Reparación de grietas'],Pintura:['Interior','Exterior','Aberturas'],Plomería:['Canillas','Inodoro','Termotanque','Pérdidas y cañerías'],Electricidad:['Iluminación','Tomacorrientes','Tablero eléctrico'],Reparaciones:['Humedad','Techos','Arreglos generales']};
const now=()=>new Date().toISOString(),id=()=>randomUUID(),sha=v=>createHash('sha256').update(v).digest('hex');
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const text=(v,max=200)=>typeof v==='string'?v.trim().slice(0,max):'';
const amount=v=>{if(!Number.isFinite(Number(v))||Number(v)<=0||Number(v)>1e10)fail(400,'Importe inválido.');return Math.round(Number(v)*100)/100;};
const optionalAmount=v=>{if(!Number.isFinite(Number(v||0))||Number(v||0)<0||Number(v||0)>1e10)fail(400,'Importe inválido.');return Math.round(Number(v||0)*100)/100;};
const validDate=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'')&&!isNaN(Date.parse(v+'T12:00:00Z'))&&new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v;
export function createApp({dbPath=path.join(ROOT,'data/amc.sqlite'),demo=false,origin='http://localhost:4180',clock=Date.now,sendRecovery,twoFactorKey=process.env.AMC_2FA_KEY,fileStore}={}){
 const version=(process.env.RENDER_GIT_COMMIT||process.env.GITHUB_SHA||process.env.AMC_VERSION||'dev').slice(0,7),startedAt=Date.now();
 const recentServerErrors=[];const recentErrorCount=()=>{const cutoff=Date.now()-15*60*1000;while(recentServerErrors.length&&recentServerErrors[0]<cutoff)recentServerErrors.shift();return recentServerErrors.length;};
 const {db,remoteUrl,all,get,put,transaction,beginStateSnapshot,endStateSnapshot}=createDatabaseCore({dbPath,id,sha,now,fail});
 const objectStore=fileStore||createSupabaseFileStore();
 const {backupHealth,systemStatus}=createSystemHealth({db,version,remoteUrl,objectStore,recentErrorCount,startedAt});
 const {userView,passwordHash,addUser,own,requireAdmin,canAccessRequest,canAccessQuote,canAccessWork,requireResource,createAdminVerifier}=createAuthCore({db,all,id,fail});
 const publicWork=w=>{const {internalNotes,cost,internalCost,grossMargin,margin,journal,mobility,tools,contingency,calculations,estimatedTeam,personnelCost,actualPersonnelCost,actualOtherCosts,finalCost,realProfit,...safe}=w;return safe;};
 const publicQuote=q=>{const {cost,internalCost,grossMargin,margin,journal,mobility,tools,contingency,calculations,internalNotes,estimatedTeam,personnelCost,...safe}=q;return safe;};
 const employeeWork=w=>{const safe=publicWork(w);delete safe.budget;delete safe.payments;delete safe.baseBudget;delete safe.userId;return safe;};
 const keys=pushKeys(db);
 if(demo&&!db.prepare("SELECT id FROM users WHERE email='admin@amc.test'").get()){
  addUser('admin@amc.test','AMC-Prueba-2026!','Ariel · AMC','admin');addUser('cliente@amc.test','Cliente-Prueba-2026!','Cliente de prueba');
  put('post','',{id:id(),title:'Inspiración para tu próximo proyecto',service:'Reparaciones',town:'Imagen ilustrativa',date:now(),description:'Publicación de ejemplo. Desde el panel podés subir tus propios trabajos.',image:'/assets/living.jpg',before:null,demo:true});
 }
 if(process.env.AMC_ADMIN_EMAIL&&process.env.AMC_ADMIN_PASSWORD&&!db.prepare("SELECT id FROM users WHERE role='admin'").get())addUser(process.env.AMC_ADMIN_EMAIL.toLowerCase(),process.env.AMC_ADMIN_PASSWORD,'AMC','admin');
 const send=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
 const notifications=notificationFeatures({db,all,put,origin,now,id,schedulePush:()=>queueMicrotask(()=>flushPush()),send,requireAdmin,text,fail});
 const {notify,notifyAdmins,markNoticeRead,markNoticesForRoute,route:notificationRoutes}=notifications;
 const readRaw=async(req,limit=7*1024*1024)=>{let chunks=[],size=0;for await(const chunk of req){size+=chunk.length;if(size>limit)fail(413,'El archivo es demasiado grande.');chunks.push(chunk);}return Buffer.concat(chunks);};
 const readBody=async req=>{try{return JSON.parse((await readRaw(req)).toString()||'{}');}catch{fail(400,'Datos inválidos.');}};
 const readMultipart=createMediaUploadParser({readRaw,text,fail});
 const rate=new Map();
 const checkRate=(key,limit)=>{const t=Date.now(),r=rate.get(key)||{count:0,end:t+900000};if(r.end<t){r.count=0;r.end=t+900000;}r.count++;rate.set(key,r);if(r.count>limit)fail(429,'Demasiados intentos. Probá en unos minutos.');if(rate.size>10000)for(const [k,v]of rate)if(v.end<t)rate.delete(k);};
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
 const chat=chatFeatures({db,all,get,put,own,safeFile,notify,notifyAdmins,send,fail,text,now,sha,markNoticesForRoute});
 const {clientChatIds,chatOwn,chatSummary,staffMessages,staffUnread,staffReadByEmployee,staffReadByAdmin}=chat;
 const mediaAccess=mediaAccessFeatures({db,all,objectStore,planning,team,fieldwork,closure,staffMessages,canAccessRequest,canAccessWork,clientChatIds,fail});
 const {canAccessPrivateFile}=mediaAccess;
 const clientRequests=clientRequestFeatures({db,all,get,put,transaction,requireAdmin,safeFile,notify,notifyAdmins,send,fail,text,validDate,now,id,services,serviceCatalog,planning});
 const handleQuoteWork=quoteWorkRoutes({db,all,get,put,transaction,own,requireAdmin,safeFile,notify,notifyAdmins,send,fail,text,amount,optionalAmount,validDate,now,id,sha,lifecycle});
 const handleFeature=featureRoutes({db,all,get,put,transaction,own,chatOwn,requireAdmin,safeFile,notify,notifyAdmins,send,fail,text,amount,validDate,now,id,sha,planning,markNoticesForRoute});
 const handleState=stateRoutes({db,all,userView,chatSummary,planning,services,serviceCatalog,team,fieldwork,recovery,closure,staffMessages,staffUnread,staffReadByAdmin,staffReadByEmployee,canAccessWork,employeeWork,clientChatIds,publicQuote,publicWork,systemStatus,twoFactor,lifecycle,beginStateSnapshot,endStateSnapshot,send});
 const handleCommunity=communityRoutes({db,all,get,put,requireAdmin,safeFile,notifyAdmins,send,fail,text,services,now,id});
 const handleAdminUtility=adminUtilityRoutes({all,get,put,requireAdmin,safeFile,send,fail,text,sha,now});
 const handleProfile=profileRoutes({db,put,send,fail,text});
 const handleMediaUpload=mediaUploadRoutes({mediaStorage,send});
 async function handle(req,res){
  const url=new URL(req.url,origin),p=url.pathname,method=req.method,estimatorPage=p==='/presupuestos';
  if(origin.startsWith('https:'))res.setHeader('Strict-Transport-Security','max-age=31536000; includeSubDomains');
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','same-origin');
  res.setHeader('X-Frame-Options','SAMEORIGIN');
  res.setHeader('Cross-Origin-Opener-Policy','same-origin-allow-popups');
  res.setHeader('Cross-Origin-Resource-Policy','same-origin');
  res.setHeader('Permissions-Policy','camera=(self), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=()');
  res.setHeader('Content-Security-Policy',estimatorPage?"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'self'; frame-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; worker-src 'self'; manifest-src 'self'":"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'self'; frame-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; worker-src 'self'; manifest-src 'self'");
  if(['GET','HEAD'].includes(method)&&(p==='/'||/\.(?:js|css|png|jpg|webp|svg|webmanifest|html|txt|xml)$/.test(p))&&!p.startsWith('/api/')&&!p.startsWith('/media/')){const file=path.resolve(ROOT,'public','.'+(p==='/'?'/index.html':p));if(!file.startsWith(path.join(ROOT,'public')+path.sep))return send(res,404,{error:'No encontrado.'});try{return staticResponse(req,res,file);}catch{return send(res,404,{error:'No encontrado.'});}}
  const {session,user}=authentication.resolve(req);
  try{
   if(!['GET','HEAD'].includes(method)){if(req.headers.origin!==origin)fail(403,'Origen no permitido.');if(!['/api/login','/api/register','/api/forgot-password','/api/reset-password'].includes(p)&&(!session||req.headers['x-csrf-token']!==session.csrf))fail(403,'Sesión vencida. Volvé a ingresar.');}
   if(['/api/forgot-password','/api/reset-password'].includes(p)){if(method!=='POST')fail(405,'Método no permitido.');checkRate(req.socket.remoteAddress+':recovery',8);const b=await readBody(req);if(await recovery.route({p,method,b,user,res}))return;}
   if((p==='/health'||p==='/healthz')&&method==='GET'){const before=Date.now();db.prepare('SELECT 1 AS ok').get();return send(res,200,{ok:true,database:'available',driver:remoteUrl?'postgresql':'sqlite',databaseMs:Date.now()-before,version,errors5xx15m:recentErrorCount(),...backupHealth(),uptimeSeconds:Math.floor((Date.now()-startedAt)/1000)});}
   if(p==='/api/config')return send(res,200,{demo,webPushKey:keys.publicKey,services,version});
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
    if(method==='POST'&&p==='/api/devices'){if(!['web','android'].includes(b.kind)||!validSubscription(b.kind,b.subscription))fail(400,'Suscripción inválida.');const body=JSON.stringify(b.subscription),key=sha(b.kind+':'+(b.kind==='web'?b.subscription.endpoint:b.subscription.token));if(db.prepare('SELECT count(*) AS n FROM devices WHERE userId=?').get(user.id).n>=20&&!db.prepare('SELECT id FROM devices WHERE id=?').get(key))fail(400,'Límite de dispositivos alcanzado.');transaction(()=>{db.prepare('DELETE FROM delivery WHERE deviceId=?').run(key);db.prepare('INSERT INTO devices VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET userId=excluded.userId,body=excluded.body').run(key,user.id,b.kind,body);});return send(res,200,{deviceId:key});}
    fail(404,'Acción no encontrada.');
   }
   if(method!=='GET'&&method!=='HEAD')fail(405,'Método no permitido.');
   if(p==='/presupuestos'){if(!user){res.writeHead(302,{Location:'/#ingresar'});return res.end();}requireAdmin(user);let html=readFileSync(path.join(ROOT,'private/presupuestos-original.html'),'utf8');const saved=all('estimator',user.id)[0]||null;const bootstrap=JSON.stringify({saved,csrf:session.csrf}).replaceAll('<','\\u003c');html=html.replace('<head>','<head><script>window.AMCStored='+bootstrap+';</script>');html=html.replace('</body>','<script src="/amc-busy.js"></script><script src="/amc-confirm.js"></script><script src="/pdf-logo.js"></script><script src="/estimator-sync.js"></script><script src="/presupuestos-bridge.js"></script><script src="/estimator-steps.js"></script></body>');res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(html);}
   const file=path.resolve(ROOT,'public','.'+(p==='/'?'/index.html':p));if(!file.startsWith(path.join(ROOT,'public')+path.sep))fail(404,'No encontrado.');try{const bytes=readFileSync(file);res.setHeader('Content-Type',({'html':'text/html; charset=utf-8','js':'text/javascript; charset=utf-8','css':'text/css; charset=utf-8','jpg':'image/jpeg','png':'image/png','svg':'image/svg+xml','webp':'image/webp','webmanifest':'application/manifest+json'})[file.split('.').pop()]||'application/octet-stream');res.end(method==='HEAD'?undefined:bytes);}catch{fail(404,'No encontrado.');}
  }catch(e){if((!e.status||e.status>=500)&&process.env.NODE_ENV!=='test')console.error(JSON.stringify({level:'error',requestId:req.amcRequestId||'',method:req.method,path:p,status:e.status||500,error:e.code||e.name||'Error'}));else if(process.env.NODE_ENV==='test'&&!e.status)console.error(e);if(!res.headersSent)send(res,e.status||500,{error:e.status?e.message:'Ocurrió un error. Intentá nuevamente.',...(e.requiresTwoFactor?{requiresTwoFactor:true}:{})});else res.end();}
 }
 let delivering=false;
 async function flushPush(){if(delivering)return;delivering=true;try{for(const row of db.prepare("SELECT delivery.*,devices.kind,devices.body AS device,devices.userId FROM delivery JOIN devices ON devices.id=delivery.deviceId WHERE status='pending' AND nextAt<=? ORDER BY CASE WHEN json_extract(delivery.body,'$.priority')='urgent' THEN 0 ELSE 1 END, delivery.rowid LIMIT 20").all(Date.now())){try{const u=db.prepare('SELECT sound FROM users WHERE id=?').get(row.userId);await deliver(row.kind,JSON.parse(row.device),JSON.parse(row.body),keys,!!u?.sound);db.prepare("UPDATE delivery SET status='sent',error='' WHERE id=?").run(row.id);}catch(e){const attempts=row.attempts+1;db.prepare('UPDATE delivery SET attempts=?,status=?,nextAt=?,error=? WHERE id=?').run(attempts,e.gone?'expired':attempts>=6?'failed':'pending',Date.now()+Math.min(3600000,30000*2**attempts),text(e.message,300),row.id);if(e.gone)db.prepare('DELETE FROM devices WHERE id=?').run(row.deviceId);}}}finally{delivering=false;}}
 const server=http.createServer((req,res)=>{const requestId=randomBytes(8).toString('hex'),started=Date.now();req.amcRequestId=requestId;res.setHeader('X-Request-ID',requestId);res.once('finish',()=>{if(process.env.NODE_ENV==='test')return;const pathname=String(req.url||'').split('?')[0];if(res.statusCode>=500){recentServerErrors.push(Date.now());recentErrorCount();}if(pathname==='/healthz'&&res.statusCode<400)return;console.log(JSON.stringify({level:'info',requestId,method:req.method,path:pathname,status:res.statusCode,durationMs:Date.now()-started}));});handle(req,res).catch(error=>{console.error(JSON.stringify({level:'error',requestId,method:req.method,path:String(req.url||'').split('?')[0],status:503,error:error?.code||error?.name||'Unhandled'}));if(!res.headersSent)send(res,503,{error:'No pudimos confirmar la operación. Revisá la conexión y el estado antes de repetirla.'});else res.end();});});server.requestTimeout=30000;server.headersTimeout=10000;const timer=setInterval(()=>flushPush().catch(()=>console.error('No se pudo procesar la cola de avisos.')),5000);timer.unref();const quoteTimer=setInterval(()=>{try{lifecycle.run();}catch{console.error('No se pudo revisar el plazo de presupuestos.');}},60000);quoteTimer.unref();const fileGcTimer=setInterval(()=>cleanupOrphanFiles().catch(()=>console.error('No se pudo limpiar archivos huérfanos.')),6*60*60*1000);fileGcTimer.unref();server.on('close',()=>{clearInterval(timer);clearInterval(quoteTimer);clearInterval(fileGcTimer);db.close();});return {server,db,addUser,flushPush,processQuotes:lifecycle.run,cleanupOrphanFiles};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const demo=process.argv.includes('--demo'),port=Number(process.env.PORT||4180),origin=process.env.AMC_ORIGIN||process.env.RENDER_EXTERNAL_URL||`http://localhost:${port}`;
 if(!demo&&(!origin.startsWith('https:'))){console.error('Producción requiere AMC_ORIGIN=https://tu-dominio. Para prueba local usá node server.mjs --demo.');process.exit(1);}
 if(process.env.RENDER&&!process.env.AMC_DATABASE_URL&&!demo){console.error('Render producción requiere AMC_DATABASE_URL: no se permite guardar en disco temporal.');process.exit(1);}
 const app=createApp({demo,origin,dbPath:process.env.AMC_DB_PATH||path.join(ROOT,'data',demo?'demo.sqlite':'amc.sqlite')});app.server.listen(port,demo&&!process.env.RENDER?'127.0.0.1':'0.0.0.0',()=>console.log('AMC conectado: '+origin+(demo?' · entorno de prueba, cuentas de ejemplo':' ')));
}
