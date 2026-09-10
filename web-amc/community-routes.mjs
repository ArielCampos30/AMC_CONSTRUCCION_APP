export function communityRoutes({db,all,get,put,requireAdmin,safeFile,notifyAdmins,send,fail,text,services,now,id}){
 return function route({p,method,b,user,res}){
  if(method==='POST'&&p==='/api/favorites'){
   get('post',b.postId);const key=user.id+':'+b.postId,old=db.prepare('SELECT id FROM docs WHERE id=?').get(key);if(old)db.prepare('DELETE FROM docs WHERE id=?').run(key);else put('favorite',user.id,{id:key,postId:b.postId});send(res,200,{ok:true});return true;
  }
  if(method==='POST'&&p==='/api/posts'){
   requireAdmin(user);if(!text(b.title)||!text(b.description)||!text(b.town)||!services.includes(b.service))fail(400,'Completá la publicación.');const image=safeFile(user,b.photoId,'image/'),before=b.beforeId?safeFile(user,b.beforeId,'image/'):null,post=put('post','',{id:id(),title:text(b.title),description:text(b.description,4000),town:text(b.town),service:b.service,date:now(),image,before,demo:false});send(res,201,post);return true;
  }
  if(method==='DELETE'&&/^\/api\/posts\/[^/]+$/.test(p)){
   requireAdmin(user);db.prepare("DELETE FROM docs WHERE id=? AND kind='post'").run(p.split('/')[3]);send(res,200,{ok:true});return true;
  }
  if(method==='GET'&&p==='/api/reviews/pending'){
   requireAdmin(user);send(res,200,{pendingReviews:all('review').filter(r=>!r.approved)});return true;
  }
  if(method==='POST'&&p==='/api/reviews'){
   if(user.role!=='client')fail(403,'Ingresá con una cuenta de cliente para escribir una reseña.');if(!all('work',user.id).some(w=>w.status==='Finalizado'))fail(409,'Podés dejar una reseña después de confirmar el cierre de una obra.');if(![1,2,3,4,5].includes(Number(b.rating))||text(b.text).length<10)fail(400,'Completá la calificación y al menos 10 caracteres.');const previous=all('review',user.id)[0],review=put('review',user.id,{id:previous?.id||'review-'+user.id,userId:user.id,name:user.name,rating:Number(b.rating),text:text(b.text,1500),date:now(),approved:false});notifyAdmins(previous?'Reseña actualizada':'Nueva reseña','Hay una reseña pendiente de revisión.','/#resenas');send(res,previous?200:201,review);return true;
  }
  if(method==='POST'&&/^\/api\/reviews\/[^/]+\/approve$/.test(p)){
   requireAdmin(user);const review=get('review',p.split('/')[3]);put('review',review.userId,{...review,approved:true});send(res,200,{ok:true});return true;
  }
  if(method==='POST'&&p==='/api/referrals'){
   if(!text(b.name))fail(400,'Ingresá un nombre.');put('referral',user.id,{id:id(),name:text(b.name),note:text(b.note,1000),date:now()});send(res,201,{ok:true});return true;
  }
  return false;
 };
}
