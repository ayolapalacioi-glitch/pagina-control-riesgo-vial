#!/bin/sh
set -e

mkdir -p /app/certs

LOCAL_IP="${LAN_IP:-}"
if [ -z "$LOCAL_IP" ]; then
  LOCAL_IP=$(hostname -i 2>/dev/null | awk '{print $1}' | tr -d ' \n' || echo '127.0.0.1')
fi
[ -z "$LOCAL_IP" ] && LOCAL_IP='127.0.0.1'

IP_FILE=/app/certs/.last_ip
if [ ! -f /app/certs/server.crt ] || [ "$(cat $IP_FILE 2>/dev/null)" != "$LOCAL_IP" ]; then
  echo "[SSL] Generando certificado autofirmado para IP: $LOCAL_IP"
  openssl req -x509 -newkey rsa:2048 \
    -keyout /app/certs/server.key \
    -out /app/certs/server.crt \
    -days 365 -nodes \
    -subj "/CN=$LOCAL_IP" \
    -addext "subjectAltName=IP:$LOCAL_IP,IP:127.0.0.1,DNS:localhost" \
    2>/dev/null
  echo "$LOCAL_IP" > $IP_FILE
fi

exec uvicorn backend_py.app.main:get_asgi_app \
  --factory \
  --host 0.0.0.0 \
  --port "${PORT:-4000}" \
  --ssl-certfile /app/certs/server.crt \
  --ssl-keyfile /app/certs/server.key
