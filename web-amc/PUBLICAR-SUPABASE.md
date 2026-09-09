# AMC · Render + Supabase

La aplicación ya usa `main` como rama de producción y Render sirve `web-amc`. Esta guía documenta la conexión PostgreSQL/Supabase y el paso siguiente de almacenamiento externo.

## PostgreSQL

Render recibe `AMC_DATABASE_URL` mediante Environment. La URI debe ser la conexión PostgreSQL/pooler del proyecto, no la URL pública `https://*.supabase.co`.

El servidor crea y usa el esquema privado `amc_data`. No usa Supabase Auth ni expone credenciales PostgreSQL al navegador o a la APK.

TLS debe validarse. Si el proveedor necesita una CA específica, usar `AMC_DATABASE_CA_FILE`; no desactivar la verificación TLS.

## Seguridad Administrador

El doble factor TOTP necesita además `AMC_2FA_KEY`, un secreto de servidor largo y aleatorio que no debe guardarse en Git. Una vez configurado, el Administrador puede activar Authenticator desde Perfil. AMC entrega 8 códigos de recuperación de un solo uso.

## Archivos

Actualmente la tabla `files` de PostgreSQL sigue siendo la copia compatible de fotos/PDF. Object Storage se activa de forma gradual y nunca expone una clave privilegiada al navegador o a la APK.

Variables del servicio Web para la etapa de Storage:

- `AMC_SUPABASE_URL`
- `AMC_SUPABASE_FILES_KEY`: clave secreta de servidor independiente de la del job de backup.
- `AMC_FILES_BUCKET` (por defecto `amc-files`)
- `AMC_FILE_STORAGE_MODE`: `off`, `mirror` o `prefer-storage`

Modos:

- `off`: comportamiento anterior; sólo PostgreSQL.
- `mirror`: cada upload aceptado se escribe primero en el bucket privado y luego en PostgreSQL. Las lecturas siguen saliendo de PostgreSQL.
- `prefer-storage`: mantiene dual-write y sirve desde Object Storage; si un objeto viejo todavía no fue migrado o Storage falla al leer, usa PostgreSQL como fallback.

El bucket `amc-files` debe permanecer privado, con máximo de 5 MB y sólo JPEG/PNG/WebP/PDF. Los clientes no reciben la clave de Storage ni acceden directamente al bucket: siguen usando `/media/:id`, donde AMC conserva su autorización por rol, cliente, empleado, obra y conversación.

La limpieza de uploads huérfanos conserva el plazo de siete días. Cuando Storage está activo, elimina primero la copia externa y sólo después borra la copia PostgreSQL, de modo que un fallo externo no deje a la base sin su archivo recuperable.

La migración de archivos históricos sigue separada. No retirar BYTEA hasta completar dual-write, una migración verificada, lectura `prefer-storage`, comparación de conteos/tamaños y una prueba de recuperación.

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
