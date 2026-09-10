from pathlib import Path

path=Path('web-amc/server.mjs')
source=path.read_text(encoding='utf-8')

static_import="import {staticResponse} from './static-response.mjs';\n"
security_import="import {applyHttpSecurity} from './http-security.mjs';\n"
if security_import not in source:
    if static_import not in source:
        raise SystemExit('No se encontró el import de staticResponse')
    source=source.replace(static_import,static_import+security_import,1)

old_line="  const url=new URL(req.url,origin),p=url.pathname,method=req.method,estimatorPage=p==='/presupuestos';\n"
new_line="  const url=new URL(req.url,origin),p=url.pathname,method=req.method;\n"
if old_line in source:
    source=source.replace(old_line,new_line,1)
elif new_line not in source:
    raise SystemExit('No se encontró la declaración del router')

old_headers="""  if(origin.startsWith('https:'))res.setHeader('Strict-Transport-Security','max-age=31536000; includeSubDomains');
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','same-origin');
  res.setHeader('X-Frame-Options','SAMEORIGIN');
  res.setHeader('Cross-Origin-Opener-Policy','same-origin-allow-popups');
  res.setHeader('Cross-Origin-Resource-Policy','same-origin');
  res.setHeader('Permissions-Policy','camera=(self), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=()');
  res.setHeader('Content-Security-Policy',estimatorPage?"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'self'; frame-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; worker-src 'self'; manifest-src 'self'":"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'self'; frame-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; worker-src 'self'; manifest-src 'self'");
"""
new_headers="  applyHttpSecurity({res,origin,pathname:p});\n"
if old_headers in source:
    source=source.replace(old_headers,new_headers,1)
elif new_headers not in source:
    raise SystemExit('No se encontró el bloque de cabeceras HTTP')

path.write_text(source,encoding='utf-8')
