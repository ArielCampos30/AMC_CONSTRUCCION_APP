# AMC · Render + Supabase

La aplicación ya usa `main` como rama de producción y Render sirve `web-amc`. Esta guía documenta la conexión PostgreSQL/Supabase y el paso siguiente de almacenamiento externo.

## PostgreSQL

Render recibe `AMC_DATABASE_URL` mediante Environment. La URI debe ser la conexión PostgreSQL/pooler del proyecto, no la URL pública `https://*.supabase.co`.

El servidor crea y usa el esquema privado `amc_data`. No usa Supabase Auth ni expone credenciales PostgreSQL al navegador o a la APK.

TLS debe validarse. Si el proveedor necesita una CA específica, usar `AMC_DATABASE_CA_FILE`; no desactivar la verificación TLS.

## Seguridad Administrador

El doble factor TOTP necesita además `AMC_2FA_KEY`, un secreto de servidor largo y aleatorio que no debe guardarse en Git. Una vez configurado, el Administrador puede activar Authenticator desde Perfil. AMC entrega 8 códigos de recuperación de un solo uso.

## Archivos

Actualmente la ruta principal de fotos/PDF sigue siendo la tabla `files` de PostgreSQL para conservar compatibilidad. El servidor ya elimina de forma conservadora uploads nuevos que quedaron huérfanos durante más de siete días.

La migración completa de archivos a Object Storage queda separada para no poner en riesgo los archivos existentes. Antes de retirar BYTEA debe hacerse dual-write, migración verificada y fallback de lectura.

## Backup externo preparado

`backup-supabase.mjs` permite guardar el backup cifrado fuera de la base usando un bucket privado de Supabase Storage.

Variables del job de backup:

- `AMC_DATABASE_URL`
- `AMC_BACKUP_PASSWORD`
- `AMC_SUPABASE_URL`
- `AMC_SUPABASE_SERVICE_ROLE_KEY`
- `AMC_BACKUP_BUCKET` (por defecto `amc-backups`)
- `AMC_BACKUP_RETENTION_DAYS` (por defecto 30)

El script exporta, verifica criptográficamente, sube y luego elimina únicamente copias externas más antiguas que la retención configurada.

No poner la service-role key en el servicio Web si sólo la necesita un cron de backup; usar variables privadas exclusivas del job programado.

## Límite actual

El puente PostgreSQL conserva una API síncrona de compatibilidad. Es adecuado para el volumen piloto/actual, pero una futura etapa de escala debe convertir servicios de datos a I/O asíncrono y mover los BLOB a Object Storage después de una migración comprobada.
