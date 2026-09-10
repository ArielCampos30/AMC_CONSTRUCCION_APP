export function estimatorPageRoutes({ROOT,all,requireAdmin,readFileSync,path}){
 return function route({p,user,session,res}){
  if(p!=='/presupuestos')return false;
  if(!user){res.writeHead(302,{Location:'/#ingresar'});res.end();return true;}
  requireAdmin(user);
  let html=readFileSync(path.join(ROOT,'private/presupuestos-original.html'),'utf8');
  const saved=all('estimator',user.id)[0]||null;
  const bootstrap=JSON.stringify({saved,csrf:session.csrf}).replaceAll('<','\\u003c');
  html=html.replace('<head>','<head><script>window.AMCStored='+bootstrap+';</script>');
  html=html.replace('</body>','<script src="/amc-busy.js"></script><script src="/amc-confirm.js"></script><script src="/pdf-logo.js"></script><script src="/estimator-sync.js"></script><script src="/presupuestos-bridge.js"></script><script src="/estimator-steps.js"></script></body>');
  res.setHeader('Content-Type','text/html; charset=utf-8');
  res.end(html);
  return true;
 };
}
