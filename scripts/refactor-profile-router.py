from pathlib import Path

path=Path('web-amc/server.mjs')
text=path.read_text()

import_anchor="import {adminUtilityRoutes} from './admin-utility-routes.mjs';\n"
profile_import="import {profileRoutes} from './profile-routes.mjs';\n"
if profile_import not in text:
    if import_anchor not in text:
        raise SystemExit('No se encontró el import de adminUtilityRoutes')
    text=text.replace(import_anchor,import_anchor+profile_import,1)

init_anchor=" const handleAdminUtility=adminUtilityRoutes({all,get,put,requireAdmin,safeFile,send,fail,text,sha,now});\n"
profile_init=" const handleProfile=profileRoutes({db,put,send,fail,text});\n"
if profile_init not in text:
    if init_anchor not in text:
        raise SystemExit('No se encontró la inicialización de adminUtilityRoutes')
    text=text.replace(init_anchor,init_anchor+profile_init,1)

old="    if(method==='POST'&&p==='/api/profile'){if(!text(b.name))fail(400,'El nombre es obligatorio.');db.prepare('UPDATE users SET name=?,phone=?,town=?,sound=? WHERE id=?').run(text(b.name),text(b.phone),text(b.town),b.sound?1:0,user.id);if(user.role==='client')put('clientProfile',user.id,{id:'profile-'+user.id,userId:user.id,address:text(b.address,500)});return send(res,200,{ok:true});}\n"
new="    if(handleProfile({p,method,b,user,res}))return;\n"
if old not in text:
    raise SystemExit('No se encontró la ruta /api/profile exacta')
text=text.replace(old,new,1)
path.write_text(text)
