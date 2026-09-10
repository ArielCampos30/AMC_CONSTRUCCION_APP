export function profileRoutes({db,put,send,fail,text}){
 return function route({p,method,b,user,res}){
  if(method!=='POST'||p!=='/api/profile')return false;
  if(!text(b.name))fail(400,'El nombre es obligatorio.');
  db.prepare('UPDATE users SET name=?,phone=?,town=?,sound=? WHERE id=?').run(text(b.name),text(b.phone),text(b.town),b.sound?1:0,user.id);
  if(user.role==='client')put('clientProfile',user.id,{id:'profile-'+user.id,userId:user.id,address:text(b.address,500)});
  send(res,200,{ok:true});return true;
 };
}
