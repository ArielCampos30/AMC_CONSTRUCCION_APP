let implementationPromise;
const loadQuotePdfActions=()=>implementationPromise||(implementationPromise=import('./quote-pdf-actions-impl.js'));

export async function downloadQuotePdf(quote){
 const implementation=await loadQuotePdfActions();
 return implementation.downloadQuotePdf(quote);
}

export async function shareQuotePdf(quote){
 const implementation=await loadQuotePdfActions();
 window.AMCBusy?.start();
 try{
  const blob=await implementation.pdfBlob(quote),name=implementation.pdfFileName(quote);
  if(window.AMCNative?.savePdf){window.AMCNative.savePdf(await implementation.blobBase64(blob),name,true);return;}
  const file=new File([blob],name,{type:'application/pdf'});
  if(navigator.share&&navigator.canShare?.({files:[file]})){await navigator.share({title:'Presupuesto AMC',text:quote?.number||'Presupuesto AMC',files:[file]});return;}
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
  await window.AMCConfirm('Tu navegador no permite compartir archivos PDF directamente. AMC descargó el PDF para que puedas adjuntarlo desde WhatsApp u otra aplicación.',{title:'PDF descargado',confirmLabel:'Entendido',singleAction:true});
 }finally{window.AMCBusy?.stop();}
}
