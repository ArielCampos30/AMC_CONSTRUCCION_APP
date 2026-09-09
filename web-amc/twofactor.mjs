import {createCipheriv,createDecipheriv,createHash,createHmac,randomBytes,timingSafeEqual} from 'node:crypto';

const ALPHABET='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const clean=value=>String(value||'').toUpperCase().replace(/[^A-Z2-7]/g,'');
export function base32Encode(bytes){let bits=0,value=0,out='';for(const byte of bytes){value=(value<<8)|byte;bits+=8;while(bits>=5){out+=ALPHABET[(value>>>(bits-5))&31];bits-=5;}}if(bits)out+=ALPHABET[(value<<(5-bits))&31];return out;}
function base32Decode(input){const value=clean(input);let bits=0,buffer=0,out=[];for(const char of value){const n=ALPHABET.indexOf(char);if(n<0)throw Error('Secreto 2FA inválido.');buffer=(buffer<<5)|n;bits+=5;if(bits>=8){out.push((buffer>>>(bits-8))&255);bits-=8;}}return Buffer.from(out);}
const codeAt=(secret,time)=>{const counter=Math.floor(time/30000),msg=Buffer.alloc(8);msg.writeBigUInt64BE(BigInt(counter));const digest=createHmac('sha1',base32Decode(secret)).update(msg).digest(),offset=digest[digest.length-1]&15,n=(digest.readUInt32BE(offset)&0x7fffffff)%1000000;return String(n).padStart(6,'0');};
export const totpCode=(secret,time=Date.now())=>codeAt(secret,time);
const safeEqual=(a,b)=>{const aa=Buffer.from(String(a)),bb=Buffer.from(String(b));return aa.length===bb.length&&timingSafeEqual(aa,bb);};
const recoveryHash=(userId,code)=>createHash('sha256').update(userId+':'+String(code).toUpperCase().replace(/\s/g,'')).digest('hex');
const encryptionKey=value=>createHash('sha256').update(String(value||'')).digest();
function seal(secret,keyValue){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',encryptionKey(keyValue),iv),body=Buffer.concat([cipher.update(secret,'utf8'),cipher.final()]);return [iv,cipher.getAuthTag(),body].map(x=>x.toString('base64url')).join('.');}
function open(value,keyValue){const [iv,tag,body]=String(value||'').split('.').map(x=>Buffer.from(x,'base64url'));if(iv.length!==12||tag.length!==16||!body.length)throw Error('Configuración 2FA dañada.');const decipher=createDecipheriv('aes-256-gcm',encryptionKey(keyValue),iv);decipher.setAuthTag(tag);return Buffer.concat([decipher.update(body),decipher.final()]).toString('utf8');}
const recoveryCode=()=>{const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',part=()=>Array.from(randomBytes(5),b=>chars[b%chars.length]).join('');return 'AMC-'+part()+'-'+part();};

export function twoFactorFeatures({db,all,put,transaction,requireAdmin,verifyAdmin,send,fail,now,keyValue}){
 const configured=()=>typeof keyValue==='string'&&keyValue.length>=24;
 const record=user=>all('admin2fa',user.id)[0]||null;
 const status=user=>({available:configured(),enabled:!!record(user)?.enabled,pending:!!record(user)&&!record(user)?.enabled});
 const verifyCode=(user,code,{consumeRecovery=true}={})=>{
  const current=record(user);if(!current?.enabled)return true;if(!configured())fail(503,'La protección de dos pasos está configurada pero falta la llave del servidor.');
  const normalized=String(code||'').trim().toUpperCase();
  if(/^\d{6}$/.test(normalized)){const secret=open(current.secret,keyValue),time=Date.now();for(const delta of [-30000,0,30000])if(safeEqual(codeAt(secret,time+delta),normalized))return true;}
  const hash=recoveryHash(user.id,normalized),index=(current.recovery||[]).indexOf(hash);if(index>=0){if(consumeRecovery){const recovery=[...current.recovery];recovery.splice(index,1);put('admin2fa',user.id,{...current,recovery,lastRecoveryAt:now()});}return true;}
  const error=Object.assign(Error('El código de seguridad no es válido.'),{status:401,requiresTwoFactor:true});throw error;
 };
 const requireLoginCode=(user,code)=>{if(user?.role!=='admin'||!record(user)?.enabled)return true;if(!String(code||'').trim())throw Object.assign(Error('Ingresá el código de seguridad de tu autenticador.'),{status:401,requiresTwoFactor:true});return verifyCode(user,code);};
 const route=async({p,method,b,user,res,session})=>{
  if(!p.startsWith('/api/admin/2fa/'))return false;requireAdmin(user);
  if(method==='GET'&&p==='/api/admin/2fa/status'){send(res,200,status(user));return true;}
  if(method!=='POST')fail(405,'Método no permitido.');
  if(!configured())fail(503,'Falta configurar la llave segura de doble factor en el servidor.');
  if(p==='/api/admin/2fa/setup'){
   verifyAdmin(user,b.password);const secret=base32Encode(randomBytes(20)),entry={id:'2fa-'+user.id,userId:user.id,secret:seal(secret,keyValue),enabled:false,recovery:[],createdAt:now()};put('admin2fa',user.id,entry);const label='AMC · '+user.email,uri='otpauth://totp/'+encodeURIComponent(label)+'?secret='+secret+'&issuer='+encodeURIComponent('AMC Construcciones')+'&algorithm=SHA1&digits=6&period=30';send(res,200,{secret,uri});return true;
  }
  if(p==='/api/admin/2fa/enable'){
   const current=record(user);if(!current)fail(409,'Primero iniciá la configuración de doble factor.');const secret=open(current.secret,keyValue),code=String(b.code||'').trim();if(!/^\d{6}$/.test(code)||![-30000,0,30000].some(delta=>safeEqual(codeAt(secret,Date.now()+delta),code)))fail(400,'El código no coincide. Revisá la hora del teléfono e intentá nuevamente.');const recoveryCodes=Array.from({length:8},recoveryCode),recovery=recoveryCodes.map(code=>recoveryHash(user.id,code));transaction(()=>{put('admin2fa',user.id,{...current,enabled:true,recovery,enabledAt:now()});if(session)db.prepare('DELETE FROM sessions WHERE userId=? AND token<>?').run(user.id,session.token);});send(res,200,{ok:true,recoveryCodes});return true;
  }
  if(p==='/api/admin/2fa/disable'){
   verifyAdmin(user,b.password);const current=record(user);if(!current?.enabled)fail(409,'El doble factor ya está desactivado.');verifyCode(user,b.code,{consumeRecovery:false});transaction(()=>{db.prepare("DELETE FROM docs WHERE kind='admin2fa' AND owner=?").run(user.id);if(session)db.prepare('DELETE FROM sessions WHERE userId=? AND token<>?').run(user.id,session.token);});send(res,200,{ok:true});return true;
  }
  return false;
 };
 return {status,requireLoginCode,route};
}
