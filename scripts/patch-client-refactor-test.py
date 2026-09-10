from pathlib import Path

path=Path('web-amc/tests/admin-ui.test.mjs')
text=path.read_text()
old="const [app,directory,team,bridge,index,server,features,planning,closure,clientDialogs]=await Promise.all(["
new="const [app,directory,team,bridge,index,server,clientRequests,features,planning,closure,clientDialogs]=await Promise.all(["
if old not in text:
    raise SystemExit('No se encontró lista de fuentes del test Admin')
text=text.replace(old,new,1)
old="    readFile(new URL('../server.mjs',import.meta.url),'utf8'),\n    readFile(new URL('../public/features-ui.js',import.meta.url),'utf8'),"
new="    readFile(new URL('../server.mjs',import.meta.url),'utf8'),\n    readFile(new URL('../client-requests.mjs',import.meta.url),'utf8'),\n    readFile(new URL('../public/features-ui.js',import.meta.url),'utf8'),"
if old not in text:
    raise SystemExit('No se encontró lectura de server en test Admin')
text=text.replace(old,new,1)
old="  assert.match(server,/\\/api\\\\\\/admin\\\\\\/clients\\\\\\/\\[\\^\\/\\]\\+\\\\\\/profile/);"
new="  assert.match(clientRequests,/\\/api\\\\\\/admin\\\\\\/clients\\\\\\/\\(\\[\\^\\/\\]\\+\\)\\\\\\/profile/);\n  assert.match(server,/clientRequestFeatures/);"
if old not in text:
    raise SystemExit('No se encontró aserción de ruta cliente en test Admin')
text=text.replace(old,new,1)
path.write_text(text)
