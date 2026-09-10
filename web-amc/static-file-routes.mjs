export function staticFileRoutes({ROOT,path,readFileSync,staticResponse,send,fail}){
 const publicRoot=path.join(ROOT,'public');
 const resolveFile=p=>path.resolve(publicRoot,'.'+(p==='/'?'/index.html':p));
 const insidePublic=file=>file.startsWith(publicRoot+path.sep);
 const earlyPattern=/\.(?:js|css|png|jpg|webp|svg|webmanifest|html|txt|xml)$/;
 const serveEarly=({req,res,p,method})=>{
  if(!['GET','HEAD'].includes(method)||(p!=='/'&&!earlyPattern.test(p))||p.startsWith('/api/')||p.startsWith('/media/'))return false;
  const file=resolveFile(p);
  if(!insidePublic(file)){send(res,404,{error:'No encontrado.'});return true;}
  try{staticResponse(req,res,file);}catch{send(res,404,{error:'No encontrado.'});}
  return true;
 };
 const requirePageMethod=method=>{if(method!=='GET'&&method!=='HEAD')fail(405,'Método no permitido.');};
 const serveFallback=({res,p,method})=>{
  const file=resolveFile(p);
  if(!insidePublic(file))fail(404,'No encontrado.');
  try{
   const bytes=readFileSync(file);
   res.setHeader('Content-Type',({'html':'text/html; charset=utf-8','js':'text/javascript; charset=utf-8','css':'text/css; charset=utf-8','jpg':'image/jpeg','png':'image/png','svg':'image/svg+xml','webp':'image/webp','webmanifest':'application/manifest+json'})[file.split('.').pop()]||'application/octet-stream');
   res.end(method==='HEAD'?undefined:bytes);
  }catch{fail(404,'No encontrado.');}
  return true;
 };
 return {serveEarly,requirePageMethod,serveFallback};
}
