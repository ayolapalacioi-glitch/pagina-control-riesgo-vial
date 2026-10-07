import tinytuya, urllib.request, json, cv2, time

client_id = '3a8cs4wmgppk54p9pkvv'
secret = '8c7656d031a544a19461ec6eb9dc764b'
dev_id = 'eb66bb9aa668e53f31gxsh'

cloud = tinytuya.Cloud(apiRegion='us', apiKey=client_id, apiSecret=secret)

print("[+] Obteniendo HLS Stream de Tuya Cloud...")
res = cloud.cloudrequest(f'/v1.0/devices/{dev_id}/stream/actions/allocate', action='POST', post={'type': 'hls'})
if res.get('success'):
    hls_url = res['result']['url']
    print(f"[+] URL HLS: {hls_url[:80]}...")

    exec_cmd = f"ffmpeg -re -i \"{hls_url}\" -c:v copy -an -f rtsp {{output}}"
    data = json.dumps({'name': 'vta_camera', 'src': exec_cmd}).encode('utf-8')
    req = urllib.request.Request('http://go2rtc:1984/api/streams', data=data, headers={'Content-Type': 'application/json'}, method='PUT')
    res_g2 = urllib.request.urlopen(req)
    print('[+] Registro en go2rtc:', res_g2.status)

    time.sleep(2)

    local_url = 'rtsp://go2rtc:8554/vta_camera'
    print(f"[+] Probando lectura continua en local RTSP: {local_url}...")
    cap = cv2.VideoCapture(local_url, cv2.CAP_FFMPEG)
    print('    cap.isOpened():', cap.isOpened())
    if cap.isOpened():
        t0 = time.time()
        frames = 0
        for i in range(20):
            ret, frame = cap.read()
            if ret and frame is not None:
                frames += 1
                print(f'    Lectura {i+1}: ret={ret}, shape={frame.shape}')
            time.sleep(0.02)
        t1 = time.time()
        print(f"===> RESULTADO: {frames} FOTOGRAMAS EN {t1-t0:.2f}s | FPS REAL: {frames/(t1-t0):.1f} FPS")
        cap.release()
