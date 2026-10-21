<#
.SYNOPSIS
  Compila VoyCorriendo localmente (gratis, sin cola de EAS).

.EXAMPLE
  npm run build:aab            # AAB firmado para subir a Google Play
  npm run build:aab -- -Bump   # sube versionCode antes de compilar
  npm run build:apk            # APK firmado para instalar/probar a mano
#>
param(
    [switch]$Apk,
    [switch]$Bump,
    [switch]$SkipPrebuild
)

# 'Continue': en PS 5.1 el stderr de gradle/npx dispara un error terminante bajo 'Stop'.
# Cada paso valida $LASTEXITCODE explicitamente, asi que no perdemos deteccion de fallos.
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Fail($msg) { Write-Host ""; Write-Host "ERROR: $msg" -ForegroundColor Red; exit 1 }
function Step($msg) { Write-Host ""; Write-Host ">> $msg" -ForegroundColor Cyan }

# ---------------------------------------------------------------- 1. JDK
Step "Verificando JDK"
$jdk = "C:\Program Files\Android\Android Studio\jbr"
if (-not (Test-Path "$jdk\bin\java.exe")) {
    Fail "No encontré el JDK en '$jdk'. Instala Android Studio o edita esta ruta en scripts/build-aab.ps1."
}
$env:JAVA_HOME = $jdk
$env:PATH = "$jdk\bin;$env:PATH"
$javaVer = (Select-String -Path "$jdk\release" -Pattern '^JAVA_VERSION=').Line
if (-not $javaVer) { $javaVer = "JAVA_VERSION=(no pude leerla)" }
Write-Host "   $javaVer"

# ---------------------------------------------------------------- 2. Android SDK
Step "Verificando Android SDK"
if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk" }
if (-not (Test-Path $env:ANDROID_HOME)) { Fail "No encontré el Android SDK en '$env:ANDROID_HOME'." }
Write-Host "   $env:ANDROID_HOME"

# ---------------------------------------------------------------- 3. Credenciales de firma
Step "Verificando credenciales de firma"
$gp = "$env:USERPROFILE\.gradle\gradle.properties"
if (-not (Test-Path $gp)) { Fail "No existe '$gp'. Corre primero: npm run setup:firma" }

$props = @{}
Get-Content $gp | ForEach-Object {
    if ($_ -match '^\s*([A-Za-z0-9_.]+)\s*=\s*(.+?)\s*$') { $props[$Matches[1]] = $Matches[2] }
}
foreach ($k in @('VOYCORRIENDO_STORE_FILE','VOYCORRIENDO_STORE_PASSWORD','VOYCORRIENDO_KEY_ALIAS','VOYCORRIENDO_KEY_PASSWORD')) {
    if (-not $props.ContainsKey($k)) { Fail "Falta '$k' en $gp" }
    if ($props[$k] -like '*PON_AQUI*') { Fail "'$k' sigue con el valor de ejemplo en $gp. Pon el valor real del keystore." }
}
$ks = $props['VOYCORRIENDO_STORE_FILE']
if (-not (Test-Path $ks)) { Fail "El keystore '$ks' no existe. Descárgalo con: npx eas-cli credentials -p android" }
Write-Host "   keystore: $ks"
Write-Host "   alias:    $($props['VOYCORRIENDO_KEY_ALIAS'])"

# ---------------------------------------------------------------- 4. Versión
Step "Versión"
$appJsonPath = Join-Path $root 'app.json'
$appJson = Get-Content $appJsonPath -Raw | ConvertFrom-Json
if ($Bump) {
    $nuevo = [int]$appJson.expo.android.versionCode + 1
    $appJson.expo.android.versionCode = $nuevo
    ($appJson | ConvertTo-Json -Depth 100) | Set-Content $appJsonPath -Encoding utf8
    Write-Host "   versionCode subido a $nuevo" -ForegroundColor Yellow
}
Write-Host "   versionName: $($appJson.expo.version)  |  versionCode: $($appJson.expo.android.versionCode)"
Write-Host "   (Play rechaza el AAB si el versionCode no es mayor al ya publicado)"

# ---------------------------------------------------------------- 5. Prebuild
if (-not $SkipPrebuild) {
    Step "Regenerando android/ desde app.json (expo prebuild --clean)"
    & npx.cmd expo prebuild --platform android --clean --no-install
    if ($LASTEXITCODE -ne 0) { Fail "expo prebuild falló." }

    $manifest = Get-Content "android\app\src\main\AndroidManifest.xml" -Raw
    if ($manifest -notmatch 'geo\.API_KEY') { Write-Host "   AVISO: la API key de Google Maps no quedó en el manifest." -ForegroundColor Yellow }
    $gradle = Get-Content "android\app\build.gradle" -Raw
    if ($gradle -notmatch 'VOYCORRIENDO_STORE_FILE') { Fail "El plugin withReleaseSigning no se aplicó a build.gradle." }
    Write-Host "   firma de release inyectada por el plugin: OK" -ForegroundColor Green

    # Esta maquina tiene interceptacion TLS: el wrapper no puede descargar Gradle
    # de services.gradle.org (PKIX path building failed). Apuntamos al zip ya
    # cacheado en disco. prebuild --clean resetea esto en cada corrida, por eso
    # se re-aplica aqui.
    $zip = "$env:USERPROFILE\.gradle\wrapper\dists\gradle-8.14.3-bin\d940da20bc9e6e60e76c3c56812dae8e\gradle-8.14.3-bin.zip"
    $wrapper = "android\gradle\wrapper\gradle-wrapper.properties"
    if (Test-Path $zip) {
        $url = "file:///" + ($zip -replace '\\', '/')
        (Get-Content $wrapper) -replace '^distributionUrl=.*', "distributionUrl=$url" | Set-Content $wrapper -Encoding ascii
        Write-Host "   gradle wrapper -> zip local (evita el error de certificado TLS)" -ForegroundColor Green
    } else {
        Write-Host "   AVISO: no encontre el zip de Gradle en cache; el wrapper intentara descargarlo" -ForegroundColor Yellow
        Write-Host "          y probablemente falle con 'PKIX path building failed'." -ForegroundColor Yellow
    }
} else {
    Write-Host "   (prebuild omitido por -SkipPrebuild)" -ForegroundColor Yellow
}

# ---------------------------------------------------------------- 6. Gradle
if ($Apk) { $task = 'assembleRelease'; $out = 'android\app\build\outputs\apk\release\app-release.apk' }
else      { $task = 'bundleRelease';   $out = 'android\app\build\outputs\bundle\release\app-release.aab' }

Step "Compilando ($task) — la primera vez tarda 10-20 min"
Push-Location android
& .\gradlew.bat $task --no-daemon
$code = $LASTEXITCODE
Pop-Location
if ($code -ne 0) { Fail "Gradle falló con código $code." }

# ---------------------------------------------------------------- 7. Resultado
if (-not (Test-Path $out)) { Fail "El build terminó pero no encontré '$out'." }
$mb = [math]::Round((Get-Item $out).Length / 1MB, 1)
Step "Listo"
Write-Host "   $out  ($mb MB)" -ForegroundColor Green
Write-Host ""
Write-Host "   Huella del certificado de firma (compárala con Play Console > Integridad de la app):"
& "$jdk\bin\keytool.exe" -list -v -keystore $ks -alias $props['VOYCORRIENDO_KEY_ALIAS'] -storepass $props['VOYCORRIENDO_STORE_PASSWORD'] 2>$null |
    Select-String -Pattern 'SHA1:|SHA256:' | ForEach-Object { Write-Host "   $($_.Line.Trim())" }
Write-Host ""
Write-Host "   Súbelo en: https://play.google.com/console -> VoyCorriendo -> Pruebas -> Prueba interna"
