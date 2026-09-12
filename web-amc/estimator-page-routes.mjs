export function estimatorPageRoutes({requireAdmin}){
 return function route({p,user,res}){
  if(p!=='/presupuestos')return false;
  if(!user){res.writeHead(302,{Location:'/#ingresar'});res.end();return true;}
  requireAdmin(user);
  res.writeHead(302,{Location:'/#cotizador'});
  res.end();
  return true;
 };
}
