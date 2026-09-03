# AMC · Crear APK de prueba

Estado: proyecto preparado; APK todavía no compilada. En el equipo de esta entrega no están JDK/Gradle/Android SDK y falló la conexión al servidor de descarga de Google.

1. Instalar JDK 17, Gradle 8.11.1 y Android SDK con plataforma 35 y build-tools 35.0.0, siguiendo README.md. Configurar PATH y ANDROID_HOME. Revisar y aceptar personalmente las licencias que correspondan.
2. Configurar una dirección HTTPS del servidor AMC. localhost no apunta a tu computadora desde el teléfono. Sin servidor no funcionan las cuentas, solicitudes ni presupuestos conectados.
3. Abrir PowerShell en esta carpeta y ejecutar ./CREAR-APK-PRUEBA.ps1. No cambiar políticas de seguridad del equipo para forzar la ejecución; si están bloqueados los scripts, seguir la compilación manual del README.
4. Si termina correctamente se obtiene AMC-prueba.apk. Es una compilación debug con identificador separado, para probar sin sustituir la aplicación anterior. Requiere Android 10 o posterior.
5. Copiar esa APK al teléfono y abrirla. Revisar el permiso de instalación desde esa fuente cuando Android lo solicite. Probar acceso, fotos, PDF y modo sin conexión.
6. Antes de distribuir a clientes y empleados, generar una APK release firmada, conservar la clave y comprobar notificaciones en celulares reales. La build debug no es la entrega definitiva.

Alternativa: los flujos GitHub Actions incluidos compilan el proyecto cuando se sube esta carpeta como raíz de un repositorio de tu cuenta y se configura AMC_SERVER_URL. La variante debug no exige la firma privada de publicación. Los flujos no se han ejecutado desde esta entrega.

No compartir contraseñas, claves privadas o bases de datos con el proyecto.
