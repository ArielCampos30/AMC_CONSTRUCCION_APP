from pathlib import Path

path=Path('web-amc/server.mjs')
text=path.read_text()

old_import="import {chatFeatures} from './chat-core.mjs';\n"
new_import=old_import+"import {clientRequestFeatures} from './client-requests.mjs';\n"
if "import {clientRequestFeatures} from './client-requests.mjs';" not in text:
    if old_import not in text:
        raise SystemExit('No se encontró el punto de importación')
    text=text.replace(old_import,new_import,1)

normalize="const normalizePhone=v=>{let phone=text(v).replace(/\\D/g,'');if(phone.startsWith('54'))phone=phone.slice(2);if(phone.startsWith('9')&&phone.length>=11)phone=phone.slice(1);if(phone.startsWith('0'))phone=phone.slice(1);if(phone.startsWith('15'))phone=phone.slice(2);return phone;};\n"
if normalize not in text:
    raise SystemExit('No se encontró normalizePhone')
text=text.replace(normalize,'',1)

anchor=" const handleFeature=featureRoutes({db,all,get,put,transaction,own,chatOwn,requireAdmin,safeFile,notify,notifyAdmins,send,fail,text,amount,validDate,now,id,sha,planning,markNoticesForRoute});\n"
insert=" const clientRequests=clientRequestFeatures({db,all,get,put,transaction,requireAdmin,safeFile,notify,notifyAdmins,send,fail,text,validDate,now,id,services,serviceCatalog,planning});\n"
if insert not in text:
    if anchor not in text:
        raise SystemExit('No se encontró inicialización de featureRoutes')
    text=text.replace(anchor,insert+anchor,1)

client_start="    if(method==='POST'&&/^\\/api\\/clients\\/[^/]+\\/archive$/.test(p)){"
client_end="    if(authentication.logout({p,method,user,session,b,res}))return;"
start=text.find(client_start)
end=text.find(client_end,start)
if start<0 or end<0:
    raise SystemExit('No se encontró bloque de clientes')
route="    if(await clientRequests.route({p,method,b,user,res}))return;\n"
text=text[:start]+route+text[end:]

request_start="    if(method==='POST'&&p==='/api/requests'){"
quote_start="    if(method==='POST'&&p==='/api/quotes'){"
start=text.find(request_start)
end=text.find(quote_start,start)
if start<0 or end<0:
    raise SystemExit('No se encontró bloque de solicitudes')
text=text[:start]+text[end:]

path.write_text(text)

test_path=Path('web-amc/tests/admin-ui.test.mjs')
test=test_path.read_text()
old="const [app,directory,team,bridge,index,server,features,planning,closure,clientDialogs]=await Promise.all(["
new="const [app,directory,team,bridge,index,server,clientRequests,features,planning,closure,clientDialogs]=await Promise.all(["
if old not in test:
    raise SystemExit('No se encontró lista de fuentes del test Admin')
test=test.replace(old,new,1)
old="    readFile(new URL('../server.mjs',import.meta.url),'utf8'),\n    readFile(new URL('../public/features-ui.js',import.meta.url),'utf8'),"
new="    readFile(new URL('../server.mjs',import.meta.url),'utf8'),\n    readFile(new URL('../client-requests.mjs',import.meta.url),'utf8'),\n    readFile(new URL('../public/features-ui.js',import.meta.url),'utf8'),"
if old not in test:
    raise SystemExit('No se encontró lectura de server en test Admin')
test=test.replace(old,new,1)
old="  assert.match(server,/\\/api\\\\\\/admin\\\\\\/clients\\\\\\/\\[\\^\\/\\]\\+\\\\\\/profile/);"
new="  assert.match(clientRequests,/\\/api\\\\\\/admin\\\\\\/clients\\\\\\/\\(\\[\\^\\/\\]\\+\\)\\\\\\/profile/);\n  assert.match(server,/clientRequestFeatures/);"
if old not in test:
    raise SystemExit('No se encontró aserción de ruta cliente en test Admin')
test=test.replace(old,new,1)
test_path.write_text(test)
