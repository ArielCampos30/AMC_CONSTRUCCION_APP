# Revisión de seguridad — AMC

Estado operativo actualizado al 15 de septiembre de 2026. No equivale a una auditoría independiente ni garantiza ausencia de fallos.

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

No incluye sesiones, enlaces de recuperación, registros de dispositivos ni colas de notificaciones: después de restaurar hay que iniciar sesión y habilitar avisos otra vez. Tampoco incluye las variables privadas de Render, credenciales de Firebase/Supabase ni certificados de conexión; deben conservarse por separado y con acceso restringido.

La clave se proporciona mediante **AMC_BACKUP_PASSWORD**, de 16 a 200 caracteres. Debe guardarse separada del archivo cifrado y nunca escribirse en Git, logs, documentación, capturas ni chats.

Comandos para el operador, desde la carpeta del servidor:

```text
node backup-cli.mjs export /ruta/externa/amc-fecha.amcbak
node backup-cli.mjs verify /ruta/externa/amc-fecha.amcbak
node backup-cli.mjs restore /ruta/externa/amc-fecha.amcbak /ruta/base-nueva.sqlite
```

Para restaurar PostgreSQL se usa **AMC_RESTORE_DATABASE_URL** hacia una base vacía y el certificado correspondiente en **AMC_DATABASE_CA_FILE**. La herramienta rechaza destinos con datos.

## Estado actual de backups automáticos

Render ejecuta el cron **AMC Backup** diariamente a las 06:00 UTC. La copia se cifra y se guarda en el bucket privado `amc-backups` de Supabase Storage, con retención configurable mediante `AMC_BACKUP_RETENTION_DAYS`.

A partir del Bloque 9.4, un backup sólo se considera recuperable si completa una prueba de restauración real:

1. se crea y verifica el archivo cifrado;
2. se sube al bucket privado;
3. se vuelve a descargar el objeto recién subido;
4. se restaura en una base temporal vacía y aislada;
5. se comparan usuarios, documentos, archivos, configuración y bytes multimedia con el origen;
6. recién entonces se registra `backupRestoreStatus=ok`.

`/healthz` expone la antigüedad del último backup correcto y de la última restauración verificada. El monitor de producción genera alerta si alguno supera 30 horas o si una ejecución falla.

## Riesgo residual

El bucket `amc-backups` está fuera de Render pero actualmente pertenece al mismo proyecto Supabase que PostgreSQL y Object Storage. Por eso la copia protege frente a corrupción lógica de la base y varios fallos operativos, pero no frente a eliminación total del proyecto Supabase o pérdida simultánea de la cuenta/proyecto.

Antes de declarar protección completa contra pérdida del proveedor, AMC debe mantener una **segunda copia cifrada en una cuenta o proveedor independiente** y probar también su restauración. El procedimiento detallado está en `RECUPERACION-ANTE-DESASTRE.md`.

## Controles de plataforma

- Producción debe configurar `/healthz` como Health Check Path nativo de Render.
- `main` debe quedar protegido con PR obligatorio, checks de CI requeridos y bloqueo de force-push/borrado.
- Las cuentas de GitHub, Firebase/Google, Supabase y Render deben mantener 2FA y acceso mínimo necesario.

El chat usa HTTPS y permisos de servidor; **no tiene cifrado de extremo a extremo**. La revisión no equivale a una prueba de intrusión externa ni a una prueba de carga de producción.
