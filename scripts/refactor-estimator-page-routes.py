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

test_path=Path('web-amc/tests/admin-ui.test.mjs')
tests=test_path.read_text(encoding='utf-8')

old="const [app,directory,team,bridge,index,server,clientRequests,features,planning,closure,clientDialogs]=await Promise.all(["
new="const [app,directory,team,bridge,index,server,estimatorPage,clientRequests,features,planning,closure,clientDialogs]=await Promise.all(["
if old in tests:
    tests=tests.replace(old,new,1)
    tests=tests.replace("    readFile(new URL('../server.mjs',import.meta.url),'utf8'),\n    readFile(new URL('../client-requests.mjs',import.meta.url),'utf8'),","    readFile(new URL('../server.mjs',import.meta.url),'utf8'),\n    readFile(new URL('../estimator-page-routes.mjs',import.meta.url),'utf8'),\n    readFile(new URL('../client-requests.mjs',import.meta.url),'utf8'),",1)

old="const [app,bridge,index,server,busy,pdf]=await Promise.all(["
new="const [app,bridge,index,server,estimatorPage,busy,pdf]=await Promise.all(["
if old in tests:
    tests=tests.replace(old,new,1)
    marker="    readFile(new URL('../server.mjs',import.meta.url),'utf8'),\n    readFile(new URL('../public/amc-busy.js',import.meta.url),'utf8'),"
    replacement_marker="    readFile(new URL('../server.mjs',import.meta.url),'utf8'),\n    readFile(new URL('../estimator-page-routes.mjs',import.meta.url),'utf8'),\n    readFile(new URL('../public/amc-busy.js',import.meta.url),'utf8'),"
    if marker not in tests:
        raise SystemExit('No se encontró el bloque de prueba del spinner')
    tests=tests.replace(marker,replacement_marker,1)

if "assert.match(server,/amc-confirm\\.js/);" in tests:
    tests=tests.replace("assert.match(server,/amc-confirm\\.js/);","assert.match(estimatorPage,/amc-confirm\\.js/);",1)
if "assert.match(server,/amc-busy\\.js/);" in tests:
    tests=tests.replace("assert.match(server,/amc-busy\\.js/);","assert.match(estimatorPage,/amc-busy\\.js/);",1)

if "assert.match(estimatorPage,/amc-confirm\\.js/);" not in tests or "assert.match(estimatorPage,/amc-busy\\.js/);" not in tests:
    raise SystemExit('No se pudieron actualizar las aserciones del cotizador')

test_path.write_text(tests,encoding='utf-8')
