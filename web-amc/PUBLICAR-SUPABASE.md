# AMC en Render y Supabase · piloto

No desplegado todavía. Configuración preparada para un único servicio Free con datos externos. No usar Render Free con SQLite local.

## Configuración

Repositorio: ArielCampos30/AMC_CONSTRUCCION_APP. Rama: amc-servidor-supabase. Carpeta raíz del servicio: web-amc. Runtime Node 24. Build: npm install --omit=dev. Inicio: node server.mjs. Plan Free. El archivo render.yaml también describe esa configuración.

Secretos a cargar directamente en Environment de Render (nunca en chat ni GitHub):
- AMC_DATABASE_URL: URI de Supabase → Connect → Session pooler, puerto 5432, reemplazando el marcador de contraseña por la contraseña real codificada para URL. Sin parámetros SSL en la URI. La URL pública https://...supabase.co NO es esta conexión.
- AMC_ADMIN_EMAIL: tu correo de administrador.
- AMC_ADMIN_PASSWORD: contraseña nueva y única, al menos 12 caracteres. Se usa sólo al crear el primer administrador. Retirarla del entorno después del alta.

Se verifica TLS con el certificado del servidor. Si Supabase requiere su CA específica, subir el certificado oficial como archivo secreto y configurar AMC_DATABASE_CA_FILE. No desactivar la validación TLS para resolver errores.

AMC toma su dirección pública de RENDER_EXTERNAL_URL. No hace falta inventarla antes de crear el servicio. No se crea ningún usuario de demostración al iniciar sin --demo.

El primer arranque crea las tablas en el esquema privado amc_data. No usa las tablas ni los usuarios de Supabase Auth. Mantener ese esquema fuera de la API pública de Supabase. La app sigue controlando permisos por cuenta en el servidor; ninguna credencial PostgreSQL se envía al navegador ni a la APK.

## Alcance y límites

Esta adaptación de compatibilidad conserva las transacciones y los servicios existentes. El controlador realiza la conexión PostgreSQL en un hilo y conserva el contrato síncrono del servidor anterior; las consultas remotas hacen esperar al hilo principal. Es una solución de transición para un piloto pequeño, no una arquitectura para alta concurrencia. Medir tiempos con Supabase real antes de invitar clientes. No ejecutar varias réplicas.

Los archivos se guardan como BYTEA en PostgreSQL, no en el disco de Render ni en Supabase Storage. Hay un tope preventivo global de 150 MiB de archivos para el piloto, además del límite por cuenta. Los datos y el margen de la base también consumen espacio: revisar la cuota en Supabase. La siguiente mejora de escala es mover archivos a Storage y convertir los servicios a consultas asíncronas.

Si la base falla no hay guardado local alternativo ni confirmación falsa de éxito. Una interrupción puede requerir reiniciar Render. No reintentar pagos de forma manual sin revisar su estado; los endpoints que tienen referencia idempotente conservan esa protección.

El plan Free de Render puede dormirse y Supabase Free puede pausarse por inactividad. Los recordatorios y avisos no son puntuales mientras el servidor duerme. No prometer alertas inmediatas con esta configuración. Publicar inicialmente para prueba controlada.

Antes de uso habitual: respaldos y restauración verificados, recuperación por correo, Firebase/Web Push, privacidad y flujo de eliminación de cuentas; pruebas de acceso desde dos celulares y Android real. La migración de los datos locales no es automática y no se incluyó la base demo en GitHub.

Tras publicar: verificar primero ingreso de administrador, nuevo cliente, solicitud, PDF, aceptación, pago, archivo privado, reinicio, revocación de empleado e informe offline. Luego configurar AMC_SERVER_URL en GitHub con la URL Render, compilar la APK conectada y probarla. La APK anterior no cambia por publicar el servidor.
