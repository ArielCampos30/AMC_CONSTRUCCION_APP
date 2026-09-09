export async function createAndAttach({quoteId,document,makePdf,blobToBase64,request}){
 if(!quoteId||typeof makePdf!=='function'||typeof blobToBase64!=='function'||typeof request!=='function')throw Error('No se pudo preparar el PDF del presupuesto.');
 const blob=await makePdf(document),uploaded=await request('/api/upload',{mime:'application/pdf',base64:await blobToBase64(blob)});
 return request('/api/quotes/'+quoteId+'/pdf',{pdfId:uploaded.id});
}
