from pathlib import Path
import re

path=Path('web-amc/server.mjs')
source=path.read_text(encoding='utf-8')

old_import="import {publicSystemRoutes} from './public-system-routes.mjs';\n"
new_import=old_import+"import {estimatorPageRoutes} from './estimator-page-routes.mjs';\n"
if "import {estimatorPageRoutes} from './estimator-page-routes.mjs';" not in source:
    if old_import not in source:
        raise SystemExit('No se encontró el import de rutas públicas')
    source=source.replace(old_import,new_import,1)

anchor=" const handlePublicSystem=publicSystemRoutes({db,remoteUrl,version,recentErrorCount,backupHealth,startedAt,demo,keys,services,send});\n"
handler=anchor+" const handleEstimatorPage=estimatorPageRoutes({ROOT,all,requireAdmin,readFileSync,path});\n"
if 'const handleEstimatorPage=estimatorPageRoutes(' not in source:
    if anchor not in source:
        raise SystemExit('No se encontró el handler de rutas públicas')
    source=source.replace(anchor,handler,1)

replacement="   if(handleEstimatorPage({p,method,user,session,res}))return;\n"
if replacement not in source:
    pattern=r"^   if\(p==='/presupuestos'\)\{.*?res\.end\(html\);\}\n"
    source,count=re.subn(pattern,replacement,source,count=1,flags=re.M)
    if count!=1:
        raise SystemExit(f'No se pudo reemplazar la página del cotizador: {count}')

path.write_text(source,encoding='utf-8')
