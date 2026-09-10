from pathlib import Path
import re

path=Path('web-amc/server.mjs')
source=path.read_text(encoding='utf-8')

old_import="import {mediaUploadRoutes} from './media-upload-routes.mjs';\n"
new_import=old_import+"import {deviceRoutes} from './device-routes.mjs';\n"
if "import {deviceRoutes} from './device-routes.mjs';" not in source:
    if old_import not in source:
        raise SystemExit('No se encontró el import de media upload')
    source=source.replace(old_import,new_import,1)

anchor=" const handleMediaUpload=mediaUploadRoutes({mediaStorage,send});\n"
handler=anchor+" const handleDevices=deviceRoutes({db,transaction,sha,fail,validSubscription,send});\n"
if 'const handleDevices=deviceRoutes(' not in source:
    if anchor not in source:
        raise SystemExit('No se encontró el handler de media upload')
    source=source.replace(anchor,handler,1)

pattern=r"^    if\(method==='POST'&&p==='/api/devices'\)\{.*?return send\(res,200,\{deviceId:key\}\);\}\n"
replacement="    if(handleDevices({p,method,b,user,res}))return;\n"
if replacement not in source:
    source,count=re.subn(pattern,replacement,source,count=1,flags=re.M)
    if count!=1:
        raise SystemExit(f'No se pudo reemplazar la ruta de dispositivos: {count}')

path.write_text(source,encoding='utf-8')
