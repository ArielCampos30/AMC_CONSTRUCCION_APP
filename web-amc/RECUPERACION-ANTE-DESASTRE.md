# AMC — Recuperación ante desastre

Este documento describe el procedimiento operativo de recuperación de AMC. No garantiza un tiempo de recuperación fijo.

## Estado de protección

- Base principal: PostgreSQL de Supabase.
- Aplicación y cron de backup: Render.
- Backup lógico propio: cifrado AES-256-GCM mediante `secure-backup.mjs`.
- Frecuencia actual: una ejecución diaria del cron `AMC Backup` a las 06:00 UTC.
- Destino primario: bucket privado `amc-backups` de Supabase Storage.
- Destino secundario independiente: bucket privado `amc-backups-secondary` de Cloudflare R2.
- Retención por defecto: 30 días, configurable con `AMC_BACKUP_RETENTION_DAYS`.
- Monitor: `/healthz` informa por separado el estado y antigüedad de ambas copias y de sus restauraciones verificadas.

## Qué se considera un backup sano

Un archivo no queda validado solamente porque se haya podido crear o descifrar. El cron debe completar estas etapas:

1. exportar la base en una transacción consistente;
2. verificar localmente el archivo cifrado;
3. subir el mismo archivo a Supabase y Cloudflare R2;
4. volver a descargar exactamente el objeto recién subido desde cada proveedor;
5. restaurar cada descarga en una base SQLite temporal, vacía y aislada;
6. comparar cantidad de usuarios, documentos, archivos, configuración y bytes multimedia con el origen;
7. registrar el estado de cada proveedor únicamente después de esa verificación.

Los dos destinos se intentan de forma independiente. Si uno falla, el cron sigue intentando el otro y conserva en el monitor cuál proveedor quedó sano. Aun así, la ejecución finaliza con error para generar una alerta operativa.

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
- secretos de Render, Firebase, Supabase o Cloudflare;
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
2. identificar la última copia con restauración verificada `ok` en cualquiera de los dos proveedores;
3. preferir la copia más reciente que haya completado la verificación de restauración;
4. descargar esa copia cifrada sin modificarla;
5. verificarla con `backup-cli.mjs verify`;
6. restaurarla únicamente sobre una base vacía o un entorno aislado;
7. comparar usuarios, documentos, archivos y datos críticos;
8. probar login, presupuesto, chat y apertura de multimedia;
9. sólo después de validar la copia, cambiar la conexión de AMC hacia la base recuperada;
10. desplegar y comprobar `/healthz` y los logs;
11. documentar el punto de recuperación utilizado y la ventana potencial de datos perdidos.

Ejemplo de restauración local aislada:

```text
node backup-cli.mjs verify /ruta/amc-fecha.amcbak
node backup-cli.mjs restore /ruta/amc-fecha.amcbak /ruta/amc-recuperada.sqlite
```

Para PostgreSQL, `AMC_RESTORE_DATABASE_URL` debe apuntar exclusivamente a una base vacía. La herramienta rechaza una base con datos.

## Procedimiento: pérdida completa del proyecto Supabase

Si el proyecto Supabase deja de existir o no permite recuperar ni PostgreSQL ni su bucket:

1. no crear escrituras nuevas hasta definir el punto de recuperación;
2. usar Cloudflare R2 como fuente externa independiente;
3. seleccionar el último objeto de `amc-backups-secondary` cuyo estado de restauración haya sido verificado;
4. descargar el `.amcbak` manteniendo intacto el archivo cifrado;
5. recuperar `AMC_BACKUP_PASSWORD` desde su almacenamiento seguro independiente;
6. verificar y restaurar el backup sobre una base vacía;
7. aprovisionar una nueva base PostgreSQL y, si corresponde, un nuevo almacenamiento de archivos;
8. cargar la copia restaurada y configurar las nuevas credenciales en Render;
9. validar login, clientes, presupuestos, obras, chat, fotos y permisos;
10. recién entonces reabrir producción.

Las credenciales S3 de R2 sirven para acceder al bucket pero **no reemplazan `AMC_BACKUP_PASSWORD`**. Sin la contraseña de cifrado el contenido del `.amcbak` no puede recuperarse.

## Simulacro automatizado 9.6

El comando oficial es:

```text
npm run recovery:drill
```

Debe ejecutarse en un entorno aislado que tenga `AMC_BACKUP_PASSWORD` y acceso de lectura al bucket R2. El simulacro no escribe en producción ni modifica objetos de R2.

El comando:

1. lista `daily/` en R2 y elige el `.amcbak` válido más reciente;
2. descarga el objeto a un directorio temporal;
3. verifica cifrado, integridad y autenticación del archivo;
4. restaura en una SQLite nueva y aislada;
5. compara usuarios, documentos, archivos, configuración y bytes multimedia con el backup autenticado;
6. comprueba que sesiones, dispositivos, colas de delivery y recuperaciones temporales estén vacías, como exige el diseño;
7. cierra la fase de restauración y vuelve a abrir AMC usando únicamente la base recuperada;
8. valida `/`, `/api/config` y `/healthz`;
9. crea cuentas descartables únicamente dentro de esa copia temporal y prueba login para Administrador, Empleado y Cliente;
10. comprueba el rol devuelto por `/api/state` y que `/api/state/system` continúe restringido al Administrador;
11. destruye el directorio temporal incluso si una comprobación falla.

Las cuentas descartables del simulacro no sustituyen la comparación de los usuarios restaurados: primero se valida la paridad completa del backup y recién después se agregan las cuentas de prueba para ejercer el flujo de autenticación sin usar contraseñas reales.

## RPO y RTO

Con la frecuencia actual, el objetivo práctico de pérdida máxima de datos es de aproximadamente un día. El monitor alerta cuando cualquiera de las copias o restauraciones verificadas supera 30 horas.

El simulacro reporta dos métricas distintas:

- `observedRpoSeconds`: edad del último backup R2 al comenzar el ejercicio;
- `applicationRecoveryRtoSeconds`: tiempo desde el inicio del ejercicio hasta que la copia restaurada de AMC responde y supera las comprobaciones de aplicación.

El segundo valor es un **RTO de aplicación**, no un RTO total de desastre. No incluye crear un proveedor nuevo, configurar DNS, recuperar o rotar secretos, aprovisionar PostgreSQL ni esperar propagación externa. En un desastre real esos pasos deben sumarse al tiempo medido.

## Criterio de aceptación de 9.6

El simulacro sólo se considera exitoso si:

- el objeto proviene de R2 y es el backup diario válido más reciente;
- el backup se descifra y verifica sin alteraciones;
- todos los datos recuperables coinciden con el contenido autenticado;
- el estado operativo no recuperable vuelve vacío;
- AMC arranca sobre la copia aislada;
- portada, configuración, health, login y aislamiento por roles pasan;
- el proceso finaliza con `status: ok` y todas las claves de `checks` en `true`;
- no se realiza ninguna escritura sobre producción durante el ejercicio.

## Controles de plataforma requeridos

- Render producción usa `/healthz` como Health Check Path.
- `main` está protegida mediante branch protection: cambios por PR, controles de CI obligatorios, sin force-push ni borrado de rama.
- Los secretos del backup y las credenciales de infraestructura deben mantenerse fuera del repositorio y separados del archivo cifrado.
- El bucket de Cloudflare R2 debe permanecer privado y el token debe limitarse a lectura/escritura de objetos del bucket `amc-backups-secondary`.
