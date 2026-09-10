from pathlib import Path

path=Path('web-amc/server.mjs')
text=path.read_text()

import_anchor="import {quoteWorkRoutes} from './quote-work-routes.mjs';\n"
state_import="import {stateRoutes} from './state-routes.mjs';\n"
if state_import not in text:
    if import_anchor not in text:
        raise SystemExit('No se encontró el import de quoteWorkRoutes')
    text=text.replace(import_anchor,import_anchor+state_import,1)

init_anchor=" const handleFeature=featureRoutes({db,all,get,put,transaction,own,chatOwn,requireAdmin,safeFile,notify,notifyAdmins,send,fail,text,amount,validDate,now,id,sha,planning,markNoticesForRoute});\n"
state_init=" const handleState=stateRoutes({db,all,userView,chatSummary,planning,services,serviceCatalog,team,fieldwork,recovery,closure,staffMessages,staffUnread,staffReadByAdmin,staffReadByEmployee,canAccessWork,employeeWork,clientChatIds,publicQuote,publicWork,systemStatus,twoFactor,lifecycle,beginStateSnapshot,endStateSnapshot,send});\n"
if state_init not in text:
    if init_anchor not in text:
        raise SystemExit('No se encontró la inicialización de featureRoutes')
    text=text.replace(init_anchor,init_anchor+state_init,1)

start="   if(p==='/api/state'&&method==='GET'){\n"
end="   if(await mediaAccess.serve({user,p,method,req,res}))return;\n"
start_i=text.find(start)
end_i=text.find(end,start_i)
if start_i<0 or end_i<0:
    raise SystemExit('No se encontró el bloque /api/state')
replacement="   if(handleState({p,method,user,session,res}))return;\n"
text=text[:start_i]+replacement+text[end_i:]

path.write_text(text)
