import {applyHttpSecurity} from './http-security.mjs';
import {clientIpFromRequest} from './request-runtime.mjs';

export function createRequestDispatcher({
 origin,
 staticFiles,
 authentication,
 fail,
 checkRate,
 readBody,
 recovery,
 landingProspects,
 publicAccountDeletion,
 handlePublicSystem,
 handleState,
 mediaAccess,
 readMultipart,
 twoFactor,
 chat,
 planning,
 handleAdminUtility,
 appearance,
 closure,
 fieldwork,
 team,
 purchases,
 handleFeature,
 clientRequests,
 handleProfile,
 handleMediaUpload,
 handleQuoteWork,
 handleCommunity,
 notificationRoutes,
 handleDevices,
 handleEstimatorPage,
 send
}){
 const landingOrigin=String(process.env.AMC_LANDING_ORIGIN||'https://amc-construcciones.onrender.com').replace(/\/+$/,'');
 const prepareLandingCors=()=>{
  const requestOrigin=String(req.headers.origin||'').replace(/\/+$/,'');
  if(requestOrigin!==landingOrigin)fail(403,'Origen no permitido.');
  res.setHeader('Access-Control-Allow-Origin',landingOrigin);
  res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  res.setHeader('Access-Control-Max-Age','600');
  res.setHeader('Vary','Origin');
 };
 return async function handle(req,res){
  const url=new URL(req.url,origin),p=url.pathname,method=req.method;
  applyHttpSecurity({res,origin,pathname:p});
  if(staticFiles.serveEarly({req,res,p,method}))return;
  const {session,user}=authentication.resolve(req);
  try{
   if(p==='/api/public/prospects'){
    const requestOrigin=String(req.headers.origin||'').replace(/\/+$/,'');
    if(requestOrigin!==landingOrigin)fail(403,'Origen no permitido.');
    res.setHeader('Access-Control-Allow-Origin',landingOrigin);
    res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers','Content-Type');
    res.setHeader('Access-Control-Max-Age','600');
    res.setHeader('Vary','Origin');
    if(method==='OPTIONS'){res.writeHead(204);res.end();return;}
    if(method!=='POST')fail(405,'Método no permitido.');
    checkRate('ip:'+clientIpFromRequest(req)+':landing-prospect',8);
    const b=await readBody(req);
    if(await landingProspects.route({p,method,b,res}))return;
    fail(404,'Acción no encontrada.');
   }
   if(p==='/api/public/account-deletion'){
    const requestOrigin=String(req.headers.origin||'').replace(/\/+$/,'');
    if(requestOrigin!==landingOrigin)fail(403,'Origen no permitido.');
    res.setHeader('Access-Control-Allow-Origin',landingOrigin);
    res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers','Content-Type');
    res.setHeader('Access-Control-Max-Age','600');
    res.setHeader('Vary','Origin');
    if(method==='OPTIONS'){res.writeHead(204);res.end();return;}
    if(method!=='POST')fail(405,'Método no permitido.');
    checkRate('ip:'+clientIpFromRequest(req)+':landing-account-deletion',5);
    const b=await readBody(req);
    if(await publicAccountDeletion.route({p,method,b,res}))return;
    fail(404,'Acción no encontrada.');
   }
   if(!['GET','HEAD'].includes(method)){
    if(req.headers.origin!==origin)fail(403,'Origen no permitido.');
    if(!['/api/login','/api/register','/api/forgot-password','/api/reset-password'].includes(p)&&(!session||req.headers['x-csrf-token']!==session.csrf))fail(403,'Sesión vencida. Volvé a ingresar.');
   }
   if(['/api/forgot-password','/api/reset-password'].includes(p)){
    if(method!=='POST')fail(405,'Método no permitido.');
    checkRate('ip:'+clientIpFromRequest(req)+':recovery',8);
    const b=await readBody(req);
    if(await recovery.route({p,method,b,user,res}))return;
   }
   if(handlePublicSystem({p,method,res}))return;
   if(await authentication.handlePublic({p,method,req,res}))return;
   if(await handleState({p,method,user,session,res}))return;
   if(await mediaAccess.serve({user,p,method,req,res}))return;
   if(p.startsWith('/api/')){
    if(!user)fail(401,'Ingresá a tu cuenta para continuar.');
    checkRate(user.id+':api',400);
    if(p.startsWith('/api/admin/2fa/')){
     const twoFactorBody=method==='GET'?{}:await readBody(req);
     if(await twoFactor.route({p,method,b:twoFactorBody,user,res,session}))return;
    }
    if(chat.routeBeforeBody({p,method,user,url,res}))return;
    const b=p==='/api/upload'&&String(req.headers['content-type']||'').startsWith('multipart/form-data')?await readMultipart(req):await readBody(req);
    if(chat.routeAfterBody({p,method,b,user,url,res}))return;
    if(user.role==='employee'&&/^\/api\/requests\/[^/]+\/messages(?:\/read)?$/.test(p))fail(404,'Conversación no encontrada.');
    if(user.role==='employee'&&!['/api/logout','/api/profile','/api/change-password','/api/upload','/api/devices','/api/notices/read','/api/notices/test'].includes(p)&&!/^\/api\/assignments\/[^/]+\/(report|visit-sheet|materials)$/.test(p))fail(403,'Tu acceso está limitado a tus asignaciones.');
    if(method==='POST'&&(p==='/api/assignments'||/^\/api\/assignments\/[^/]+\/edit$/.test(p)))planning.validateTime(b.day,b.time);
    if(method==='POST'&&/^\/api\/requests\/[^/]+\/appointment$/.test(p))planning.validateTime(b.day,b.time,Number(b.duration));
    if(handleAdminUtility({p,method,b,user,res}))return;
    if(await appearance.route({p,method,b,user,res}))return;
    if(await planning.route({p,method,b,user,res}))return;
    if(await recovery.route({p,method,b,user,res}))return;
    if(await closure.route({p,method,b,user,res}))return;
    if(await fieldwork.route({p,method,b,user,res}))return;
    if(await team.route({p,method,b,user,res}))return;
    if(await purchases.route({p,method,b,user,res}))return;
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
  }catch(e){
   if((!e.status||e.status>=500)&&process.env.NODE_ENV!=='test')console.error(JSON.stringify({level:'error',requestId:req.amcRequestId||'',method:req.method,path:p,status:e.status||500,error:e.code||e.name||'Error'}));
   else if(process.env.NODE_ENV==='test'&&!e.status)console.error(e);
   if(!res.headersSent)send(res,e.status||500,{error:e.status?e.message:'Ocurrió un error. Intentá nuevamente.',...(e.requiresTwoFactor?{requiresTwoFactor:true}:{})});
   else res.end();
  }
 };
}