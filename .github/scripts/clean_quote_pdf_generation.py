from pathlib import Path
import subprocess

# Restore server exactly from staging so this refactor does not create a noisy line-ending diff.
subprocess.run(['git','checkout','origin/staging','--','web-amc/server.mjs'],check=True)

module=Path('web-amc/public/quote-pdf-generation.js')
module.write_text("""export async function createAndAttach({quoteId,document,makePdf,blobToBase64,request}){
 if(!quoteId||typeof makePdf!=='function'||typeof blobToBase64!=='function'||typeof request!=='function')throw Error('No se pudo preparar el PDF del presupuesto.');
 const blob=await makePdf(document),uploaded=await request('/api/upload',{mime:'application/pdf',base64:await blobToBase64(blob)});
 return request('/api/quotes/'+quoteId+'/pdf',{pdfId:uploaded.id});
}
""")

bridge=Path('web-amc/public/presupuestos-bridge.js')
b=bridge.read_text()
b=b.replace(" const quotePdfGeneration=window.AMCQuotePdfGeneration;if(!quotePdfGeneration)throw Error('No se cargó el módulo PDF de AMC.');\n"," const {createAndAttach}=await import('/quote-pdf-generation.js');\n",1)
b=b.replace('quotePdfGeneration.createAndAttach','createAndAttach')
bridge.write_text(b)

admin=Path('web-amc/tests/admin-ui.test.mjs')
a=admin.read_text()
a=a.replace("  const [app,features,bridge,generation,server]=await Promise.all([\n    readFile(new URL('../public/app.js',import.meta.url),'utf8'),\n    readFile(new URL('../public/features-ui.js',import.meta.url),'utf8'),\n    readFile(new URL('../public/presupuestos-bridge.js',import.meta.url),'utf8'),\n    readFile(new URL('../public/quote-pdf-generation.js',import.meta.url),'utf8'),\n    readFile(new URL('../server.mjs',import.meta.url),'utf8')\n  ]);","  const [app,features,bridge,generation]=await Promise.all([\n    readFile(new URL('../public/app.js',import.meta.url),'utf8'),\n    readFile(new URL('../public/features-ui.js',import.meta.url),'utf8'),\n    readFile(new URL('../public/presupuestos-bridge.js',import.meta.url),'utf8'),\n    readFile(new URL('../public/quote-pdf-generation.js',import.meta.url),'utf8')\n  ]);",1)
a=a.replace("  assert.match(bridge,/quotePdfGeneration\\.createAndAttach/);","  assert.match(bridge,/await import\\('\/quote-pdf-generation\\.js'\\)/);\n  assert.match(bridge,/createAndAttach/);",1)
a=a.replace("  assert.match(generation,/async function createAndAttach/);","  assert.match(generation,/export async function createAndAttach/);",1)
a=a.replace("  assert.match(server,/quote-pdf-generation\\.js.*presupuestos-bridge\\.js/s);\n",'',1)
admin.write_text(a)

fp=Path('web-amc/tests/final-price-contract.test.mjs')
f=fp.read_text().replace("assert.match(bridge,/quotePdfGeneration\\.createAndAttach\\(\\{quoteId:sent\\.id,document:quoteForDocument\\(draft\\),makePdf,blobToBase64,request\\}\\)/);","assert.match(bridge,/createAndAttach\\(\\{quoteId:sent\\.id,document:quoteForDocument\\(draft\\),makePdf,blobToBase64,request\\}\\)/);",1)
fp.write_text(f)
