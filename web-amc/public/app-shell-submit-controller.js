export function createAppShellSubmitController({documentRef=document,serializeForm=form=>Object.fromEntries(new FormData(form)),onSubmit,onError=()=>{}}={}){
 let attached=false;
 const handler=async event=>{
  event.preventDefault();
  const form=event.target;
  if(!form.reportValidity())return;
  const data=serializeForm(form),submit=event.submitter;
  const buttons=[...form.querySelectorAll('button')];
  buttons.forEach(button=>button.disabled=true);
  try{
   await onSubmit(form,data,submit);
  }catch(error){
   onError(error);
  }finally{
   buttons.forEach(button=>button.disabled=false);
   if(form.classList.contains('message-form'))form.querySelector('button[type=submit]').textContent='Enviar mensaje';
  }
 };
 return {
  handler,
  attach(){
   if(attached)return;
   attached=true;
   documentRef.addEventListener('submit',handler);
  }
 };
}
