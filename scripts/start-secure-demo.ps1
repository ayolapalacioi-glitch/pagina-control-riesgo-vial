param(
  [int]$Port = 4000,
  [switch]$NoDocker,
  [switch]$OpenBrowser
)

$ErrorActionPreference = 'Stop'

# ─── Buscar o descargar cloudflared ──────────────────────────────────────────
function Get-CloudflaredExe {
  # 1. Ya en PATH
  $found = Get-Command 'cloudflared' -ErrorAction SilentlyContinue
  if ($found) { return $found.Source }

  # 2. Junto al script
  $local = Join-Path $PSScriptRoot 'cloudflared.exe'
  if (Test-Path $local) { return $local }

  # 3. Descargar automáticamente
  Write-Host '[cloudflared] No encontrado. Descargando...' -ForegroundColor DarkYellow
  $url  = 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe'
  Invoke-WebRequest -Uri $url -OutFile $local -UseBasicParsing
  Write-Host "[cloudflared] Descargado en: $local" -ForegroundColor DarkGreen
  return $local
}

function Get-CloudflareUrl {
  param([string]$LogPath, [int]$TimeoutSec = 60)
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  while ((Get-Date) -lt $deadline) {
    if (Test-Path $LogPath) {
      $content = Get-Content $LogPath -Raw -ErrorAction SilentlyContinue
      if ($content -match 'https://[a-z0-9\-]+\.trycloudflare\.com') {
        return $matches[0]
      }
    }
    Start-Sleep -Seconds 1
  }
  return $null
}

# ─── Main ─────────────────────────────────────────────────────────────────────
$workspaceRoot = Split-Path -Parent $PSScriptRoot
Push-Location $workspaceRoot

try {
  if (-not $NoDocker) {
    Write-Host '[1/3] Iniciando contenedores Docker...' -ForegroundColor Cyan
    docker compose up -d | Out-Host
  }

  $tmpDir = Join-Path $workspaceRoot '.tmp'
  New-Item -Path $tmpDir -ItemType Directory -Force | Out-Null

  $outLog = Join-Path $tmpDir 'cloudflared.out.log'
  $errLog = Join-Path $tmpDir 'cloudflared.err.log'
  $pidFile = Join-Path $tmpDir 'cloudflared.pid'
  Remove-Item $outLog, $errLog, $pidFile -ErrorAction SilentlyContinue

  $cfExe = Get-CloudflaredExe

  Write-Host '[2/3] Levantando tunel HTTPS (Cloudflare)...' -ForegroundColor Cyan
  $cfProcess = Start-Process -FilePath $cfExe `
    -ArgumentList @('tunnel', '--url', "http://localhost:$Port", '--no-autoupdate') `
    -RedirectStandardOutput $outLog `
    -RedirectStandardError  $errLog `
    -PassThru `
    -WindowStyle Hidden

  Set-Content -Path $pidFile -Value $cfProcess.Id

  # Cloudflare escribe la URL en stderr
  $publicUrl = Get-CloudflareUrl -LogPath $errLog -TimeoutSec 60
  if (-not $publicUrl) {
    # Intentar también en stdout
    $publicUrl = Get-CloudflareUrl -LogPath $outLog -TimeoutSec 10
  }

  if (-not $publicUrl) {
    throw "No se pudo obtener URL de Cloudflare Tunnel. Revisa: $errLog"
  }

  $dashboardUrl = $publicUrl.TrimEnd('/')
  $viewerUrl    = "$dashboardUrl/viewer.html?qr=1"

  # Guardar URL en archivo para que el backend la use en el QR automaticamente
  Set-Content -Path (Join-Path $tmpDir 'public_url.txt') -Value $dashboardUrl -Encoding UTF8

  Write-Host '[3/3] Demo lista - sin password, sin verificacion' -ForegroundColor Green
  Write-Host ''
  Write-Host "  Dashboard : $dashboardUrl"  -ForegroundColor Yellow
  Write-Host "  Viewer QR : $viewerUrl"     -ForegroundColor Yellow
  Write-Host ''

  try {
    Set-Clipboard -Value $dashboardUrl
    Write-Host 'URL del dashboard copiada al portapapeles.' -ForegroundColor DarkGreen
  } catch {}

  if ($OpenBrowser) {
    Start-Process $dashboardUrl | Out-Null
  }

  Write-Host ''
  Write-Host 'Para detener el tunel:' -ForegroundColor Cyan
  Write-Host '  Stop-Process -Id (Get-Content .tmp\cloudflared.pid)' -ForegroundColor Gray
  Write-Host 'Para detener todo (Docker + tunel):' -ForegroundColor Cyan
  Write-Host '  Stop-Process -Id (Get-Content .tmp\cloudflared.pid); docker compose down' -ForegroundColor Gray
}
finally {
  Pop-Location
}
