import tinytuya, urllib.request, json, cv2, time

client_id = '3a8cs4wmgppk54p9pkvv'
secret = '8c7656d031a544a19461ec6eb9dc764b'
dev_id = 'eb66bb9aa668e53f31gxsh'

cloud = tinytuya.Cloud(apiRegion='us', apiKey=client_id, apiSecret=secret)

print("[+] Solicitando URL HLS a Tuya Cloud...")
res = cloud.cloudrequest(f'/v1.0/devices/{dev_id}/stream/actions/allocate', action='POST', post={'type': 'hls'})
if res.get('success'):
    hls_url = res['result']['url']
    print(f"[+] HLS URL obtenida: {hls_url[:80]}...")

    exec_cmd = f"exec:ffmpeg -re -i \"{hls_url}\" -c copy -f rtsp {{output}}"
    data = json.dumps({'name': 'vta_camera', 'src': exec_cmd}).encode('utf-8')
    req = urllib.request.Request('http://go2rtc:1984/api/streams', data=data, headers={'Content-Type': 'application/json'}, method='PUT')
    res_g2 = urllib.request.urlopen(req)
    print('[+] Registro en go2rtc exitoso:', res_g2.status)

    time.sleep(2)
    local_rtsp = 'rtsp://go2rtc:8554/vta_camera'
    print(f"[+] Abriendo video local RTSP: {local_rtsp}...")
    cap = cv2.VideoCapture(local_rtsp, cv2.CAP_FFMPEG)
    print('    cap.isOpened():', cap.isOpened())
    if cap.isOpened():
        ret, frame = cap.read()
        print('    Frame leído con éxito en vivo:', ret, 'Shape:', frame.shape if ret else None)
        cap.release()
