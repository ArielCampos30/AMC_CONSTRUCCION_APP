import {randomBytes,scryptSync,timingSafeEqual} from 'node:crypto';

export function authRoutes({db,addUser,userView,passwordHash,twoFactor,checkRate,rate,text,sha,send,fail,origin,readBody}){
 const resolve=req=>{
  const cookie=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('amc_session='))?.slice(12);
  const row=cookie?db.prepare(`SELECT s.token AS sessionToken,s.userId AS sessionUserId,s.expires AS sessionExpires,s.csrf AS sessionCsrf,
   u.id AS userId,u.email AS userEmail,u.name AS userName,u.phone AS userPhone,u.town AS userTown,u.role AS userRole,u.password AS userPassword,u.sound AS userSound,u.active AS userActive
   FROM sessions s JOIN users u ON u.id=s.userId WHERE s.token=? AND s.expires>? AND u.active=1`).get(sha(cookie),Date.now()):null;
  const session=row?{token:row.sessionToken,userId:row.sessionUserId,expires:row.sessionExpires,csrf:row.sessionCsrf}:null;
  const user=row?{id:row.userId,email:row.userEmail,name:row.userName,phone:row.userPhone,town:row.userTown,role:row.userRole,password:row.userPassword,sound:row.userSound,active:row.userActive}:null;
  return {session,user};
 };
 const handlePublic=async({p,method,req,res})=>{
  if(p!=='/api/login'&&p!=='/api/register')return false;
  if(method!=='POST')fail(405,'Método no permitido.');
  checkRate(req.socket.remoteAddress+':login',30);
  const b=await readBody(req),email=text(b.email).toLowerCase(),password=typeof b.password==='string'?b.password:'',
   accountRate='login-account:'+sha(email||'empty');
  checkRate(accountRate,12);
  if(password.length>200)fail(400,'Contraseña inválida.');
  let u;
  if(p.endsWith('register')){
   checkRate(req.socket.remoteAddress+':register',8);
   if(typeof b.passwordConfirm==='string'&&b.passwordConfirm!==password)fail(400,'Las contraseñas no coinciden.');
   u=addUser(email,password,text(b.name));
  }else{
   u=db.prepare('SELECT * FROM users WHERE email=?').get(email);
   const [salt,expected]=(u?.password||passwordHash('dummy-password')).split(':');
   if(!timingSafeEqual(Buffer.from(expected,'hex'),scryptSync(password,salt,64))||!u||!u.active)fail(401,'Correo o contraseña incorrectos.');
   twoFactor.requireLoginCode(u,b.code);
  }
  const raw=randomBytes(32).toString('hex'),csrf=randomBytes(24).toString('hex');
  db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());
  db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(sha(raw),u.id,Date.now()+7*86400000,csrf);
  const sessions=db.prepare('SELECT token FROM sessions WHERE userId=? ORDER BY expires DESC').all(u.id);
  for(const stale of sessions.slice(8))db.prepare('DELETE FROM sessions WHERE token=?').run(stale.token);
  rate.delete(accountRate);
  res.setHeader('Set-Cookie',`amc_session=${raw}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${origin.startsWith('https:')?'; Secure':''}`);
  send(res,200,{user:userView(u),csrf});
  return true;
 };
 const logout=({p,method,user,session,b,res})=>{
  if(method!=='POST'||p!=='/api/logout')return false;
  db.prepare('DELETE FROM sessions WHERE token=?').run(session.token);
  db.prepare('DELETE FROM devices WHERE userId=? AND id=?').run(user.id,text(b.deviceId));
  res.setHeader('Set-Cookie',`amc_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${origin.startsWith('https:')?'; Secure':''}`);
  send(res,200,{ok:true});
  return true;
 };
 return {resolve,handlePublic,logout};
}
