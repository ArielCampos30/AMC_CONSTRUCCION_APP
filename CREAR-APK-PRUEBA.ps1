$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
Write-Host 'AMC - Crear APK de prueba'
if (-not (Get-Command java -ErrorAction SilentlyContinue)) { throw 'Falta Java/JDK 17. Instalalo y agrega su carpeta bin al PATH.' }
if (-not (Get-Command gradle -ErrorAction SilentlyContinue)) { throw 'Falta Gradle 8.11.1. Instalalo y agrega su carpeta bin al PATH.' }
if (-not $env:ANDROID_HOME -and -not $env:ANDROID_SDK_ROOT) { throw 'Falta indicar ANDROID_HOME con la carpeta del SDK Android 35.' }
if (-not $env:AMC_SERVER_URL) { $env:AMC_SERVER_URL = Read-Host 'Direccion HTTPS del servidor AMC (sin barra final)' }
$amcUri = $null
if (-not [Uri]::TryCreate($env:AMC_SERVER_URL, [UriKind]::Absolute, [ref]$amcUri) -or $amcUri.Scheme -ne 'https' -or $amcUri.AbsolutePath -ne '/' -or $amcUri.Query -or $amcUri.Fragment -or $amcUri.UserInfo) { throw 'Usa el origen HTTPS de AMC, sin rutas, parametros ni credenciales.' }
$env:AMC_SERVER_URL = $env:AMC_SERVER_URL.TrimEnd('/')
& gradle --no-daemon :app:assembleDebug
if ($LASTEXITCODE -ne 0) { throw 'La compilacion fallo. No se genero una nueva APK para entregar.' }
Copy-Item -LiteralPath 'app/build/outputs/apk/debug/app-debug.apk' -Destination 'AMC-prueba.apk' -Force
Write-Host 'APK creada: AMC-prueba.apk. Version de prueba; no distribuir como version definitiva.'
