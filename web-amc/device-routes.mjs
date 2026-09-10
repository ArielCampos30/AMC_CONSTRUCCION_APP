export function deviceRoutes({db,transaction,sha,fail,validSubscription,send}){
 return function route({p,method,b,user,res}){
  if(method!=='POST'||p!=='/api/devices')return false;
  if(!['web','android'].includes(b.kind)||!validSubscription(b.kind,b.subscription))fail(400,'Suscripción inválida.');
  const body=JSON.stringify(b.subscription),key=sha(b.kind+':'+(b.kind==='web'?b.subscription.endpoint:b.subscription.token));
  if(db.prepare('SELECT count(*) AS n FROM devices WHERE userId=?').get(user.id).n>=20&&!db.prepare('SELECT id FROM devices WHERE id=?').get(key))fail(400,'Límite de dispositivos alcanzado.');
  transaction(()=>{
   db.prepare('DELETE FROM delivery WHERE deviceId=?').run(key);
   db.prepare('INSERT INTO devices VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET userId=excluded.userId,body=excluded.body').run(key,user.id,b.kind,body);
  });
  send(res,200,{deviceId:key});
  return true;
 };
}
