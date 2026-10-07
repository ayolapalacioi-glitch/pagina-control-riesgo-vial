#!/usr/bin/env python3
"""
Script de prueba para la Cámara WiFi VTA-84920 mediante flujo RTSP con YOLOv8.

Uso:
  python scripts/test_vta_rtsp.py --ip 192.168.1.15 --user BmU0FIYfd --pass Ayolaisaac444
"""

import argparse
import sys
import os
import time
import cv2

try:
    from ultralytics import YOLO
except ImportError:
    YOLO = None
    print("[WARN] Ultralytics no instalado. Ejecutando en modo solo vista previa de video.")


def main():
    parser = argparse.ArgumentParser(description="Prueba RTSP para Cámara VTA-84920")
    parser.add_argument("--ip", type=str, default="192.168.1.15", help="IP local de la cámara VTA")
    parser.add_argument("--user", type=str, default="BmU0FIYfd", help="Usuario o código de usuario")
    parser.add_argument("--pass", dest="password", type=str, default="Ayolaisaac444", help="Contraseña de la cámara")
    parser.add_argument("--port", type=int, default=554, help="Puerto RTSP (defecto 554)")
    parser.add_argument("--path", type=str, default="/live/ch0", help="Ruta RTSP (ej. /live/ch0, /stream1)")
    parser.add_argument("--model", type=str, default="yolov8n.pt", help="Modelo YOLO")
    args = parser.parse_args()

    paths_to_try = [
        args.path,
        "/live/ch0",
        "/stream1",
        "/h264Preview_01_main",
        "/ch0",
        "/onvif1"
    ]
    unique_paths = []
    for p in paths_to_try:
        if p not in unique_paths:
            unique_paths.append(p)

    users_to_try = [args.user, "admin", "ayolapalacioi@gmail.com"]
    unique_users = []
    for u in users_to_try:
        if u and u not in unique_users:
            unique_users.append(u)

    print("=" * 65)
    print("  PROBADOR DE CÁMARA VTA-84920 (RTSP + YOLOv8)")
    print("=" * 65)
    print(f" Target IP : {args.ip}")
    print(f" Usuario   : {args.user}")
    print(f" Puerto    : {args.port}")
    print("-" * 65)

    os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;udp|fflags;nobuffer|max_delay;500000"

    cap = None
    connected_url = None

    for u in unique_users:
        for p in unique_paths:
            route = p if p.startswith("/") else f"/{p}"
            url = f"rtsp://{u}:{args.password}@{args.ip}:{args.port}{route}"
            masked_url = f"rtsp://{u}:****@{args.ip}:{args.port}{route}"
            print(f"[+] Intentando conectar a: {masked_url} ...")

            test_cap = cv2.VideoCapture(url, cv2.CAP_FFMPEG)
            test_cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

            if test_cap.isOpened():
                ret, frame = test_cap.read()
                if ret and frame is not None and frame.size > 0:
                    cap = test_cap
                    connected_url = url
                    print(f"  [SUCCESS] Conexión establecida con éxito en: {masked_url}")
                    break
            test_cap.release()

        if cap is not None:
            break

    if cap is None or not cap.isOpened():
        print("[ERROR] No se pudo conectar a la cámara VTA. Verifica:")
        print(" 1. Que la cámara esté encendida y conectada a la misma red Wi-Fi.")
        print(" 2. La dirección IP de la cámara (asígnala fija en tu router si es posible).")
        print(" 3. Que la app Tuya / VTA Smart tenga habilitado el servicio ONVIF/RTSP.")
        sys.exit(1)

    model = None
    if YOLO is not None:
        try:
            print(f"[+] Cargando modelo YOLO ({args.model})...")
            model = YOLO(args.model)
        except Exception as e:
            print(f"[WARN] No se pudo cargar el modelo YOLO: {e}")

    print("[+] Presiona 'q' en la ventana del video para salir.")

    frame_count = 0
    fps_start = time.time()
    fps = 0.0

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret or frame is None:
            print("[WARN] Se perdió el flujo RTSP.")
            break

        frame_count += 1
        now = time.time()
        if now - fps_start >= 1.0:
            fps = frame_count / (now - fps_start)
            frame_count = 0
            fps_start = now

        if model is not None:
            results = model.predict(frame, conf=0.35, classes=[0], verbose=False) # Clase 0 = persona
            annotated_frame = results[0].plot() if results else frame
        else:
            annotated_frame = frame

        cv2.putText(annotated_frame, f"FPS: {fps:.1f} | RTSP VTA", (20, 40),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)

        try:
            cv2.imshow("Prueba Camara VTA - Seguridad Vial", annotated_frame)
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break
        except Exception:
            # Entorno sin pantalla GUI
            pass

    cap.release()
    cv2.destroyAllWindows()
    print("[+] Conexión finalizada.")


if __name__ == "__main__":
    main()
