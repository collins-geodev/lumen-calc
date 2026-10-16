$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Find-Jdk21 {
  $candidates = @(
    (Get-ChildItem "C:\Program Files\Microsoft" -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -like "jdk-21*" }),
    (Get-ChildItem "C:\Program Files\Eclipse Adoptium" -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -like "jdk-21*" }),
    (Get-ChildItem "C:\Program Files\Java" -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -like "*21*" })
  ) | Where-Object { $_ } | ForEach-Object { $_ }

  foreach ($dir in $candidates) {
    $java = Join-Path $dir.FullName "bin\java.exe"
    if (Test-Path $java) { return $dir.FullName }
  }
  return $null
}

$jdk = Find-Jdk21
if ($jdk) {
  $env:JAVA_HOME = $jdk
  $env:PATH = "$jdk\bin;$env:PATH"
  Write-Host "Using JAVA_HOME=$jdk"
} else {
  Write-Host "Warning: JDK 21 not found; using current Java. Gradle may fail on Java 25+."
}

$sdk = $env:ANDROID_HOME
if (-not $sdk) { $sdk = $env:ANDROID_SDK_ROOT }
if (-not $sdk) { $sdk = Join-Path $env:LOCALAPPDATA "Android\Sdk" }
$env:ANDROID_HOME = $sdk
$env:ANDROID_SDK_ROOT = $sdk

$localProps = Join-Path $root "android\local.properties"
if (-not (Test-Path $localProps)) {
  Set-Content -Path $localProps -Value ("sdk.dir=" + ($sdk -replace '\\', '/')) -Encoding ASCII
}

npm run cap:sync
Push-Location (Join-Path $root "android")
try {
  & .\gradlew.bat assembleDebug
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally {
  Pop-Location
}

node (Join-Path $root "scripts\copy-apk.js")
