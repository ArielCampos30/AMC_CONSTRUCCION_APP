/* Official AMC logo used by generated PDFs. */
const AMC_PDF_LOGO_URL='/assets/amc-logo-pdf.jpg';
var LOGO_W=260,LOGO_H=260;
let amcPdfLogoPromise;
async function loadPdfLogo(){
  if(!amcPdfLogoPromise)amcPdfLogoPromise=fetch(AMC_PDF_LOGO_URL,{cache:'force-cache'}).then(async response=>{
    if(!response.ok)throw Error('No se pudo cargar el logo oficial de AMC.');
    const bytes=new Uint8Array(await response.arrayBuffer());
    let binary='';
    for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
    return binary;
  });
  return amcPdfLogoPromise;
}
