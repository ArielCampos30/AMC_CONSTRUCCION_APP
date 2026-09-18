# AMC Entry Worker

Bloque D.6A.3. Este Worker NO migra el backend: Render sigue siendo el origen real en `https://amc-o0xb.onrender.com`.

## Objetivo

- Si Render ya está despierto, `app.amcconstrucciones.com.ar` continúa hacia la app real sin demora artificial.
- Si Render no responde al chequeo corto de `/healthz`, Cloudflare devuelve de inmediato una pantalla AMC propia y liviana.
- Esa pantalla consulta `/_amc/wakeup-status`; cuando Render responde, muestra `Todo listo` y recarga la app.
- API, uploads, recursos, cookies, métodos HTTP y cuerpos se proxyean hacia Render. El loader sólo se usa para navegación HTML inicial en `/`.

## Seguridad

- El loader y `/_amc/wakeup-status` usan `Cache-Control: no-store`.
- El probe de wakeup no reenvía cookies, Authorization ni cuerpos del usuario.
- Las solicitudes normales sí se proxyean intactas para conservar sesiones, CSRF y uploads.
- El loader no depende de archivos de Render: HTML, CSS, SVG y JS están embebidos en el Worker.
- El origen técnico de Render no se muestra en el HTML del loader.

## Preview seguro

`wrangler.jsonc` NO contiene una route de producción. Está preparado para `workers.dev`/preview.

Antes del cutover se debe probar en preview:

1. `GET /` con Render despierto -> app real.
2. `GET /_amc/wakeup-status` -> JSON `ready`.
3. API GET/POST y cookies -> mismo comportamiento del origen.
4. Assets y `healthz` -> proxy directo.
5. Loader -> responsive, sin marca Render y sin loops.

## Producción

Para este caso debe usarse una **Worker Route**, porque Render sigue siendo un origen externo. La route esperada es:

`app.amcconstrucciones.com.ar/*`

La route requiere que el registro DNS `app` esté **Proxied** (nube naranja) en Cloudflare. El CNAME debe seguir apuntando al origen técnico actual de Render salvo que la configuración real de Cloudflare muestre otra cosa.

No usar Custom Domain para este bloque: el Worker no es todavía el backend/origen definitivo.

## Estado que debe registrarse antes del cutover

Antes de modificar Cloudflare, anotar o capturar:

- tipo de registro DNS de `app`;
- target exacto;
- estado DNS-only/Proxied;
- cualquier Worker Route existente sobre `app`;
- SSL/TLS actual.

No tocar `@`, `www`, MX, SPF, DKIM, DMARC, Resend ni otros subdominios.

## Rollback

Si aparece cualquier problema en producción:

1. eliminar/desactivar la Worker Route `app.amcconstrucciones.com.ar/*`;
2. restaurar el registro `app` al estado previo documentado (incluido DNS-only si así estaba);
3. conservar el CNAME original hacia Render;
4. comprobar `https://app.amcconstrucciones.com.ar/`, `/healthz` y `/api/config`.

Render NO debe eliminarse ni suspenderse durante este bloque.
