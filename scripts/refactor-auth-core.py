from pathlib import Path

path = Path('web-amc/server.mjs')
text = path.read_text()

if "import {createAuthCore} from './auth-core.mjs';" in text:
    raise SystemExit(0)

text = text.replace(
    "import {authRoutes} from './auth-routes.mjs';\n",
    "import {authRoutes} from './auth-routes.mjs';\nimport {createAuthCore} from './auth-core.mjs';\n",
    1,
)
text = text.replace(
    "import {randomUUID,randomBytes,scryptSync,timingSafeEqual,createHash} from 'node:crypto';",
    "import {randomUUID,randomBytes,createHash} from 'node:crypto';",
    1,
)

old = """ const userView=u=>u?{id:u.id,email:u.email,name:u.name,phone:u.phone,town:u.town,role:u.role,sound:!!u.sound}:null;
 const weakPasswords=new Set(['12345678','123456789','1234567890','password','password1','qwerty123','admin123','contraseña','contrasena','amc12345']);
 const passwordHash=p=>{if(typeof p!=='string'||p.length<8||p.length>200||weakPasswords.has(p.trim().toLowerCase()))fail(400,'Usá una contraseña de al menos 8 caracteres que no sea una clave común.');const salt=randomBytes(16).toString('hex');return salt+':'+scryptSync(p,salt,64).toString('hex');};
 const addUser=(email,password,name,role='client')=>{if(!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)||password.length<8||password.length>200||!name)fail(400,'Ingresá nombre, correo válido y contraseña de al menos 8 caracteres.');if(db.prepare('SELECT id FROM users WHERE email=?').get(email))fail(409,'No se pudo crear la cuenta con esos datos.');const key=id();db.prepare('INSERT INTO users(id,email,name,phone,town,role,password) VALUES(?,?,?,?,?,?,?)').run(key,email,name,'','',role,passwordHash(password));return db.prepare('SELECT * FROM users WHERE id=?').get(key);};
 const own=(u,r)=>{if(u.role!=='admin'&&r.userId!==u.id)fail(404,'No encontrado.');return r;};
 const requireAdmin=u=>{if(u.role!=='admin')fail(403,'Este acceso es exclusivo de AMC.');};
 const requestForWork=w=>w.solicitudId||w.requestId||all('quote').find(q=>q.id===(w.presupuestoId||w.quoteId))?.solicitudId||all('quote').find(q=>q.id===(w.presupuestoId||w.quoteId))?.requestId||null;
 const employeeRequestIds=u=>new Set(all('assignment',u.id).filter(a=>a.employeeId===u.id&&!['Cancelada','Finalizada'].includes(a.status)).map(a=>a.requestId));
 const canAccessRequest=(u,r)=>u.role==='admin'||u.role==='client'&&r.userId===u.id||u.role==='employee'&&employeeRequestIds(u).has(r.id);
 const canAccessQuote=(u,q)=>u.role==='admin'||u.role==='client'&&q.userId===u.id;
 const canAccessWork=(u,w)=>u.role==='admin'||u.role==='client'&&w.userId===u.id||u.role==='employee'&&employeeRequestIds(u).has(requestForWork(w));
 const requireResource=(u,resource,check)=>{if(!resource||!check(u,resource))fail(404,'No encontrado.');return resource;};
"""
new = " const {userView,passwordHash,addUser,own,requireAdmin,canAccessRequest,canAccessQuote,canAccessWork,requireResource,createAdminVerifier}=createAuthCore({db,all,id,fail});\n"
if old not in text:
    raise SystemExit('No se encontró el bloque de autenticación esperado')
text = text.replace(old, new, 1)

marker = " const checkRate=(key,limit)=>{const t=Date.now(),r=rate.get(key)||{count:0,end:t+900000};if(r.end<t){r.count=0;r.end=t+900000;}r.count++;rate.set(key,r);if(r.count>limit)fail(429,'Demasiados intentos. Probá en unos minutos.');if(rate.size>10000)for(const [k,v]of rate)if(v.end<t)rate.delete(k);};\n"
if marker not in text:
    raise SystemExit('No se encontró checkRate')
text = text.replace(marker, marker + " const verifyAdmin=createAdminVerifier(checkRate);\n", 1)

legacy = " const verifyAdmin=(user,password)=>{requireAdmin(user);checkRate(user.id+':sensitive',5);if(typeof password!=='string'||password.length<8||password.length>200)fail(403,'Ingresá tu contraseña de administrador.');const [salt,hash]=user.password.split(':');if(!timingSafeEqual(Buffer.from(hash,'hex'),scryptSync(password,salt,64)))fail(403,'La contraseña de administrador no es correcta.');};\n"
if legacy not in text:
    raise SystemExit('No se encontró verifyAdmin anterior')
text = text.replace(legacy, '', 1)

path.write_text(text)
