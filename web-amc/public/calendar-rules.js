export const weekdays=['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
export function weekday(day){return new Date(day+'T12:00:00Z').getUTCDay();}
export function slotsOn(day){const w=weekday(day);return w===0?[]:w===6?['Mañana']:['Mañana','Tarde'];}
export function businessTime(day,time,duration=1){if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(time||''))return false;const w=weekday(day),[h,m]=time.split(':').map(Number),minutes=h*60+m;return w!==0&&minutes>=540&&minutes+duration<=(w===6?780:1080);}
export function rangeSlots(start,end,slot='Día completo'){const a=Date.parse(start+'T12:00:00Z'),b=Date.parse(end+'T12:00:00Z');if(!Number.isFinite(a)||!Number.isFinite(b)||b<a||b-a>365*86400000)throw Error('Elegí un período válido de hasta un año.');const result=[];for(let t=a;t<=b;t+=86400000){const day=new Date(t).toISOString().slice(0,10);for(const part of slotsOn(day))if(slot==='Día completo'||slot===part)result.push({day,part});}return result;}
export function sameTeam(a,b){return !a.length||!b.length||a.some(id=>b.includes(id));}
