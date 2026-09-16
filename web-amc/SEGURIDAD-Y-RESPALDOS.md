# Revisión de seguridad — AMC

Estado operativo actualizado al 16 de septiembre de 2026. No equivale a una auditoría independiente ni garantiza ausencia de fallos.

## Verificado y reforzado

- La auditoría de las dependencias de producción encontró **0 vulnerabilidades conocidas**. `package-lock.json` conserva las versiones verificadas; la integración continua vuelve a ejecutar la auditoría.
- Las contraseñas se guardan mediante scrypt con sal individual. Las sesiones usan cookies HttpOnly, SameSite y Secure con HTTPS.
- Las operaciones requieren sesión y protección contra solicitudes desde otros sitios. Hay límites de intentos de acceso y recuperación.
- Los enlaces de recuperación vencen a los 15 minutos, son de un solo uso y revocan sesiones y dispositivos al cambiar la contraseña.
- El acceso Administrador dispone de segundo factor TOTP y su secreto se protege en servidor.
- Las pruebas comprueban aislamiento entre clientes, empleados y archivos privados.
- La conexión a PostgreSQL verifica el certificado TLS. No se desactivó esa verificación.

## Respaldo completo cifrado

`backup-cli.mjs` incluye cuentas, solicitudes, presupuestos, conversaciones, fotos, configuración interna y demás registros de negocio. Usa AES-256-GCM y una clave derivada con scrypt. Detecta una clave incorrecta, alteraciones, reordenamientos y archivos truncados.

No incluye sesiones, enlaces de recuperación, registros de dispositivos ni colas de notificaciones: después de restaurar hay que iniciar sesión y habilitar avisos otra vez. Tampoco incluye las variables privadas de Render, credenciales de Firebase/Supabase/R2 ni certificados de conexión; deben conservarse por separado y con acceso restringido.

La clave se proporciona mediante **AMC_BACKUP_PASSWORD**, de 16 a 200 caracteres. Debe guardarse separada del archivo cifrado y nunca escribirse en Git, logs, documentación, capturas ni chats.

Comandos para el operador, desde la carpeta del servidor:

```text
node backup-cli.mjs export /ruta/externa/amc-fecha.amcbak
node backup-cli.mjs verify /ruta/externa/amc-fecha.amcbak
node backup-cli.mjs restore /ruta/externa/amc-fecha.amcbak /ruta/base-nueva.sqlite
npm run recovery:drill
```

Para restaurar PostgreSQL se usa **AMC_RESTORE_DATABASE_URL** hacia una base vacía y el certificado correspondiente en **AMC_DATABASE_CA_FILE**. La herramienta rechaza destinos con datos.

## Estado actual de backups automáticos

Render ejecuta el cron **AMC Backup** diariamente a las 06:00 UTC. Cada ejecución crea una sola copia lógica cifrada y la envía a dos proveedores distintos:

1. bucket privado `amc-backups` de Supabase Storage;
2. bucket privado `amc-backups-secondary` de Cloudflare R2.

Ambos destinos usan la misma retención configurable mediante `AMC_BACKUP_RETENTION_DAYS` (30 días por defecto). Las credenciales de R2 viven exclusivamente en variables privadas del cron de Render: `AMC_R2_ENDPOINT`, `AMC_R2_BUCKET`, `AMC_R2_ACCESS_KEY_ID`, `AMC_R2_SECRET_ACCESS_KEY` y `AMC_R2_REGION`.

A partir del Bloque 9.5, cada proveedor se considera sano solamente si completa su propia prueba de recuperación:

1. se crea y verifica localmente el archivo cifrado;
2. se sube el mismo `.amcbak` a Supabase y R2;
3. cada proveedor vuelve a entregar el objeto recién subido;
4. cada descarga se restaura por separado en una base temporal vacía y aislada;
5. se comparan usuarios, documentos, archivos, configuración y bytes multimedia con el snapshot original;
6. recién entonces se registran como correctos los estados de backup y restauración de ese proveedor.

La falla de un proveedor no impide intentar el otro. El cron termina con error si cualquiera de las dos copias falla, para que el incidente no pase inadvertido aunque la otra copia haya quedado sana.

`/healthz` expone estados y antigüedad tanto de la copia primaria como de la secundaria. El monitor de producción alerta por fallo o por más de 30 horas sin una copia/restauración verificada en cualquiera de los dos destinos.

## Simulacro de recuperación 9.6

`disaster-recovery-drill.mjs` agrega una prueba operativa independiente del cron diario. Lee el último backup válido desde R2 y trabaja sólo con archivos y una base temporales.

El simulacro valida cifrado, paridad de datos, reinicio del estado operativo, arranque real de AMC, `/healthz`, configuración, login y separación de permisos Admin/Empleado/Cliente. Para ejercer autenticación sin utilizar contraseñas reales, crea cuentas descartables únicamente después de comprobar la integridad completa de la copia restaurada y las elimina junto con el entorno temporal al finalizar.

El reporte incluye:

- RPO observado: antigüedad del backup R2 más reciente al iniciar el ejercicio;
- RTO de aplicación: descarga, descifrado, restauración y aplicación lista con comprobaciones básicas.

Ese RTO no incluye aprovisionar nuevos proveedores, DNS, secretos ni infraestructura administrada. El procedimiento completo está en `RECUPERACION-ANTE-DESASTRE.md`.

## Independencia del segundo proveedor

Cloudflare R2 no reemplaza PostgreSQL, Supabase Storage ni Firebase. Su función en AMC es únicamente mantener una **segunda copia cifrada fuera del proyecto Supabase**. De esta manera, la eliminación total del proyecto Supabase no elimina también la única copia propia del negocio.

La contraseña `AMC_BACKUP_PASSWORD` no se guarda dentro de R2 ni dentro del archivo cifrado. Debe existir una copia segura de esa contraseña y de las credenciales operativas fuera de los proveedores que alojan el backup.

## Controles de plataforma

- Producción usa `/healthz` como Health Check Path nativo de Render.
- `main` está protegida con PR obligatorio, checks de CI requeridos y bloqueo de force-push/borrado.
- Las cuentas de GitHub, Firebase/Google, Supabase, Render y Cloudflare deben mantener 2FA y acceso mínimo necesario.

El chat usa HTTPS y permisos de servidor; **no tiene cifrado de extremo a extremo**. La revisión no equivale a una prueba de intrusión externa ni a una prueba de carga de producción.
