export function createAppShellInputController({
 documentRef=globalThis.document,
 onClientSearch=()=>{},
 onBudgetClientSearch=()=>{},
 setDirty=()=>{},
}={}){
 let attached=false;
 function handleInput(event){
  const target=event.target;
  if(target?.id==='client-search-input'){
   onClientSearch(target.value,target);
   setDirty(false);
   return;
  }
  if(target?.id==='budget-client-search'){
   onBudgetClientSearch(target);
   setDirty(false);
   return;
  }
  if(target?.id==='admin-global-search-input'){
   setDirty(false);
   return;
  }
  setDirty(true);
 }
 return {
  handleInput,
  attach(){
   if(attached)return;
   attached=true;
   documentRef.addEventListener('input',handleInput);
  }
 };
}
