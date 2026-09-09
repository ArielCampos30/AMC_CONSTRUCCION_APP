# AMC Construcciones — operación y release

## Validación previa a desplegar

La rama de producción es `main`. Antes de cualquier deploy deben quedar verdes:

1. auditoría de dependencias;
2. suite completa con SQLite;
3. suite completa con PostgreSQL real;
4. recorrido de Chrome con login Administrador y Cliente, carga inicial y controles básicos de accesibilidad;
5. workflows Android cuando se modifica código Android.

El servicio Render tiene auto-deploy desactivado. Un push a `main` no publica por sí solo.

## Variables de producción

Obligatorias o según la función usada:

- `AMC_DATABASE_URL`: PostgreSQL de producción.
- `AMC_2FA_KEY`: secreto de servidor de al menos 24 caracteres para cifrar el TOTP Administrador.
- `AMC_FIREBASE_CREDENTIALS_JSON`: Firebase Cloud Messaging Android.
- credenciales Web Push/correo configuradas por el servidor.
- `AMC_ADMIN_EMAIL` y `AMC_ADMIN_PASSWORD`: sólo para crear el primer Administrador si la base todavía no tiene uno; retirarlas después del alta.

Nunca guardar valores de secretos en Git, logs, documentación o screenshots.

## Salud y diagnóstico

- `GET /healthz` valida proceso y consulta a la base.
- Las respuestas incluyen `X-Request-ID`.
- Los logs del servidor registran método, ruta, estado y duración, sin cuerpo privado.
- Administración → Más → Estado de AMC muestra versión desplegada, motor, cantidad de registros/archivos y dispositivos.

## Android release

El workflow **Compilar APK AMC** genera y firma APK/AAB. Requiere los GitHub Secrets de firma y `AMC_GOOGLE_SERVICES_B64`. Mantener el JKS original y sus contraseñas en dos ubicaciones privadas fuera del repositorio.

La WebView release sólo carga `BuildConfig.AMC_BACKEND_URL`; enlaces HTTP externos, teléfono, mail y geolocalización salen de la WebView. Los backups Android están deshabilitados para proteger sesiones.

## Respaldo y recuperación

`secure-backup.mjs` usa AES-256-GCM y valida cada frame. El backup contiene cuentas, documentos, configuración y archivos, pero no restaura sesiones ni dispositivos.

`backup-supabase.mjs` crea primero un backup cifrado, lo verifica y recién después lo sube a un bucket privado de Supabase Storage. Por defecto conserva 30 días; el valor se controla con `AMC_BACKUP_RETENTION_DAYS`.

Nunca restaurar sobre producción con datos. La herramienta de restauración exige una base vacía. Para rollback de código, volver al commit anterior; restaurar base solamente si una migración de datos realmente lo requiere.

## Publicación

Después de CI verde:

1. disparar manualmente el deploy de Render;
2. esperar estado `live`;
3. comprobar `/healthz`;
4. abrir producción en Chrome y verificar ingreso, navegación y versión;
5. probar un flujo de negocio breve;
6. si Android cambió, instalar el APK release generado y verificar notificación, deep-link, cámara y PDF.
