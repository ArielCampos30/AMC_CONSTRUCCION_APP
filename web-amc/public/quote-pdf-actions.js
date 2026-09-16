let implementationPromise;
const loadQuotePdfActions=()=>implementationPromise||(implementationPromise=import('./quote-pdf-actions-impl.js'));

export async function downloadQuotePdf(quote){
 const implementation=await loadQuotePdfActions();
 return implementation.downloadQuotePdf(quote);
}

export async function shareQuotePdf(quote){
 const implementation=await loadQuotePdfActions();
 return implementation.shareQuotePdf(quote);
}
