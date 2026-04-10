param(
  [switch]$Rebuild,
  [switch]$NoQr
)

# ─── start-run: Encender el servidor ──────────────────────────────────────────
$root = $PSScriptRoot
Push-Location $root

Write-Host ""
Write-Host "  Iniciando servidor de Seguridad Vial..." -ForegroundColor Cyan

if ($Rebuild) {
  Write-Host "  Modo rebuild activo (--build)." -ForegroundColor DarkYellow
  docker compose up --build -d
} else {
  docker compose up -d
}

if ($LASTEXITCODE -ne 0) {
  Write-Host "  [ERROR] Docker no pudo iniciar. Asegurate de que Docker Desktop este corriendo." -ForegroundColor Red
  Pop-Location
  exit 1
}

# Resolver IP desde docker-compose para no desalinear QR/ESP32
$ip = "192.168.2.245"
$composePath = Join-Path $root 'docker-compose.yml'
if (Test-Path $composePath) {
  $m = Select-String -Path $composePath -Pattern 'LAN_IP=([0-9\.]+)' | Select-Object -First 1
  if ($m -and $m.Matches.Count -gt 0) {
    $ip = $m.Matches[0].Groups[1].Value
  }
}

$port = "4000"

Write-Host ""
Write-Host "  URL prevista (mientras inicia backend): https://${ip}:${port}" -ForegroundColor DarkCyan
Write-Host "  Viewer QR previsto: https://${ip}:${port}/viewer.html?qr=1" -ForegroundColor DarkCyan

# Esperar a que el backend este listo (health check)
Write-Host "  Esperando que el backend este listo..." -ForegroundColor DarkYellow
$timeout = 45
$elapsed = 0
$ready = $false
while ($elapsed -lt $timeout) {
  Start-Sleep -Seconds 1
  $elapsed += 1
  try {
    $status = docker compose ps --format json 2>$null | ConvertFrom-Json -ErrorAction SilentlyContinue
    $backend = $status | Where-Object { $_.Service -eq 'backend' -and $_.Health -eq 'healthy' }
    if ($backend) { $ready = $true; break }
  } catch {}
  if (($elapsed % 3) -eq 0) {
    Write-Host "  ... ($elapsed s)" -ForegroundColor DarkGray
  }
}

Write-Host ""
Write-Host "  ────────────────────────────────────────────────────" -ForegroundColor Green
Write-Host "   Servidor listo" -ForegroundColor Green
Write-Host "  ────────────────────────────────────────────────────" -ForegroundColor Green
Write-Host "   Dashboard : https://${ip}:${port}" -ForegroundColor Yellow
Write-Host "   Viewer QR : https://${ip}:${port}/viewer.html?qr=1" -ForegroundColor Yellow
Write-Host "  ────────────────────────────────────────────────────" -ForegroundColor Green
Write-Host "   Para apagar usa:  .\off-server.ps1" -ForegroundColor DarkGray
Write-Host "  ────────────────────────────────────────────────────" -ForegroundColor Green
Write-Host ""

try { Set-Clipboard -Value "https://${ip}:${port}" } catch {}

# Generar QR local con Python (en segundo plano para no bloquear)
if ($NoQr) {
  Write-Host "  Generacion de QR omitida por parametro -NoQr." -ForegroundColor DarkYellow
  Pop-Location
  exit 0
}

Write-Host "  Generando QR local en segundo plano..." -ForegroundColor DarkYellow
$pyExe = $null
foreach ($candidate in @('python', 'python3', 'py')) {
  if (Get-Command $candidate -ErrorAction SilentlyContinue) {
    $pyExe = $candidate; break
  }
}
if ($pyExe) {
  Start-Process -FilePath $pyExe -ArgumentList @((Join-Path $root 'generate-qr.py'), $ip, $port) -WindowStyle Hidden
  Write-Host "  QR en proceso. Revisa 'qr-viewer-local.png' en la raiz del proyecto." -ForegroundColor Green
} else {
  Write-Host "  Python no encontrado. Escanea manualmente: https://${ip}:${port}/viewer.html?qr=1" -ForegroundColor DarkYellow
}

Pop-Location
