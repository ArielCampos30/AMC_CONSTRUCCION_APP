from pathlib import Path

path=Path('web-amc/server.mjs')
text=path.read_text()

if "import {chatFeatures} from './chat-core.mjs';" not in text:
    text=text.replace("import {createAuthCore} from './auth-core.mjs';\n","import {createAuthCore} from './auth-core.mjs';\nimport {chatFeatures} from './chat-core.mjs';\n",1)

start=text.index(" const clientChatIds=user=>")
end=text.index(" const mediaAccess=mediaAccessFeatures",start)
replacement=""" const chat=chatFeatures({db,all,get,put,own,safeFile,notify,notifyAdmins,send,fail,text,now,sha,markNoticesForRoute});
 const {clientChatIds,chatOwn,chatSummary,staffMessages,staffUnread,staffReadByEmployee,staffReadByAdmin}=chat;
"""
text=text[:start]+replacement+text[end:]

needle="if(method==='GET'&&/^\\/api\\/requests\\/[^/]+\\/messages$/.test(p)){"
start=text.index(needle)
end=text.index("const b=p==='/api/upload'",start)
text=text[:start]+"if(chat.routeBeforeBody({p,method,user,url,res}))return;"+text[end:]

start=text.index("    if(method==='POST'&&/^\\/api\\/requests\\/[^/]+\\/messages\\/read$/.test(p)){"
end=text.index("    if(user.role==='employee'&&/^\\/api\\/requests\\/[^/]+\\/messages(?:\\/read)?$/.test(p))",start)
text=text[:start]+"    if(chat.routeAfterBody({p,method,b,user,url,res}))return;\n"+text[end:]

path.write_text(text)
