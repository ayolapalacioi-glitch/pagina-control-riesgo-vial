FROM python:3.11-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       openssl \
       libgl1 \
       libglib2.0-0 \
       libxcb1 \
    && rm -rf /var/lib/apt/lists/*

COPY backend_py/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

CMD ["sh", "/app/backend_py/entrypoint.sh"]
