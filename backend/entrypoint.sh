#!/bin/sh
set -e

# ──────────────────────────────────────────────
# Generar certificado SSL autofirmado si no existe
# o si la IP cambió
# ──────────────────────────────────────────────
mkdir -p /app/certs

# Preferir LAN_IP inyectada por docker-compose
LOCAL_IP="${LAN_IP:-}"
if [ -z "$LOCAL_IP" ]; then
  LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}' | tr -d ' \n' || echo '127.0.0.1')
fi
[ -z "$LOCAL_IP" ] && LOCAL_IP='127.0.0.1'

IP_FILE=/app/certs/.last_ip

# Regenerar si el cert no existe o la IP cambió
if [ ! -f /app/certs/server.crt ] || [ "$(cat $IP_FILE 2>/dev/null)" != "$LOCAL_IP" ]; then
  echo "[SSL] Generando certificado autofirmado para IP: $LOCAL_IP"
  openssl req -x509 -newkey rsa:2048 \
    -keyout /app/certs/server.key \
    -out    /app/certs/server.crt \
    -days 365 -nodes \
    -subj "/CN=$LOCAL_IP" \
    -addext "subjectAltName=IP:$LOCAL_IP,IP:127.0.0.1,DNS:localhost" \
    2>/dev/null
  echo "$LOCAL_IP" > $IP_FILE
  echo "[SSL] Certificado generado OK -> /app/certs/server.crt (SAN: $LOCAL_IP)"
else
  echo "[SSL] Certificado existente para $LOCAL_IP, reutilizando."
fi

# ──────────────────────────────────────────────
# Instalar dependencias si faltan
# ──────────────────────────────────────────────
if [ ! -d /app/backend/node_modules ] || [ -z "$(ls -A /app/backend/node_modules 2>/dev/null)" ]; then
  echo "[NPM] Instalando dependencias..."
  npm ci
fi

# ──────────────────────────────────────────────
# Arrancar servidor
# ──────────────────────────────────────────────
exec npm run dev
