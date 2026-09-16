let implementationPromise;
const loadPaymentPdf=()=>implementationPromise||(implementationPromise=import('./payment-pdf-impl.js'));

export async function paymentDocument(state,workId){
 const implementation=await loadPaymentPdf();
 return implementation.paymentDocument(state,workId);
}

export async function downloadPaymentDocument(state,workId){
 const implementation=await loadPaymentPdf();
 return implementation.downloadPaymentDocument(state,workId);
}
