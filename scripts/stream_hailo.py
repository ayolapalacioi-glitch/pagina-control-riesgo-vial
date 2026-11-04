#!/usr/bin/env python3
import subprocess
import threading
import time
import json
from http.server import HTTPServer, BaseHTTPRequestHandler
from socketserver import ThreadingMixIn

latest_frame = None
frame_count = 0
fps = 0.0
lock = threading.Lock()

def video_worker():
    global latest_frame, frame_count, fps
    cmd = [
        'rpicam-vid',
        '-t', '0',
        '--post-process-file', '/usr/share/rpi-camera-assets/hailo_yolov8_inference.json',
        '--width', '1280',
        '--height', '720',
        '--framerate', '30',
        '--codec', 'mjpeg',
        '--nopreview',
        '-o', '-'
    ]
    
    fps_timer = time.time()
    frames_in_sec = 0

    while True:
        try:
            print('[VIDEO] Iniciando rpicam-vid con aceleración Hailo-8 YOLOv8...', flush=True)
            proc = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.DEVNULL,
                bufsize=10**6
            )
            buffer = b''
            while True:
                chunk = proc.stdout.read(8192)
                if not chunk:
                    break
                buffer += chunk
                while True:
                    a = buffer.find(b'\xff\xd8')
                    if a == -1:
                        buffer = b''
                        break
                    if a > 0:
                        buffer = buffer[a:]
                    b = buffer.find(b'\xff\xd9', 2)
                    if b == -1:
                        if len(buffer) > 2_000_000:
                            buffer = b''
                        break
                    frame = buffer[:b+2]
                    buffer = buffer[b+2:]
                    with lock:
                        latest_frame = frame
                        frame_count += 1
                        frames_in_sec += 1
                    
                    now = time.time()
                    if now - fps_timer >= 1.0:
                        fps = round(frames_in_sec / (now - fps_timer), 1)
                        frames_in_sec = 0
                        fps_timer = now
            
            proc.terminate()
            proc.wait(timeout=2)
        except Exception as e:
            print(f'[VIDEO] Error worker: {e}', flush=True)
            time.sleep(1)

class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True

class StreamingHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        global latest_frame, frame_count, fps
        if self.path in ('/video', '/stream.mjpg', '/', '/stream'):
            self.send_response(200)
            self.send_header('Age', '0')
            self.send_header('Cache-Control', 'no-cache, private, no-store, must-revalidate')
            self.send_header('Pragma', 'no-cache')
            self.send_header('Content-Type', 'multipart/x-mixed-replace; boundary=FRAME')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            last_sent = None
            try:
                while True:
                    with lock:
                        frame = latest_frame
                    if frame and frame is not last_sent:
                        self.wfile.write(b'--FRAME\r\n')
                        self.send_header('Content-Type', 'image/jpeg')
                        self.send_header('Content-Length', str(len(frame)))
                        self.send_header('Access-Control-Allow-Origin', '*')
                        self.end_headers()
                        self.wfile.write(frame)
                        self.wfile.write(b'\r\n')
                        last_sent = frame
                    else:
                        time.sleep(0.005)
            except Exception:
                pass
        elif self.path in ('/snapshot', '/frame.jpg', '/current.jpg'):
            with lock:
                frame = latest_frame
            if frame:
                self.send_response(200)
                self.send_header('Content-Type', 'image/jpeg')
                self.send_header('Content-Length', str(len(frame)))
                self.send_header('Cache-Control', 'no-cache, no-store')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(frame)
            else:
                self.send_error(503, 'CSI Camera initializing...')
        elif self.path == '/health':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            with lock:
                has_frame = latest_frame is not None
            payload = json.dumps({
                'status': 'online',
                'device': 'Raspberry Pi 5 + Hailo-8 AI',
                'yolo': 'YOLOv8s HEF Hardware Inference',
                'has_frame': has_frame,
                'fps': fps,
                'total_frames': frame_count
            })
            self.wfile.write(payload.encode('utf-8'))
        else:
            self.send_error(404)

    def log_message(self, format, *args):
        pass

if __name__ == '__main__':
    t = threading.Thread(target=video_worker, daemon=True)
    t.start()
    server = ThreadedHTTPServer(('0.0.0.0', 8000), StreamingHandler)
    print('[SERVER] Hailo-8 AI Streamer listening on http://0.0.0.0:8000...', flush=True)
    server.serve_forever()
