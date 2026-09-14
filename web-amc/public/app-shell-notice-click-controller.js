export function createAppShellNoticeClickController({
 documentRef=globalThis.document,
 locationRef=globalThis.location,
 api=async()=>({}),
 applyNoticeRead=()=>{},
 onError=()=>{},
 createUrl=(value,base)=>new URL(value,base),
}={}){
 const handleClick=async event=>{
  const link=event.target.closest('[data-notice]');
  if(!link)return;
  event.preventDefault();
  if(link.dataset.reading==='1')return;
  link.dataset.reading='1';
  try{
   const result=await api('/api/notices/read',{id:link.dataset.notice});
   applyNoticeRead(result.noticeIds||[link.dataset.notice]);
   const target=createUrl(link.href,locationRef.href);
   locationRef.hash=target.hash||'#avisos';
  }catch(error){
   onError(error);
  }finally{
   delete link.dataset.reading;
  }
 };
 const attach=()=>documentRef.addEventListener('click',handleClick);
 return {attach,handleClick};
}
