export function staticFileRoutes({ROOT,path,readFileSync,staticResponse,send,fail,version='dev'}){
 const publicRoot=path.join(ROOT,'public'),assetVersion=String(version||'dev').replace(/[^A-Za-z0-9_-]/g,'').slice(0,40)||'dev',assetBase='/_amc/'+assetVersion,assetPrefix='/_amc/';
 const resolveFile=p=>path.resolve(publicRoot,'.'+(p==='/'?'/index.html':p));
 const insidePublic=file=>file.startsWith(publicRoot+path.sep);
 const earlyPattern=/\.(?:js|css|png|jpg|jpeg|webp|svg|webmanifest|html|txt|xml|ico|woff2?)$/;
 const transformVersionTokens=bytes=>bytes.toString('utf8').replaceAll('__AMC_ASSET_BASE__',assetBase).replaceAll('__AMC_ASSET_VERSION__',assetVersion);
 const needsVersionTransform=p=>['/','/index.html','/offline.html','/sw.js'].includes(p);
 const requestAsset=p=>{
  if(!p.startsWith(assetPrefix))return {publicPath:p,versioned:false,stale:false};
  const current=assetBase+'/';
  if(!p.startsWith(current))return {publicPath:'',versioned:true,stale:true};
  return {publicPath:'/'+p.slice(current.length),versioned:true,stale:false};
 };
 const serveEarly=({req,res,p,method})=>{
  if(!['GET','HEAD'].includes(method))return false;
  const asset=requestAsset(p);
  if(asset.stale){res.setHeader('Cache-Control','no-store');send(res,410,{error:'La versión de estos recursos ya no está disponible. Recargá AMC.'});return true;}
  const publicPath=asset.publicPath;
  if((publicPath!=='/'&&!earlyPattern.test(publicPath))||publicPath.startsWith('/api/')||publicPath.startsWith('/media/'))return false;
  const file=resolveFile(publicPath);
  if(!insidePublic(file)){send(res,404,{error:'No encontrado.'});return true;}
  const transform=needsVersionTransform(publicPath)?transformVersionTokens:undefined;
  try{staticResponse(req,res,file,{cacheControl:asset.versioned?'public, max-age=31536000, immutable':'public, max-age=0, must-revalidate',variant:(transform?'versioned-shell:':'asset:')+(asset.versioned?'immutable:':'revalidate:')+assetVersion,transform});}catch{send(res,404,{error:'No encontrado.'});}
  return true;
 };
 const requirePageMethod=method=>{if(method!=='GET'&&method!=='HEAD')fail(405,'Método no permitido.');};
 const serveFallback=({res,p,method})=>{
  const file=resolveFile(p);
  if(!insidePublic(file))fail(404,'No encontrado.');
  try{
   const bytes=readFileSync(file);
   res.setHeader('Content-Type',({'html':'text/html; charset=utf-8','js':'text/javascript; charset=utf-8','css':'text/css; charset=utf-8','jpg':'image/jpeg','jpeg':'image/jpeg','png':'image/png','svg':'image/svg+xml','webp':'image/webp','webmanifest':'application/manifest+json'})[file.split('.').pop()]||'application/octet-stream');
   res.setHeader('Cache-Control','no-store');
   res.end(method==='HEAD'?undefined:bytes);
  }catch{fail(404,'No encontrado.');}
  return true;
 };
 return {serveEarly,requirePageMethod,serveFallback,assetBase,assetVersion};
}
