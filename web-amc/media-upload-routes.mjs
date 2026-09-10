export function mediaUploadRoutes({mediaStorage,send}){
 return async function route({p,method,b,user,res}){
  if(method!=='POST'||p!=='/api/upload')return false;
  send(res,201,await mediaStorage.upload(user,b));return true;
 };
}
