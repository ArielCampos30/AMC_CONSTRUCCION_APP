from pathlib import Path

path=Path('web-amc/server.mjs')
text=path.read_text()

import_anchor="import {stateRoutes} from './state-routes.mjs';\n"
community_import="import {communityRoutes} from './community-routes.mjs';\n"
if community_import not in text:
    if import_anchor not in text:
        raise SystemExit('No se encontró el import de stateRoutes')
    text=text.replace(import_anchor,import_anchor+community_import,1)

init_anchor=" const handleState=stateRoutes({db,all,userView,chatSummary,planning,services,serviceCatalog,team,fieldwork,recovery,closure,staffMessages,staffUnread,staffReadByAdmin,staffReadByEmployee,canAccessWork,employeeWork,clientChatIds,publicQuote,publicWork,systemStatus,twoFactor,lifecycle,beginStateSnapshot,endStateSnapshot,send});\n"
community_init=" const handleCommunity=communityRoutes({db,all,get,put,requireAdmin,safeFile,notifyAdmins,send,fail,text,services,now,id});\n"
if community_init not in text:
    if init_anchor not in text:
        raise SystemExit('No se encontró la inicialización de stateRoutes')
    text=text.replace(init_anchor,init_anchor+community_init,1)

start_marker="    if(method==='POST'&&p==='/api/favorites'){"
end_marker="    if(notificationRoutes({p,method,b,user,res}))return;\n"
start=text.find(start_marker)
end=text.find(end_marker,start)
if start<0 or end<0:
    raise SystemExit('No se encontró el bloque de comunidad')
quote_line="    if(await handleQuoteWork({p,method,b,user,res}))return;\n"
block=text[start:end]
if quote_line not in block:
    raise SystemExit('No se encontró handleQuoteWork dentro del bloque')
replacement=quote_line+"    if(handleCommunity({p,method,b,user,res}))return;\n"
text=text[:start]+replacement+text[end:]

path.write_text(text)
