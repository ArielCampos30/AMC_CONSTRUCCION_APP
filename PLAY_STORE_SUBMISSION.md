# AMC Construcciones — Paquete de envío a Google Play

Fecha de preparación: 2026-09-18

## Identidad de la ficha

- Nombre de la app: `AMC Construcciones`
- Paquete Android: `com.amc.construcciones`
- Versión preparada: `1.0.2`
- `versionCode`: `9`
- Correo público del desarrollador: `contacto@amcconstrucciones.com.ar`
- Sitio web: `https://amcconstrucciones.com.ar`
- Política de privacidad: `https://amcconstrucciones.com.ar/privacidad.html`
- Términos de uso: `https://amcconstrucciones.com.ar/terminos.html`
- Eliminación de cuenta: `https://amcconstrucciones.com.ar/eliminar-cuenta.html`

## Texto de Play Store

### Descripción breve

Solicitudes, presupuestos, obras y comunicación directa con AMC.

### Descripción completa

AMC Construcciones reúne en una sola aplicación la comunicación y el seguimiento de los trabajos realizados con AMC.

Como cliente podés enviar una solicitud, recibir y revisar presupuestos, aceptar o rechazar propuestas, seguir el estado de una obra, consultar pagos y comprobantes, recibir avisos y mantener una comunicación directa con Administración.

La aplicación también permite compartir fotografías y documentación relacionada con los trabajos, descargar presupuestos en PDF y recibir notificaciones sobre novedades relevantes.

Para el equipo de AMC, la app incluye acceso por rol para gestionar solicitudes, clientes, presupuestos, obras, tareas, integrantes y comunicaciones internas de manera organizada.

Funciones principales:

- solicitudes de trabajos y visitas;
- presupuestos y documentos PDF;
- seguimiento de obras;
- avisos y notificaciones;
- chat con envío de imágenes;
- pagos y comprobantes vinculados al servicio;
- gestión del equipo y trabajos asignados;
- perfiles y permisos diferenciados para Cliente, Empleado y Administración.

AMC Construcciones utiliza conexiones seguras y cuenta con Política de Privacidad, Términos de uso, mecanismos de reporte y bloqueo en conversaciones, y solicitud de eliminación de cuenta.

La disponibilidad de cada función depende del rol y de la relación del usuario con AMC Construcciones.

## App Access — borrador para revisión de Google

Google debe poder acceder a todo contenido restringido durante la revisión. Las credenciales de revisión deben ser cuentas ficticias, reutilizables, activas durante toda la revisión y sin 2FA/OTP obligatorio.

Preparar como mínimo:

1. Cliente de revisión
   - correo: por definir
   - contraseña: por definir
   - debe poder acceder a Inicio, solicitudes, presupuesto/obra de demostración, chat y Perfil.
2. Empleado de revisión
   - correo: por definir
   - contraseña: por definir
   - debe poder acceder a trabajos asignados, perfil y chat con Administración.
3. Administrador de revisión
   - correo: por definir
   - contraseña: por definir
   - 2FA desactivado para esta cuenta de revisión.
   - debe poder acceder a solicitudes, presupuestos, obras, equipo, moderación y demás funciones administrativas.

Instrucciones sugeridas para Play Console (en inglés, como exige Google para los detalles de acceso):

`AMC Construcciones requires sign-in for role-specific functionality. Use the reusable demo credentials provided below. No OTP or two-factor code is required for these review accounts. Client access demonstrates requests, quotes, work tracking and customer chat. Employee access demonstrates assigned jobs and the internal Administration chat. Administrator access demonstrates management features, moderation and role-based administration.`

## Seguridad de los datos — borrador de declaración

AMC transmite datos fuera del dispositivo a través de su WebView controlado y sus servicios backend, por lo que deben declararse como recopilados cuando corresponda.

### Datos recopilados según uso

- Información personal
  - Nombre.
  - Dirección de correo electrónico.
  - Número de teléfono.
  - Dirección/localidad cuando el usuario la proporciona para una solicitud u obra.
- Mensajes
  - Otros mensajes dentro de la app: chat Cliente ↔ Administración y Empleado ↔ Administración.
- Fotos y vídeos
  - Fotos aportadas por usuarios en chats, obras, informes o documentación.
  - La aplicación no necesita declarar vídeos salvo que en el futuro se permita su carga.
- Archivos y documentos
  - Documentación y archivos aportados por usuarios cuando una función lo permita.
- Actividad de la app / contenido del servicio
  - Solicitudes, presupuestos, obras, tareas, reseñas, informes, pagos/comprobantes y estados vinculados al servicio.
- Identificadores técnicos
  - Sesión y token de notificaciones del dispositivo.
- Seguridad y moderación
  - Aceptación de Términos, reportes de contenido y bloqueos de conversación.

### Finalidades principales

- Funcionalidad de la app y prestación del servicio.
- Comunicación entre usuario y AMC.
- Gestión de cuenta.
- Seguridad, prevención de abuso y moderación.
- Notificaciones operativas.
- Soporte y recuperación de acceso cuando corresponda.

### Compartición

No marcar datos como “compartidos” solamente porque sean procesados por proveedores técnicos que actúan por cuenta de AMC, siempre que cumplan la definición de proveedor de servicio de Google Play. Revisar esta respuesta al completar Play Console y mantenerla coherente con la Política de Privacidad.

Proveedores actuales relevantes:

- Render: ejecución de la aplicación web/API.
- Supabase Virginia: PostgreSQL canónico de producción y almacenamiento de archivos cuando corresponde.
- Google Firebase: notificaciones push.
- Resend: correo transaccional de recuperación de acceso cuando está configurado.

## Contenido de la app / políticas

- Anuncios: `No`.
- Compras dentro de la app / suscripciones: `No` en la versión de lanzamiento actual.
- Público objetivo: aplicación de servicios y gestión de obras; no está diseñada específicamente para niños.
- UGC: `Sí`, limitado a mensajes, imágenes, reseñas e informes/documentación de usuarios.
- Medidas UGC implementadas:
  - Términos aceptados antes de aportar contenido;
  - reporte de mensajes/reseñas;
  - bloqueo/desbloqueo de chat 1:1;
  - bandeja de moderación administrativa;
  - aprobación previa de reseñas antes de publicación pública.
- Eliminación de cuenta: disponible dentro de la app y mediante recurso web público.

## Recursos gráficos pendientes

Antes de completar la ficha deben prepararse y revisar visualmente:

- icono Play Store PNG 512 × 512;
- feature graphic 1024 × 500;
- mínimo 2 capturas de pantalla válidas;
- objetivo interno: 4 a 6 capturas verticales reales de 1080 × 1920 o resolución equivalente compatible.

Capturas recomendadas:

1. Inicio de Cliente.
2. Presupuesto / detalle de presupuesto.
3. Seguimiento de obra.
4. Chat y comunicación con AMC.
5. Inicio de Administración.
6. Gestión de obra/equipo.

Las capturas deben usar información ficticia o anonimizada y no deben exponer datos reales de clientes, empleados, domicilios, comprobantes ni conversaciones privadas.

## Estado de la cuenta Play Console

- Cuenta personal de desarrollador creada.
- Nombre público del desarrollador: AMC Construcciones.
- Identidad: enviada a Google y pendiente de aprobación al momento de este documento.
- Dispositivo Android real: verificado.
- Teléfono de contacto: pendiente de verificación hasta que Google apruebe la identidad.
- Por tratarse de una cuenta personal nueva, revisar en la consola si Google exige prueba cerrada con 12 testers durante 14 días antes de producción.

## Regla de publicación

No enviar a revisión ni publicar en Producción hasta completar y revisar:

- verificación de identidad y teléfono;
- ficha de Play Store;
- recursos gráficos;
- Seguridad de los datos;
- Acceso a la app;
- Clasificación de contenido;
- Público objetivo;
- declaración de anuncios;
- política de privacidad y eliminación de cuenta;
- prueba cerrada obligatoria si la consola la exige;
- última prueba manual sobre el AAB final.
