param(
  [int]$Port = 4000,
  [switch]$NoDocker,
  [switch]$OpenBrowser
)

$ErrorActionPreference = 'Stop'

function Get-PublicUrlFromLog {
  param([string]$LogPath)
  if (-not (Test-Path $LogPath)) { return $null }

  $lines = Get-Content -Path $LogPath -ErrorAction SilentlyContinue
  foreach ($line in $lines) {
    if ($line -match 'your url is:\s*(https?://\S+)') {
      return $matches[1]
    }
  }
  return $null
}

function Get-LocalTunnelPassword {
  try {
    $resp = Invoke-WebRequest -Uri 'https://loca.lt/mytunnelpassword' -UseBasicParsing -TimeoutSec 15
    if ($resp -and $resp.Content) {
      return $resp.Content.Trim()
    }
  }
  catch {
  }
  return $null
}

$workspaceRoot = Split-Path -Parent $PSScriptRoot
Push-Location $workspaceRoot

try {
  if (-not $NoDocker) {
    Write-Host '[1/3] Iniciando contenedores...' -ForegroundColor Cyan
    docker compose up -d | Out-Host
  }

  $tmpDir = Join-Path $workspaceRoot '.tmp'
  New-Item -Path $tmpDir -ItemType Directory -Force | Out-Null

  $outLog = Join-Path $tmpDir 'localtunnel.out.log'
  $errLog = Join-Path $tmpDir 'localtunnel.err.log'
  $pidFile = Join-Path $tmpDir 'localtunnel.pid'

  Remove-Item $outLog, $errLog, $pidFile -ErrorAction SilentlyContinue

  Write-Host '[2/3] Levantando túnel HTTPS...' -ForegroundColor Cyan
  $ltProcess = Start-Process -FilePath 'npx.cmd' `
    -ArgumentList @('--yes', 'localtunnel', '--port', "$Port") `
    -RedirectStandardOutput $outLog `
    -RedirectStandardError $errLog `
    -PassThru `
    -WindowStyle Hidden

  Set-Content -Path $pidFile -Value $ltProcess.Id

  $deadline = (Get-Date).AddSeconds(50)
  $publicUrl = $null
  while ((Get-Date) -lt $deadline) {
    if ($ltProcess.HasExited) { break }
    $publicUrl = Get-PublicUrlFromLog -LogPath $outLog
    if ($publicUrl) { break }
    Start-Sleep -Seconds 1
  }

  if (-not $publicUrl) {
    throw "No se pudo obtener URL HTTPS de LocalTunnel. Revisa: $errLog"
  }

  $dashboardUrl = $publicUrl.TrimEnd('/')
  $viewerUrl = "$dashboardUrl/viewer.html?qr=1"
  $tunnelPassword = Get-LocalTunnelPassword

  Write-Host '[3/3] Demo segura lista' -ForegroundColor Green
  Write-Host "Dashboard HTTPS: $dashboardUrl" -ForegroundColor Yellow
  Write-Host "Viewer QR HTTPS: $viewerUrl" -ForegroundColor Yellow
  if ($tunnelPassword) {
    Write-Host "Tunnel Password (LocalTunnel): $tunnelPassword" -ForegroundColor Yellow
    Write-Host 'Si aparece pantalla de verificación, pega ese valor (IP publica).' -ForegroundColor DarkYellow
  }

  try {
    Set-Clipboard -Value $dashboardUrl
    Write-Host 'URL del dashboard copiada al portapapeles.' -ForegroundColor DarkGreen
  } catch {
  }

  if ($OpenBrowser) {
    Start-Process $dashboardUrl | Out-Null
  }

  Write-Host ''
  Write-Host 'Para detener solo el túnel HTTPS:' -ForegroundColor Cyan
  Write-Host '  Stop-Process -Id (Get-Content .tmp/localtunnel.pid)' -ForegroundColor Gray
  Write-Host 'Para detener todo:' -ForegroundColor Cyan
  Write-Host '  docker compose down' -ForegroundColor Gray
}
finally {
  Pop-Location
}
