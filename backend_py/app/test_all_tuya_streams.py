import tinytuya, json, cv2, time

client_id = '3a8cs4wmgppk54p9pkvv'
secret = '8c7656d031a544a19461ec6eb9dc764b'
dev_id = 'eb66bb9aa668e53f31gxsh'

cloud = tinytuya.Cloud(apiRegion='us', apiKey=client_id, apiSecret=secret)

types = ['hls', 'rtsp', 'webrtc', 'flv', 'standard']

for stype in types:
    print(f"\n[+] Probando tipo de transmisión Tuya Cloud: '{stype}'...")
    res = cloud.cloudrequest(f'/v1.0/devices/{dev_id}/stream/actions/allocate', action='POST', post={'type': stype})
    print(f"Respuesta Tuya '{stype}':", json.dumps(res, indent=2))
    if res.get('success') and 'result' in res:
        url = res['result'].get('url') or res['result'].get('stream_url')
        if url:
            print(f"[+] Intentando abrir con OpenCV en '{stype}': {url[:80]}...")
            cap = cv2.VideoCapture(url)
            print("    cap.isOpened():", cap.isOpened())
            if cap.isOpened():
                ret, frame = cap.read()
                print("    Frame ret:", ret, "Shape:", frame.shape if ret else None)
                cap.release()
