from pathlib import Path

server_path=Path('web-amc/server.mjs')
text=server_path.read_text()

import_anchor="import {profileRoutes} from './profile-routes.mjs';\n"
route_import="import {mediaUploadRoutes} from './media-upload-routes.mjs';\n"
if route_import not in text:
    if import_anchor not in text: raise SystemExit('No se encontró el import de profileRoutes')
    text=text.replace(import_anchor,import_anchor+route_import,1)

init_anchor=" const handleProfile=profileRoutes({db,put,send,fail,text});\n"
route_init=" const handleMediaUpload=mediaUploadRoutes({mediaStorage,send});\n"
if route_init not in text:
    if init_anchor not in text: raise SystemExit('No se encontró la inicialización de profileRoutes')
    text=text.replace(init_anchor,init_anchor+route_init,1)

old="    if(method==='POST'&&p==='/api/upload')return send(res,201,await mediaStorage.upload(user,b));\n"
new="    if(await handleMediaUpload({p,method,b,user,res}))return;\n"
if old not in text: raise SystemExit('No se encontró la ruta /api/upload exacta')
text=text.replace(old,new,1)
server_path.write_text(text)

test_path=Path('web-amc/tests/media-upload.test.mjs')
test=test_path.read_text()
old_head=" const [server,storage]=await Promise.all([\n  readFile(new URL('../server.mjs',import.meta.url),'utf8'),\n  readFile(new URL('../media-storage.mjs',import.meta.url),'utf8')\n ]);"
new_head=" const [server,storage,uploadRoutes]=await Promise.all([\n  readFile(new URL('../server.mjs',import.meta.url),'utf8'),\n  readFile(new URL('../media-storage.mjs',import.meta.url),'utf8'),\n  readFile(new URL('../media-upload-routes.mjs',import.meta.url),'utf8')\n ]);"
if old_head not in test: raise SystemExit('No se encontró la cabecera de la prueba de media storage')
test=test.replace(old_head,new_head,1)
old_assert=" assert.match(server,/mediaStorage\\.upload\\(user,b\\)/);"
new_assert=" assert.match(server,/from '.\\/media-upload-routes\\.mjs'/);\n assert.match(server,/mediaUploadRoutes\\(\\{mediaStorage,send\\}\\)/);\n assert.match(server,/handleMediaUpload\\(\\{p,method,b,user,res\\}\\)/);\n assert.match(uploadRoutes,/mediaStorage\\.upload\\(user,b\\)/);\n assert.doesNotMatch(server,/mediaStorage\\.upload\\(user,b\\)/);"
if old_assert not in test: raise SystemExit('No se encontró la aserción inline de mediaStorage.upload')
test=test.replace(old_assert,new_assert,1)
test_path.write_text(test)
