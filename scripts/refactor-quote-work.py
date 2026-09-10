from pathlib import Path

path=Path('web-amc/server.mjs')
text=path.read_text()

old_import="import {quoteLifecycle} from './quote-lifecycle.mjs';\n"
new_import=old_import+"import {quoteWorkRoutes} from './quote-work-routes.mjs';\n"
if "import {quoteWorkRoutes} from './quote-work-routes.mjs';" not in text:
    if old_import not in text:
        raise SystemExit('No se encontró quoteLifecycle import')
    text=text.replace(old_import,new_import,1)

anchor=" const clientRequests=clientRequestFeatures({db,all,get,put,transaction,requireAdmin,safeFile,notify,notifyAdmins,send,fail,text,validDate,now,id,services,serviceCatalog,planning});\n"
insert=" const handleQuoteWork=quoteWorkRoutes({db,all,get,put,transaction,own,requireAdmin,safeFile,notify,notifyAdmins,send,fail,text,amount,optionalAmount,validDate,now,id,sha,lifecycle});\n"
if insert not in text:
    if anchor not in text:
        raise SystemExit('No se encontró inicialización de clientRequests')
    text=text.replace(anchor,anchor+insert,1)

start_marker="    if(method==='POST'&&p==='/api/quotes'){"
end_marker="    if(method==='POST'&&p==='/api/posts'){"
start=text.find(start_marker)
end=text.find(end_marker,start)
if start<0 or end<0:
    raise SystemExit('No se encontró bloque de presupuestos/obras')
replacement="    if(await handleQuoteWork({p,method,b,user,res}))return;\n"
text=text[:start]+replacement+text[end:]

path.write_text(text)
