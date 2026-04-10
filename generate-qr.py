"""
Genera un QR con la URL local del viewer para escanear con el celular.
Uso:  python generate-qr.py [ip] [puerto]
"""
import sys
import os
import subprocess
from urllib.parse import quote
from urllib.request import urlretrieve

# ── Parámetros ────────────────────────────────────────────────────────────────
ip   = sys.argv[1] if len(sys.argv) > 1 else "192.168.2.245"
port = sys.argv[2] if len(sys.argv) > 2 else "4000"
url  = f"https://{ip}:{port}/viewer.html?qr=1"

# ── Intentar QR local; fallback remoto sin instalar paquetes ──────────────────
try:
    import qrcode
except ImportError:
    qrcode = None

# ── Generar imagen ────────────────────────────────────────────────────────────
out_path = os.path.join(os.path.dirname(__file__), "qr-viewer-local.png")

if qrcode is not None:
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=12,
        border=3,
    )
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#111827", back_color="white")
    img.save(out_path)
else:
    fallback_qr_url = f"https://api.qrserver.com/v1/create-qr-code/?size=640x640&data={quote(url, safe='')}"
    urlretrieve(fallback_qr_url, out_path)

print(f"\n  QR generado: {out_path}")
print(f"  URL:         {url}\n")

# Abrir la imagen automáticamente
if sys.platform == "win32":
    os.startfile(out_path)
elif sys.platform == "darwin":
    subprocess.Popen(["open", out_path])
else:
    subprocess.Popen(["xdg-open", out_path])
