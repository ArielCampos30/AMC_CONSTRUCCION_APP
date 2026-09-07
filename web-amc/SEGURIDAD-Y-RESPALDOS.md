# Revisión de seguridad — AMC

Revisión del 4 de septiembre de 2026. No equivale a una auditoría independiente ni garantiza ausencia de fallos.

## Verificado y reforzado

- La auditoría de las dependencias de producción encontró **0 vulnerabilidades conocidas**. `package-lock.json` conserva las versiones verificadas; la integración continua vuelve a ejecutar la auditoría.
- Las contraseñas se guardan mediante scrypt con sal individual. Las sesiones usan cookies HttpOnly, SameSite y Secure con HTTPS.
- Las operaciones requieren sesión y protección contra solicitudes desde otros sitios. Hay límites de intentos de acceso y recuperación.
- Los enlaces de recuperación vencen a los 15 minutos, son de un solo uso y revocan las sesiones y dispositivos al cambiar la contraseña. Generar un enlace manual requiere nuevamente la contraseña del administrador.
- Las pruebas comprueban aislamiento entre clientes, empleados y fotos privadas. Los empleados sólo acceden a conversaciones de asignaciones vigentes. El chat de cliente se habilita después del precio, continúa si acepta y termina al finalizar la obra o rechazar el presupuesto.
- La conexión a PostgreSQL verifica el certificado TLS. No se desactivó esa verificación.

## Respaldo completo cifrado

`backup-cli.mjs` incluye cuentas, solicitudes, presupuestos, conversaciones, fotos, configuración interna y demás registros de negocio. Usa AES-256-GCM y una clave derivada con scrypt. Detecta una clave incorrecta, alteraciones, reordenamientos y archivos truncados.

No incluye sesiones, enlaces de recuperación, registros de dispositivos ni colas de notificaciones: después de restaurar hay que iniciar sesión y habilitar avisos otra vez. Tampoco incluye las variables privadas de Render, la credencial de Firebase ni el certificado de conexión; deben conservarse por separado y con acceso restringido.

La clave se proporciona mediante **AMC_BACKUP_PASSWORD**, de 16 a 200 caracteres. Guardarla en un gestor de contraseñas, separada del archivo. No escribirla en el repositorio, en capturas ni en el chat. Sin esa clave no se puede recuperar la copia.

Comandos para el operador, desde la carpeta del servidor:

```text
node backup-cli.mjs export /ruta/externa/amc-fecha.amcbak
node backup-cli.mjs verify /ruta/externa/amc-fecha.amcbak
node backup-cli.mjs restore /ruta/externa/amc-fecha.amcbak /ruta/base-nueva.sqlite
```

Para restaurar PostgreSQL se usa **AMC_RESTORE_DATABASE_URL** hacia una base vacía y el certificado correspondiente en **AMC_DATABASE_CA_FILE**. La herramienta rechaza destinos con datos. Restaurar con la aplicación detenida y primero en un entorno de prueba. No cambiar la dirección de producción hasta verificar cuentas, archivos y datos recuperados.

## Pendiente de activar en producción

La creación y restauración se probaron con datos de prueba. **Todavía no se configuraron copias automáticas ni se generó un respaldo real de Supabase.** Falta elegir un destino privado fuera de Render, configurar la clave y la ejecución periódica, y probar una recuperación de esa copia real. Una copia en el disco temporal de Render no es suficiente.

Antes de ampliar el uso: activar doble factor en GitHub, Google/Firebase, Supabase y Render; revisar quién accede a esas cuentas; configurar y probar el correo de recuperación; preparar firma estable de Android y documentos de privacidad. La app todavía no tiene doble factor propio para administradores.

El chat usa HTTPS y permisos de servidor; **no tiene cifrado de extremo a extremo**. La revisión no incluyó una prueba de intrusión externa ni una prueba de carga de producción.
