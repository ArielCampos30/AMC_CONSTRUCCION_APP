from pathlib import Path

path=Path('web-amc/server.mjs')
source=path.read_text(encoding='utf-8')

old_import="import {deviceRoutes} from './device-routes.mjs';\n"
new_import=old_import+"import {publicSystemRoutes} from './public-system-routes.mjs';\n"
if "import {publicSystemRoutes} from './public-system-routes.mjs';" not in source:
    if old_import not in source:
        raise SystemExit('No se encontró el import de dispositivos')
    source=source.replace(old_import,new_import,1)

anchor=" const handleDevices=deviceRoutes({db,transaction,sha,fail,validSubscription,send});\n"
handler=anchor+" const handlePublicSystem=publicSystemRoutes({db,remoteUrl,version,recentErrorCount,backupHealth,startedAt,demo,keys,services,send});\n"
if 'const handlePublicSystem=publicSystemRoutes(' not in source:
    if anchor not in source:
        raise SystemExit('No se encontró el handler de dispositivos')
    source=source.replace(anchor,handler,1)

old="   if((p==='/health'||p==='/healthz')&&method==='GET'){const before=Date.now();db.prepare('SELECT 1 AS ok').get();return send(res,200,{ok:true,database:'available',driver:remoteUrl?'postgresql':'sqlite',databaseMs:Date.now()-before,version,errors5xx15m:recentErrorCount(),...backupHealth(),uptimeSeconds:Math.floor((Date.now()-startedAt)/1000)});}\n   if(p==='/api/config')return send(res,200,{demo,webPushKey:keys.publicKey,services,version});\n"
new="   if(handlePublicSystem({p,method,res}))return;\n"
if new not in source:
    if old not in source:
        raise SystemExit('No se encontraron las rutas públicas de sistema')
    source=source.replace(old,new,1)

path.write_text(source,encoding='utf-8')
