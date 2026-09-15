# AMC — Recuperación ante desastre

Este documento describe el procedimiento operativo de recuperación de AMC. No reemplaza un backup independiente en otro proveedor ni garantiza un tiempo de recuperación fijo.

## Estado de protección

- Base principal: PostgreSQL de Supabase.
- Aplicación y cron de backup: Render.
- Backup lógico propio: cifrado AES-256-GCM mediante `secure-backup.mjs`.
- Frecuencia actual: una ejecución diaria del cron `AMC Backup` a las 06:00 UTC.
- Destino actual: bucket privado `amc-backups` de Supabase Storage.
- Retención por defecto: 30 días, configurable con `AMC_BACKUP_RETENTION_DAYS`.
- Monitor: `/healthz` informa antigüedad y estado del backup y de la última restauración verificada.

## Qué se considera un backup sano

Un archivo no queda validado solamente porque se haya podido crear o descifrar. El cron debe completar todas estas etapas:

1. exportar la base en una transacción consistente;
2. verificar el archivo cifrado local;
3. subirlo al bucket privado;
4. volver a descargar exactamente el objeto subido;
5. restaurarlo en una base SQLite temporal y vacía, aislada de producción;
6. comparar cantidad de usuarios, documentos, archivos, configuración y bytes multimedia con el origen;
7. recién entonces registrar `backupStatus=ok` y `backupRestoreStatus=ok`.

Si falla cualquiera de estas etapas, el cron termina con error y el monitor de producción debe alertar.

## Contenido recuperable

El backup incluye:

- usuarios y roles;
- documentos de negocio: solicitudes, presupuestos, obras, mensajes y configuración relacionada;
- archivos guardados en la tabla `files`, incluidos los bytes de fotos y documentos;
- configuración persistida en la base.

No incluye:

- sesiones activas;
- dispositivos registrados para notificaciones;
- enlaces temporales de recuperación;
- colas de entrega;
- secretos de Render, Firebase o Supabase;
- claves privadas o certificados almacenados como variables de entorno.

Después de una recuperación, los usuarios deben iniciar sesión nuevamente y los dispositivos pueden necesitar volver a registrar notificaciones.

## Procedimiento: fallo de código

Si la base está íntegra y el problema apareció después de un deploy:

1. no restaurar la base;
2. identificar el último SHA sano;
3. desplegar ese SHA en Render;
4. comprobar `GET /healthz`, portada, login y un flujo corto de negocio;
5. revisar logs y 5xx.

Restaurar datos para corregir un fallo puramente de código puede causar pérdida innecesaria de información nueva.

## Procedimiento: corrupción o pérdida lógica de la base

1. detener o impedir nuevas escrituras antes de iniciar la recuperación;
2. identificar la última copia con `backupRestoreStatus=ok`;
3. descargar esa copia cifrada sin modificarla;
4. verificarla con `backup-cli.mjs verify`;
5. restaurarla únicamente sobre una base vacía o un entorno aislado;
6. comparar usuarios, documentos, archivos y datos críticos;
7. probar login, presupuesto, chat y apertura de multimedia;
8. sólo después de validar la copia, cambiar la conexión de AMC hacia la base recuperada;
9. desplegar y comprobar `/healthz` y los logs;
10. documentar el punto de recuperación utilizado y la ventana potencial de datos perdidos.

Ejemplo de restauración local aislada:

```text
node backup-cli.mjs verify /ruta/amc-fecha.amcbak
node backup-cli.mjs restore /ruta/amc-fecha.amcbak /ruta/amc-recuperada.sqlite
```

Para PostgreSQL, `AMC_RESTORE_DATABASE_URL` debe apuntar exclusivamente a una base vacía. La herramienta rechaza una base con datos.

## RPO y RTO

Con la frecuencia actual, el objetivo práctico de pérdida máxima de datos es de aproximadamente un día. El monitor alerta cuando el último backup o la última restauración verificada superan 30 horas.

No se declara un RTO fijo: el tiempo de recuperación depende del tamaño de la copia, la disponibilidad de Supabase/Render y las comprobaciones posteriores.

## Riesgo residual importante: pérdida completa del proyecto Supabase

El backup propio está fuera de Render, pero actualmente el bucket `amc-backups` pertenece al mismo proyecto Supabase que aloja PostgreSQL y Object Storage. Esto protege frente a corrupción lógica de la base y muchos fallos de aplicación, pero **no es una copia independiente frente a eliminación total del proyecto, pérdida de la cuenta o un incidente que afecte simultáneamente base y Storage del proyecto**.

Por lo tanto, no debe considerarse cerrada la protección contra pérdida total del proveedor hasta mantener una segunda copia cifrada en una cuenta o proveedor independiente. Esa segunda copia debe conservarse sin exponer `AMC_BACKUP_PASSWORD` y debe someterse también a una prueba de restauración.

## Controles de plataforma requeridos

- Render producción debe usar `/healthz` como Health Check Path.
- `main` debe estar protegido mediante ruleset/branch protection: cambios por PR, controles de CI obligatorios, sin force-push ni borrado de rama.
- Los secretos del backup y las credenciales de infraestructura deben mantenerse fuera del repositorio y separados del archivo cifrado.
