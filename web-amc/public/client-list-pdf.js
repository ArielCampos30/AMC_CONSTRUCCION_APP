let implementationPromise;
const loadClientListPdf=()=>implementationPromise||(implementationPromise=import('./client-list-pdf-impl.js'));

export async function clientListPdf(rows,filter){
 const implementation=await loadClientListPdf();
 return implementation.clientListPdf(rows,filter);
}

export function downloadClients(rows,filter){
 return loadClientListPdf().then(implementation=>implementation.downloadClients(rows,filter));
}
