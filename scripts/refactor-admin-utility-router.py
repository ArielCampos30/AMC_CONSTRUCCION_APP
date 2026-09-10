from pathlib import Path

path=Path('web-amc/server.mjs')
text=path.read_text()

import_anchor="import {communityRoutes} from './community-routes.mjs';\n"
utility_import="import {adminUtilityRoutes} from './admin-utility-routes.mjs';\n"
if utility_import not in text:
    if import_anchor not in text:
        raise SystemExit('No se encontró el import de communityRoutes')
    text=text.replace(import_anchor,import_anchor+utility_import,1)

init_anchor=" const handleCommunity=communityRoutes({db,all,get,put,requireAdmin,safeFile,notifyAdmins,send,fail,text,services,now,id});\n"
utility_init=" const handleAdminUtility=adminUtilityRoutes({all,get,put,requireAdmin,safeFile,send,fail,text,sha,now});\n"
if utility_init not in text:
    if init_anchor not in text:
        raise SystemExit('No se encontró la inicialización de communityRoutes')
    text=text.replace(init_anchor,init_anchor+utility_init,1)

start_marker="    if(p==='/api/offline-notes'&&method==='POST'){"
end_marker="    if(await planning.route({p,method,b,user,res}))return;\n"
start=text.find(start_marker)
end=text.find(end_marker,start)
if start<0 or end<0:
    raise SystemExit('No se encontró el bloque de utilidades administrativas')
replacement="    if(handleAdminUtility({p,method,b,user,res}))return;\n"
text=text[:start]+replacement+text[end:]
path.write_text(text)
