from pathlib import Path

module = Path('web-amc/public/quote-pdf-generation.js')
module.write_text("""(function(){
 async function createAndAttach({quoteId,document,makePdf,blobToBase64,request}){
  if(!quoteId||typeof makePdf!=='function'||typeof blobToBase64!=='function'||typeof request!=='function')throw Error('No se pudo preparar el PDF del presupuesto.');
  const blob=await makePdf(document),uploaded=await request('/api/upload',{mime:'application/pdf',base64:await blobToBase64(blob)});
  return request('/api/quotes/'+quoteId+'/pdf',{pdfId:uploaded.id});
 }
 window.AMCQuotePdfGeneration=Object.freeze({createAndAttach});
})();
""")

bridge=Path('web-amc/public/presupuestos-bridge.js')
text=bridge.read_text()
anchor="(async function(){\n"
boot=" const quotePdfGeneration=window.AMCQuotePdfGeneration;if(!quotePdfGeneration)throw Error('No se cargó el módulo PDF de AMC.');\n"
if boot not in text:
    if anchor not in text: raise SystemExit('No se encontró inicio del bridge')
    text=text.replace(anchor,anchor+boot,1)
old="""     const blob=await makePdf(quoteForDocument(draft)),
           uploaded=await request('/api/upload',{mime:'application/pdf',base64:await blobToBase64(blob)}),
           attached=await request('/api/quotes/'+quoteId+'/pdf',{pdfId:uploaded.id});"""
new="""     const attached=await quotePdfGeneration.createAndAttach({quoteId,document:quoteForDocument(draft),makePdf,blobToBase64,request});"""
if old not in text: raise SystemExit('No se encontró generación de PDF pendiente')
text=text.replace(old,new,1)
old2="""let pdfPending=true;try{const blob=await makePdf(quoteForDocument(draft)),uploaded=await request('/api/upload',{mime:'application/pdf',base64:await blobToBase64(blob)});await request('/api/quotes/'+sent.id+'/pdf',{pdfId:uploaded.id});pdfPending=false;}catch(pdfError)"""
new2="""let pdfPending=true;try{await quotePdfGeneration.createAndAttach({quoteId:sent.id,document:quoteForDocument(draft),makePdf,blobToBase64,request});pdfPending=false;}catch(pdfError)"""
if old2 not in text: raise SystemExit('No se encontró generación de PDF al enviar')
text=text.replace(old2,new2,1)
bridge.write_text(text)

server=Path('web-amc/server.mjs')
s=server.read_text()
old_scripts='<script src="/pdf-logo.js"></script><script src="/estimator-sync.js"></script><script src="/presupuestos-bridge.js"></script>'
new_scripts='<script src="/pdf-logo.js"></script><script src="/estimator-sync.js"></script><script src="/quote-pdf-generation.js"></script><script src="/presupuestos-bridge.js"></script>'
if old_scripts not in s: raise SystemExit('No se encontró la inyección de scripts del cotizador')
server.write_text(s.replace(old_scripts,new_scripts,1))

test=Path('web-amc/tests/admin-ui.test.mjs')
t=test.read_text()
old_test="""test('pending PDF can be regenerated and returns to the exact quote',async()=>{
  const [app,features,bridge]=await Promise.all([
    readFile(new URL('../public/app.js',import.meta.url),'utf8'),
    readFile(new URL('../public/features-ui.js',import.meta.url),'utf8'),
    readFile(new URL('../public/presupuestos-bridge.js',import.meta.url),'utf8')
  ]);
  assert.match(app,/data-action=\"generate-pdf-admin\"/);
  assert.match(app,/features\\.generatePdf\\(b\\.dataset\\.id\\|\\|'',b\\.dataset\\.quote\\|\\|''\\)/);
  assert.match(features,/pdfJob=null/);
  assert.match(features,/function generatePdf\\(requestId='',quoteId=''\\)/);
  assert.match(features,/id='amc-pdf-generator'/);
  assert.match(features,/frame\\.hidden=true/);
  assert.match(features,/generatePdf=1/);
  assert.match(features,/amc:pdf-ready/);
  assert.match(features,/amc:pdf-error/);
  assert.match(features,/onPdfReady\\?\\.\\(data\\)/);
  assert.match(bridge,/async function generatePendingPdf\\(quoteId\\)/);
  assert.match(bridge,/makePdf\\(quoteForDocument\\(draft\\)\\)/);
  assert.match(bridge,/\\/api\\/quotes\\/'\\+quoteId\\+'\\/pdf/);
  assert.match(bridge,/type:'amc:pdf-ready'/);
  assert.match(bridge,/No pudimos generar el PDF/);
  assert.match(bridge,/type:'amc:pdf-error'/);
  assert.doesNotMatch(app,/<span>PDF pendiente<\\/span>/);
});"""
new_test="""test('pending PDF can be regenerated and returns to the exact quote',async()=>{
  const [app,features,bridge,generation,server]=await Promise.all([
    readFile(new URL('../public/app.js',import.meta.url),'utf8'),
    readFile(new URL('../public/features-ui.js',import.meta.url),'utf8'),
    readFile(new URL('../public/presupuestos-bridge.js',import.meta.url),'utf8'),
    readFile(new URL('../public/quote-pdf-generation.js',import.meta.url),'utf8'),
    readFile(new URL('../server.mjs',import.meta.url),'utf8')
  ]);
  assert.match(app,/data-action=\"generate-pdf-admin\"/);
  assert.match(app,/features\\.generatePdf\\(b\\.dataset\\.id\\|\\|'',b\\.dataset\\.quote\\|\\|''\\)/);
  assert.match(features,/pdfJob=null/);
  assert.match(features,/function generatePdf\\(requestId='',quoteId=''\\)/);
  assert.match(features,/id='amc-pdf-generator'/);
  assert.match(features,/frame\\.hidden=true/);
  assert.match(features,/generatePdf=1/);
  assert.match(features,/amc:pdf-ready/);
  assert.match(features,/amc:pdf-error/);
  assert.match(features,/onPdfReady\\?\\.\\(data\\)/);
  assert.match(bridge,/async function generatePendingPdf\\(quoteId\\)/);
  assert.match(bridge,/quotePdfGeneration\\.createAndAttach/);
  assert.match(generation,/async function createAndAttach/);
  assert.match(generation,/makePdf\\(document\\)/);
  assert.match(generation,/\\/api\\/upload/);
  assert.match(generation,/\\/api\\/quotes\\/'\\+quoteId\\+'\\/pdf/);
  assert.match(server,/quote-pdf-generation\\.js.*presupuestos-bridge\\.js/s);
  assert.match(bridge,/type:'amc:pdf-ready'/);
  assert.match(bridge,/No pudimos generar el PDF/);
  assert.match(bridge,/type:'amc:pdf-error'/);
  assert.doesNotMatch(app,/<span>PDF pendiente<\\/span>/);
  assert.equal((bridge.match(/makePdf\\(quoteForDocument\\(draft\\)\\)/g)||[]).length,0);
});"""
if old_test not in t: raise SystemExit('No se encontró el test de PDF pendiente')
test.write_text(t.replace(old_test,new_test,1))
