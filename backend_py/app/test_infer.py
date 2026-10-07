import tinytuya, cv2, base64
from app.vision_service import vision_service

client_id = '3a8cs4wmgppk54p9pkvv'
secret = '8c7656d031a544a19461ec6eb9dc764b'
dev_id = 'eb66bb9aa668e53f31gxsh'

cloud = tinytuya.Cloud(apiRegion='us', apiKey=client_id, apiSecret=secret)

print("[+] Solicitando HLS URL a Tuya Cloud...")
res = cloud.cloudrequest(f'/v1.0/devices/{dev_id}/stream/actions/allocate', action='POST', post={'type': 'hls'})
if res.get('success'):
    hls_url = res['result']['url']
    print(f"[+] HLS URL: {hls_url[:80]}...")
    cap = cv2.VideoCapture(hls_url)
    if cap.isOpened():
        ret, frame = cap.read()
        if ret and frame is not None:
            print('Shape de fotograma capturado:', frame.shape)
            dets, b64 = vision_service.infer(frame)
            print('B64 length:', len(b64) if b64 else 0)
            print('B64 header:', b64[:40] if b64 else None)
            if b64:
                raw = base64.b64decode(b64.split(',', 1)[1])
                with open('/tmp/test_out.jpg', 'wb') as f:
                    f.write(raw)
                print('===> ¡¡FOTOGRAMA GUARDADO CON EXITO!! TAMAÑO:', len(raw), 'bytes')
        cap.release()
