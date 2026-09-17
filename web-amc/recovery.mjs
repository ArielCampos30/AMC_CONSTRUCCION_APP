import {randomBytes,randomInt,scryptSync,timingSafeEqual} from 'node:crypto';
import {createPersistentRateLimiter} from './request-runtime.mjs';
export async function sendRecoveryMail(email,{code}){if(!process.env.AMC_RESEND_API_KEY||!process.env.AMC_MAIL_FROM)throw Error('Correo sin configurar');const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+process.env.AMC_RESEND_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({from:process.env.AMC_MAIL_FROM,to:[email],subject:'Código para recuperar tu acceso a AMC',text:'Tu código de recuperación de AMC es: '+code+'\n\nVence en 10 minutos y se usa una sola vez. Si no lo solicitaste, ignorá este mensaje.'}),signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('No se pudo entregar el correo');}
export function recoveryFeatures({db,all,put,transaction,requireAdmin,verifyAdmin,notifyAdmins,send,fail,text,sha,passwordHash,origin,clock=Date.now,sendRecovery=sendRecoveryMail}){
 db.exec('CREATE TABLE IF NOT EXISTS password_resets(token TEXT PRIMARY KEY,userId TEXT NOT NULL,expires INTEGER NOT NULL,fingerprint TEXT NOT NULL)');
 db.exec('CREATE TABLE IF NOT EXISTS recovery_codes(challenge TEXT PRIMARY KEY,userId TEXT NOT NULL,codehash TEXT NOT NULL,expires INTEGER NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,fingerprint TEXT NOT NULL)');
 const persistentRate=createPersistentRateLimiter({db,fail,clock});
 const generic='Si la cuenta está activa, vas a recibir un código por correo. Vence en 10 minutos.';
 const deletionGeneric={ok:true,message:'Recibimos la solicitud. AMC va a verificar la identidad de la cuenta antes de procesarla.'};
 function issueLink(u){const token=randomBytes(32).toString('hex');db.prepare('DELETE FROM password_resets WHERE userId=? OR expires<=?').run(u.id,clock());db.prepare('INSERT INTO password_resets VALUES(?,?,?,?)').run(sha(token),u.id,clock()+900000,sha(u.password));return origin+'/#restablecer?token='+token;}
 function issueCode(u){const challenge=randomBytes(32).toString('hex'),code=String(randomInt(0,1000000)).padStart(6,'0');db.prepare('DELETE FROM recovery_codes WHERE userId=? OR expires<=?').run(u.id,clock());db.prepare('INSERT INTO recovery_codes(challenge,userId,codehash,expires,attempts,fingerprint) VALUES(?,?,?,?,?,?)').run(sha(challenge),u.id,sha(challenge+':'+code),clock()+600000,0,sha(u.password));return {challenge,code};}
 function passwordMatches(u,password){if(!u||typeof password!=='string'||password.length>200)return false;const [salt,expected]=String(u.password||'').split(':');if(!salt||!expected)return false;const actual=scryptSync(password,salt,64),stored=Buffer.from(expected,'hex');return stored.length===actual.length&&timingSafeEqual(stored,actual);}
 function finish(u){db.prepare('DELETE FROM password_resets WHERE userId=?').run(u.id);db.prepare('DELETE FROM recovery_codes WHERE userId=?').run(u.id);db.prepare('DELETE FROM sessions WHERE userId=?').run(u.id);db.prepare('DELETE FROM delivery WHERE deviceId IN (SELECT id FROM devices WHERE userId=?)').run(u.id);db.prepare('DELETE FROM devices WHERE userId=?').run(u.id);const prior=all('recoveryRequest').find(x=>x.userId===u.id);if(prior)put('recoveryRequest','',{...prior,status:'Resuelta'});}
 function pendingDeletion(userId){return all('accountDeletionRequest',userId).find(item=>item.userId===userId&&item.status==='Pendiente')||null;}
 async function route({p,method,b,user,res}){
  if(p==='/api/public/account-deletion'&&method==='POST'){
   const submissionId=text(b.submissionId,120),website=text(b.website,300),email=text(b.email,254).trim().toLowerCase(),reason=text(b.reason,1000);
   if(website){send(res,202,deletionGeneric);return true;}
   if(!/^[\w-]{8,120}$/.test(submissionId||''))fail(400,'Referencia inválida.');
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail(400,'Ingresá el correo de tu cuenta AMC.');
   const rate='account-deletion-web:'+sha(email);persistentRate.check(rate,4);
   const existing=all('accountDeletionRequest').find(item=>String(item.email||'').toLowerCase()===email&&item.status==='Pendiente');
   if(existing){persistentRate.clear(rate);send(res,200,deletionGeneric);return true;}
   const record={id:'account-deletion-web-'+sha(submissionId),userId:null,email,name:'Solicitud web',status:'Pendiente',source:'web',verification:'Pendiente',reason,date:new Date(clock()).toISOString()};
   put('accountDeletionRequest','',record);notifyAdmins('Solicitud web de eliminación de cuenta',email+' pidió eliminar una cuenta de AMC. Verificá la identidad antes de procesarla.','/#clientes');persistentRate.clear(rate);send(res,201,deletionGeneric);return true;
  }
  if(p==='/api/change-password'&&method==='POST'){
   if(!user)fail(401,'Ingresá a tu cuenta para continuar.');const rate='password-change:'+user.id;persistentRate.check(rate,5);
   if(!passwordMatches(user,b.currentPassword))fail(403,'La contraseña actual no es correcta.');if(b.currentPassword===b.password)fail(400,'La nueva contraseña debe ser diferente de la actual.');
   if(typeof b.password!=='string'||b.password.length<8||b.password.length>200)fail(400,'Usá una contraseña de 8 a 200 caracteres.');
   const requestedDevice=text(b.deviceId,200),keepDevice=requestedDevice&&db.prepare('SELECT id FROM devices WHERE userId=? AND id=?').get(user.id,requestedDevice)?requestedDevice:'',devices=db.prepare('SELECT id FROM devices WHERE userId=?').all(user.id),raw=randomBytes(32).toString('hex'),csrf=randomBytes(24).toString('hex'),expires=clock()+7*86400000,next=passwordHash(b.password);
   transaction(()=>{
    db.prepare('UPDATE users SET password=? WHERE id=?').run(next,user.id);
    db.prepare('DELETE FROM password_resets WHERE userId=?').run(user.id);
    db.prepare('DELETE FROM recovery_codes WHERE userId=?').run(user.id);
    db.prepare('DELETE FROM sessions WHERE userId=?').run(user.id);
    for(const device of devices)if(!keepDevice||device.id!==keepDevice){db.prepare('DELETE FROM delivery WHERE deviceId=?').run(device.id);db.prepare('DELETE FROM devices WHERE id=?').run(device.id);}
    db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(sha(raw),user.id,expires,csrf);
   });
   persistentRate.clear(rate);
   res.setHeader('Set-Cookie',`amc_session=${raw}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${origin.startsWith('https:')?'; Secure':''}`);
   send(res,200,{ok:true,otherSessionsClosed:true,devicesRevoked:devices.filter(device=>!keepDevice||device.id!==keepDevice).length});return true;
  }
  if(p==='/api/account-deletion-request'&&method==='POST'){
   if(user?.role!=='client')fail(403,'Esta opción está disponible para cuentas de cliente.');const rate='account-deletion:'+user.id;persistentRate.check(rate,5);
   if(!passwordMatches(user,b.password))fail(403,'La contraseña actual no es correcta.');const existing=pendingDeletion(user.id);if(existing){persistentRate.clear(rate);send(res,200,existing);return true;}
   const record={id:'account-deletion-'+user.id,userId:user.id,email:user.email,name:user.name,status:'Pendiente',reason:text(b.reason,1000),date:new Date(clock()).toISOString()};
   put('accountDeletionRequest',user.id,record);notifyAdmins('Solicitud de eliminación de cuenta',user.name+' pidió eliminar su cuenta de AMC. Revisá qué datos deben eliminarse y cuáles requieren conservación.','/#clientes');persistentRate.clear(rate);send(res,201,record);return true;
  }
  if(p==='/api/account-deletion-request/cancel'&&method==='POST'){
   if(user?.role!=='client')fail(403,'Esta opción está disponible para cuentas de cliente.');const existing=pendingDeletion(user.id);if(existing){put('accountDeletionRequest',user.id,{...existing,status:'Cancelada',cancelledAt:new Date(clock()).toISOString()});notifyAdmins('Solicitud de eliminación cancelada',user.name+' canceló su pedido de eliminación de cuenta.','/#clientes');}send(res,200,{ok:true});return true;
  }
  if(p==='/api/forgot-password'&&method==='POST'){const email=text(b.email).toLowerCase(),recoveryRate='recovery-account:'+sha(email||'empty');persistentRate.check(recoveryRate,4);const unknownChallenge=randomBytes(32).toString('hex'),u=db.prepare('SELECT * FROM users WHERE email=? AND active=1').get(email);if(u){const k='recovery-'+u.id,record={id:k,userId:u.id,email:u.email,name:u.name,date:new Date(clock()).toISOString(),status:'Pendiente'},issued=issueCode(u);put('recoveryRequest','',record);notifyAdmins('Recuperación de acceso solicitada',u.name+' necesita recuperar su cuenta.','/#recuperar-cuentas');Promise.resolve().then(()=>sendRecovery(u.email,{code:issued.code})).then(()=>{const current=all('recoveryRequest').find(x=>x.id===k);if(current?.date===record.date&&current.status==='Pendiente')put('recoveryRequest','',{...record,status:'Código enviado'});}).catch(()=>{const current=all('recoveryRequest').find(x=>x.id===k);if(current?.date===record.date&&current.status==='Pendiente')put('recoveryRequest','',{...record,status:'Requiere asistencia de AMC'});});return send(res,200,{ok:true,message:generic,challenge:issued.challenge});}send(res,200,{ok:true,message:generic,challenge:unknownChallenge});return true;}
  if(p==='/api/reset-password'&&method==='POST'){if(typeof b.password!=='string'||b.password.length<8||b.password.length>200)fail(400,'Usá una contraseña de 8 a 200 caracteres.');let record,u;if(b.challenge||b.code){const challenge=text(b.challenge,200),code=text(b.code,6);record=db.prepare('SELECT * FROM recovery_codes WHERE challenge=? AND expires>?').get(sha(challenge),clock());if(record){if(record.attempts>=5)fail(400,'El código quedó bloqueado. Solicitá uno nuevo.');if(!/^\d{6}$/.test(code)||record.codehash!==sha(challenge+':'+code)){db.prepare('UPDATE recovery_codes SET attempts=attempts+1 WHERE challenge=?').run(sha(challenge));fail(400,'El código no es válido. Revisalo o solicitá uno nuevo.');}u=db.prepare('SELECT * FROM users WHERE id=? AND active=1').get(record.userId);}}else{record=db.prepare('SELECT * FROM password_resets WHERE token=? AND expires>?').get(sha(text(b.token,200)),clock());u=record?db.prepare('SELECT * FROM users WHERE id=? AND active=1').get(record.userId):null;}if(!u||record.fingerprint!==sha(u.password))fail(400,'El código venció, ya se usó o no es válido. Solicitá uno nuevo.');transaction(()=>{db.prepare('UPDATE users SET password=? WHERE id=?').run(passwordHash(b.password),u.id);finish(u);});persistentRate.clear('recovery-account:'+sha(String(u.email||'').toLowerCase()));send(res,200,{ok:true});return true;}
  if(p==='/api/recovery-link'&&method==='POST'){verifyAdmin(user,b.adminPassword);const u=db.prepare('SELECT * FROM users WHERE id=? AND active=1').get(b.userId);if(!u)fail(404,'Cuenta no disponible.');const url=issueLink(u);send(res,200,{url,expiresInMinutes:15});return true;}return false;
 }
 return {route,state:u=>({recoveryRequests:u.role==='admin'?all('recoveryRequest'):[],accountDeletionRequest:u.role==='client'?pendingDeletion(u.id):null,accountDeletionRequests:u.role==='admin'?all('accountDeletionRequest'):[]})};
}