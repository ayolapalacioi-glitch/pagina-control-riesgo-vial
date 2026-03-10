# ─── off-server: Apagar el servidor ───────────────────────────────────────────
$root = $PSScriptRoot
Push-Location $root

Write-Host ""
Write-Host "  Apagando servidor de Seguridad Vial..." -ForegroundColor Cyan

# Detener tunel Cloudflare si esta corriendo
$pidFile = Join-Path $root '.tmp\cloudflared.pid'
if (Test-Path $pidFile) {
  $cfPid = Get-Content $pidFile -ErrorAction SilentlyContinue
  if ($cfPid) {
    try {
      Stop-Process -Id ([int]$cfPid) -Force -ErrorAction SilentlyContinue
      Write-Host "  Tunel Cloudflare detenido." -ForegroundColor DarkGray
    } catch {}
  }
  Remove-Item $pidFile -ErrorAction SilentlyContinue
}

# Limpiar URL publica guardada
$urlFile = Join-Path $root '.tmp\public_url.txt'
Remove-Item $urlFile -ErrorAction SilentlyContinue

# Detener contenedores Docker
docker compose down

Write-Host ""
Write-Host "  ────────────────────────────────────────────────────" -ForegroundColor Red
Write-Host "   Servidor apagado correctamente." -ForegroundColor Red
Write-Host "   Para volver a encender usa:  .\start-run.ps1" -ForegroundColor DarkGray
Write-Host "  ────────────────────────────────────────────────────" -ForegroundColor Red
Write-Host ""

Pop-Location
