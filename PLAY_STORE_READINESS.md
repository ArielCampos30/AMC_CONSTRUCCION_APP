# AMC Construcciones — Play Store Readiness

Fecha de auditoría: 2026-09-17

## Estado técnico

- Paquete: `com.amc.construcciones`.
- Android mínimo: API 29.
- Android objetivo: API 36.
- Compilación: API 36.
- AAB y APK release firmados por CI.
- Firebase Cloud Messaging integrado.
- Tráfico HTTP no cifrado deshabilitado.
- Backup Android de la app deshabilitado.
- La app usa un WebView seguro como shell Android y carga la aplicación AMC por HTTPS.

## Requisitos de Google Play cubiertos en código

- Target Android 16 / API 36 para envíos posteriores al 31 de agosto de 2026.
- Política de privacidad pública: `https://amc-construcciones.onrender.com/privacidad.html`.
- Recurso web de eliminación de cuenta: `https://amc-construcciones.onrender.com/eliminar-cuenta.html`.
- Ruta autenticada dentro de AMC para solicitar eliminación de cuenta.
- La solicitud web no borra cuentas sin verificar identidad y no revela si un correo tiene una cuenta registrada.
- Política de privacidad accesible desde el perfil dentro de la app.

## Pendientes de Play Console

Estos puntos no se resuelven únicamente con código y deben completarse en Play Console antes de producción:

1. Crear/confirmar la cuenta de desarrollador y completar la verificación requerida por Google.
2. Crear la aplicación con el paquete `com.amc.construcciones`.
3. Confirmar que `versionCode 7` no haya sido utilizado antes en ningún track de esa aplicación. Si ya fue utilizado, incrementarlo antes de subir el AAB.
4. Completar la ficha de Play Store: nombre, descripción corta, descripción completa, icono, gráfico destacado y capturas reales.
5. Cargar la URL pública de política de privacidad.
6. Declarar la URL pública de eliminación de cuenta.
7. Completar Seguridad de los datos de acuerdo con las prácticas reales de AMC.
8. Completar Público objetivo y contenido.
9. Declarar correctamente si la aplicación contiene anuncios. AMC no incorpora SDK publicitario actualmente.
10. Completar Clasificación de contenido.
11. Proporcionar credenciales reutilizables de revisión para que Google pueda recorrer las funciones que requieren acceso. Deben mantenerse activas durante la revisión.
12. Si la cuenta de desarrollador es una cuenta personal creada después del 13 de noviembre de 2023, completar la prueba cerrada exigida por Google antes de solicitar acceso a producción.

## Borrador de Seguridad de los datos

Debe verificarse nuevamente al completar Play Console. AMC trata actualmente, según la función utilizada:

- Información personal: nombre, correo, teléfono, localidad y dirección ingresada por el usuario.
- Contenido del usuario: solicitudes, mensajes, fotos, archivos y documentación de obra.
- Información comercial: presupuestos, obras, materiales, comprobantes y registros relacionados con el servicio.
- Identificadores técnicos: sesión, dispositivo y token de notificaciones.
- Datos técnicos de seguridad/diagnóstico necesarios para funcionamiento y prevención de abuso.

AMC no solicita permisos Android para contactos, SMS, llamadas ni ubicación precisa del dispositivo.

Proveedores técnicos utilizados actualmente:

- Render: infraestructura de aplicación y base de datos según la configuración de producción.
- Supabase: almacenamiento de archivos cuando corresponde.
- Google Firebase: notificaciones push.
- Resend: correo transaccional de recuperación de acceso cuando está configurado.

La declaración de Seguridad de los datos debe coincidir con la política de privacidad y revisarse cada vez que cambie la arquitectura o se agregue un SDK.

## Eliminación de cuenta

AMC permite iniciar el pedido desde el perfil del cliente y desde un recurso web público. El pedido queda pendiente para verificación y procesamiento. Antes del lanzamiento público debe mantenerse un procedimiento operativo real para:

- verificar identidad;
- desactivar acceso y sesiones cuando se procesa la eliminación;
- eliminar o anonimizar datos que ya no deban conservarse;
- conservar únicamente documentación que tenga una obligación legal, contractual, contable, antifraude o de defensa de derechos;
- dejar constancia del procesamiento sin conservar información innecesaria.

No debe marcarse una solicitud como resuelta si el procedimiento anterior no fue ejecutado.

## Referencias oficiales revisadas

- Requisito de API objetivo: https://support.google.com/googleplay/android-developer/answer/11926878
- SDK Android 16: https://developer.android.com/about/versions/16/setup-sdk
- Eliminación de cuentas: https://support.google.com/googleplay/android-developer/answer/13327111
- Datos de usuario / privacidad: https://support.google.com/googleplay/android-developer/answer/10144311
- Acceso para revisión: https://support.google.com/googleplay/android-developer/answer/9859455
- Pruebas para nuevas cuentas personales: https://support.google.com/googleplay/android-developer/answer/14151465
