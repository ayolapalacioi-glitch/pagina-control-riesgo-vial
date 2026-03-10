# ─── start-run: Encender el servidor ──────────────────────────────────────────
$root = $PSScriptRoot
Push-Location $root

Write-Host ""
Write-Host "  Iniciando servidor de Seguridad Vial..." -ForegroundColor Cyan

docker compose up --build -d

if ($LASTEXITCODE -ne 0) {
  Write-Host "  [ERROR] Docker no pudo iniciar. Asegurate de que Docker Desktop este corriendo." -ForegroundColor Red
  Pop-Location
  exit 1
}

# Esperar a que el backend este listo (health check)
Write-Host "  Esperando que el backend este listo..." -ForegroundColor DarkYellow
$timeout = 60
$elapsed = 0
$ready = $false
while ($elapsed -lt $timeout) {
  Start-Sleep -Seconds 2
  $elapsed += 2
  try {
    $status = docker compose ps --format json 2>$null | ConvertFrom-Json -ErrorAction SilentlyContinue
    $backend = $status | Where-Object { $_.Service -eq 'backend' -and $_.Health -eq 'healthy' }
    if ($backend) { $ready = $true; break }
  } catch {}
  Write-Host "  ... ($elapsed s)" -ForegroundColor DarkGray
}

$ip = "192.168.2.245"
$port = "4000"

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

# Generar QR local con Python
Write-Host "  Generando QR local..." -ForegroundColor DarkYellow
$pyExe = $null
foreach ($candidate in @('python', 'python3', 'py')) {
  if (Get-Command $candidate -ErrorAction SilentlyContinue) {
    $pyExe = $candidate; break
  }
}
if ($pyExe) {
  & $pyExe (Join-Path $root 'generate-qr.py') $ip $port
  Write-Host "  QR abierto. Escanea 'qr-viewer-local.png' con tu celular." -ForegroundColor Green
} else {
  Write-Host "  Python no encontrado. Escanea manualmente: https://${ip}:${port}/viewer.html?qr=1" -ForegroundColor DarkYellow
}

Pop-Location
