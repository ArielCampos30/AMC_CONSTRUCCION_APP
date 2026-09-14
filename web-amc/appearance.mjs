export function appearanceFeatures({all,put,requireAdmin,safeFile,send,fail,text,now}){
 const appearance=()=>all('appearance')[0]||{id:'public-appearance',title:'Tu casa.\nTu proyecto.\nTodo en AMC.',subtitle:'Desde la primera idea hasta el último detalle, un lugar para conversar, presupuestar y seguir tu obra.',photos:[],history:[]};
 const appearanceSnapshot=a=>({title:a.title,subtitle:a.subtitle,photos:(a.photos||[]).map(p=>({...p})),versionAt:a.updatedAt||now()});
 const publicMedia=p=>appearance().photos.some(x=>x.url===p);
 async function route({p,method,b,user,res}){
  if(p==='/api/appearance'&&method==='POST'){
   requireAdmin(user);
   if(!text(b.title,160)||!text(b.subtitle,600)||!Array.isArray(b.photos)||b.photos.length>5)fail(400,'Completá el título, presentación y hasta cinco fotos.');
   const current=appearance(),photos=b.photos.map(x=>({url:current.photos.some(p=>p.url==='/media/'+x.id)?'/media/'+x.id:safeFile(user,x.id,'image/'),caption:text(x.caption,200)})),nextBase={title:text(b.title,160),subtitle:text(b.subtitle,600),photos},changed=JSON.stringify({title:current.title,subtitle:current.subtitle,photos:current.photos||[]})!==JSON.stringify(nextBase),history=changed?[appearanceSnapshot(current),...(current.history||[])].slice(0,10):(current.history||[]);
   const result=put('appearance','',{id:'public-appearance',...nextBase,history,updatedAt:now()});
   send(res,200,result);return true;
  }
  if(p==='/api/appearance/restore'&&method==='POST'){
   requireAdmin(user);
   const current=appearance(),target=(current.history||[]).find(item=>item.versionAt===b.versionAt);
   if(!target)fail(404,'Esa versión de la portada ya no está disponible.');
   const history=[appearanceSnapshot(current),...(current.history||[]).filter(item=>item.versionAt!==target.versionAt)].slice(0,10),result=put('appearance','',{id:'public-appearance',title:target.title,subtitle:target.subtitle,photos:(target.photos||[]).map(photo=>({...photo})),history,updatedAt:now()});
   send(res,200,result);return true;
  }
  return false;
 }
 return {route,appearance,publicMedia};
}
