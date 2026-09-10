import {randomBytes,scryptSync,timingSafeEqual} from 'node:crypto';

const weakPasswords=new Set(['12345678','123456789','1234567890','password','password1','qwerty123','admin123','contraseña','contrasena','amc12345']);

export function createAuthCore({db,all,id,fail}){
 const userView=u=>u?{id:u.id,email:u.email,name:u.name,phone:u.phone,town:u.town,role:u.role,sound:!!u.sound}:null;
 const passwordHash=p=>{
  if(typeof p!=='string'||p.length<8||p.length>200||weakPasswords.has(p.trim().toLowerCase()))fail(400,'Usá una contraseña de al menos 8 caracteres que no sea una clave común.');
  const salt=randomBytes(16).toString('hex');
  return salt+':'+scryptSync(p,salt,64).toString('hex');
 };
 const addUser=(email,password,name,role='client')=>{
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||password.length<8||password.length>200||!name)fail(400,'Ingresá nombre, correo válido y contraseña de al menos 8 caracteres.');
  if(db.prepare('SELECT id FROM users WHERE email=?').get(email))fail(409,'No se pudo crear la cuenta con esos datos.');
  const key=id();
  db.prepare('INSERT INTO users(id,email,name,phone,town,role,password) VALUES(?,?,?,?,?,?,?)').run(key,email,name,'','',role,passwordHash(password));
  return db.prepare('SELECT * FROM users WHERE id=?').get(key);
 };
 const own=(u,r)=>{if(u.role!=='admin'&&r.userId!==u.id)fail(404,'No encontrado.');return r;};
 const requireAdmin=u=>{if(u.role!=='admin')fail(403,'Este acceso es exclusivo de AMC.');};
 const requestForWork=w=>w.solicitudId||w.requestId||all('quote').find(q=>q.id===(w.presupuestoId||w.quoteId))?.solicitudId||all('quote').find(q=>q.id===(w.presupuestoId||w.quoteId))?.requestId||null;
 const employeeRequestIds=u=>new Set(all('assignment',u.id).filter(a=>a.employeeId===u.id&&!['Cancelada','Finalizada'].includes(a.status)).map(a=>a.requestId));
 const canAccessRequest=(u,r)=>u.role==='admin'||u.role==='client'&&r.userId===u.id||u.role==='employee'&&employeeRequestIds(u).has(r.id);
 const canAccessQuote=(u,q)=>u.role==='admin'||u.role==='client'&&q.userId===u.id;
 const canAccessWork=(u,w)=>u.role==='admin'||u.role==='client'&&w.userId===u.id||u.role==='employee'&&employeeRequestIds(u).has(requestForWork(w));
 const requireResource=(u,resource,check)=>{if(!resource||!check(u,resource))fail(404,'No encontrado.');return resource;};
 const createAdminVerifier=checkRate=>(user,password)=>{
  requireAdmin(user);
  checkRate(user.id+':sensitive',5);
  if(typeof password!=='string'||password.length<8||password.length>200)fail(403,'Ingresá tu contraseña de administrador.');
  const [salt,hash]=user.password.split(':');
  if(!timingSafeEqual(Buffer.from(hash,'hex'),scryptSync(password,salt,64)))fail(403,'La contraseña de administrador no es correcta.');
 };
 return {userView,passwordHash,addUser,own,requireAdmin,canAccessRequest,canAccessQuote,canAccessWork,requireResource,createAdminVerifier};
}
