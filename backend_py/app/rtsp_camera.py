from __future__ import annotations

import asyncio
import base64
import logging
import os
import threading
import time
import math
from typing import Any, Callable, Coroutine

import cv2
import numpy as np

from .models import FramePayload
from .vision_service import vision_service

import queue

logger = logging.getLogger("rtsp_camera")


class ThreadedFrameGrabber:
    def __init__(self, cap):
        self.cap = cap
        self.q = queue.Queue(maxsize=1)
        self.stopped = False
        self.thread = threading.Thread(target=self._grabber, daemon=True)
        self.thread.start()

    def _grabber(self):
        while not self.stopped and self.cap.isOpened():
            try:
                ret, frame = self.cap.read()
                if not ret or frame is None or frame.size == 0:
                    time.sleep(0.005)
                    continue
                if not self.q.empty():
                    try:
                        self.q.get_nowait()
                    except queue.Empty:
                        pass
                self.q.put(frame)
            except Exception:
                time.sleep(0.005)

    def read(self):
        try:
            return True, self.q.get_nowait()
        except queue.Empty:
            return False, None

    def stop(self):
        self.stopped = True


class AsyncVisionWorker:
    def __init__(self, vision_service):
        self.vision_service = vision_service
        self.input_q = queue.Queue(maxsize=1)
        self.latest_detections = []
        self.lock = threading.Lock()
        self.stopped = False
        self.thread = threading.Thread(target=self._worker, daemon=True)
        self.thread.start()

    def _worker(self):
        while not self.stopped:
            try:
                frame = self.input_q.get(timeout=0.1)
                detections, _, _ = self.vision_service.infer(frame)
                with self.lock:
                    self.latest_detections = detections or []
            except queue.Empty:
                pass
            except Exception:
                time.sleep(0.01)

    def submit_frame(self, frame):
        if not self.input_q.full():
            try:
                self.input_q.put_nowait(frame)
            except queue.Full:
                pass

    def get_detections(self):
        with self.lock:
            return list(self.latest_detections)

    def stop(self):
        self.stopped = True


class RtspCameraManager:
    """
    Gestor de streaming en tiempo real para cámaras IP/WiFi (VTA-84920).
    Se conecta mediante protocolo RTSP en un hilo secundario, procesa fotogramas
    con YOLOv8 y notifica los eventos al motor de riesgo y al frontend.
    """

    def __init__(self) -> None:
        self.enabled: bool = str(os.getenv("RTSP_CAMERA_ENABLE", "true")).lower() == "true"
        self.user: str = os.getenv("RTSP_CAMERA_USER", "BmU0FIYfd")
        self.password: str = os.getenv("RTSP_CAMERA_PASS", "Ayolaisaac444")
        self.ip: str = os.getenv("RTSP_CAMERA_IP", "192.168.1.10")
        self.port: int = int(os.getenv("RTSP_CAMERA_PORT", "554"))
        self.path: str = os.getenv("RTSP_CAMERA_PATH", "/live/ch0")
        self.frame_skip: int = max(1, int(os.getenv("RTSP_FRAME_SKIP", "2")))
        self.custom_url: str = os.getenv("RTSP_CAMERA_URL", "").strip()

        self.tuya_client_id: str = os.getenv("TUYA_CLIENT_ID", "").strip()
        self.tuya_client_secret: str = os.getenv("TUYA_CLIENT_SECRET", "").strip()
        self.tuya_device_id: str = os.getenv("TUYA_DEVICE_ID", "").strip()
        self.tuya_region: str = os.getenv("TUYA_REGION", "us").lower().strip()

        self.camera_id: str = "cam-vta-rtsp"
        self.status: str = "DISCONNECTED"  # DISCONNECTED, CONNECTING, CONNECTED, RECONNECTING, ERROR
        self.last_frame_at: str | None = None
        self.last_error: str | None = None
        self.current_fps: float = 0.0
        self.processed_frames: int = 0
        self.reconnect_count: int = 0
        self.active_url: str | None = None
        self.latest_jpeg_bytes: bytes | None = None

        self._thread: threading.Thread | None = None
        self._stop_event = threading.Event()
        self._loop: asyncio.AbstractEventLoop | None = None
        self._frame_callback: Callable[[FramePayload, str, str | None], Coroutine[Any, Any, None]] | None = None

    def get_latest_mjpeg_bytes(self) -> bytes | None:
        return self.latest_jpeg_bytes

    def fetch_tuya_stream_url(self) -> str | None:
        """Obtiene la URL de transmisión de video HLS/RTSP en vivo asignada por Tuya Cloud para la cámara VTA."""
        if not self.tuya_client_id or not self.tuya_client_secret or not self.tuya_device_id:
            return None
        try:
            import tinytuya
            cloud = tinytuya.Cloud(apiRegion=self.tuya_region, apiKey=self.tuya_client_id, apiSecret=self.tuya_client_secret)
            # Priorizar tipo 'rtsp' (RTSPS 360p ultrarrápido) y luego 'flv' y 'hls'
            for stype in ["rtsp", "flv", "hls"]:
                res = cloud.cloudrequest(f"/v1.0/devices/{self.tuya_device_id}/stream/actions/allocate", action="POST", post={"type": stype})
                if isinstance(res, dict) and res.get("success") and res.get("result"):
                    url = res["result"].get("url")
                    if url:
                        logger.info(f"¡¡URL de transmisión '{stype}' asignada con éxito por Tuya Cloud para la cámara VTA!! {url[:60]}...")
                        return url
        except Exception as ex:
            logger.error(f"Fallo al solicitar URL de transmisión en Tuya Cloud: {ex}")
        return None

    def _fetch_tuya_cloud_frame(self):
        """Consulta fotogramas/snapshots desde la API de Tuya Cloud si están disponibles."""
        if not self.tuya_client_id or not self.tuya_device_id:
            return None
        try:
            import tinytuya, base64, json, numpy as np
            from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
            from cryptography.hazmat.backends import default_backend

            cloud = tinytuya.Cloud(apiRegion=self.tuya_region, apiKey=self.tuya_client_id, apiSecret=self.tuya_client_secret)
            status = cloud.getstatus(self.tuya_device_id)

            if isinstance(status, dict) and status.get("success"):
                for item in status.get("result", []):
                    if item.get("code") == "initiative_message":
                        val = item.get("value")
                        if not val:
                            continue
                        msg_json = json.loads(base64.b64decode(val).decode("utf-8"))
                        files = msg_json.get("files", [])
                        if not files:
                            continue
                        file_info = files[0]
                        enc_data = bytes.fromhex(file_info["data"])
                        iv = bytes.fromhex(file_info["iv"])

                        raw_key = b")J>j0`L-WrzPL=V@"
                        key_padded = raw_key.ljust(16, b"\0") if len(raw_key) < 16 else raw_key[:16]

                        cipher = Cipher(algorithms.AES(key_padded), modes.CBC(iv), backend=default_backend())
                        decrypted = cipher.decryptor().update(enc_data)

                        nparr = np.frombuffer(decrypted, np.uint8)
                        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                        if frame is not None and frame.size > 0:
                            return frame
        except Exception:
            pass
        return None

    def _create_vta_camera_active_frame(self):
        """Genera un fotograma limpio de monitor en vivo para evitar pantallas negras mientras no se reciban imágenes del lente."""
        import numpy as np, time
        h, w = 720, 1280
        frame = np.zeros((h, w, 3), dtype=np.uint8)
        frame[:, :] = (25, 25, 30)

        # Barra superior con estado en vivo
        cv2.rectangle(frame, (0, 0), (w, 80), (15, 15, 20), -1)
        cv2.rectangle(frame, (0, 78), (w, 80), (0, 230, 255), -1)

        now_str = time.strftime("%Y-%m-%d %H:%M:%S")
        cv2.putText(frame, f"CAMARA VTA-84920 EN VIVO (IP Estatica: {self.ip})", (30, 48), cv2.FONT_HERSHEY_SIMPLEX, 0.85, (255, 255, 255), 2)
        cv2.putText(frame, f"{now_str}", (w - 300, 48), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 128), 2)

        # Indicador central de estado
        cv2.circle(frame, (int(w/2), int(h/2) - 30), 45, (0, 230, 255), 3)
        cv2.putText(frame, "CAMARA VTA EN ESCUCHA", (int(w/2) - 160, int(h/2) + 40), cv2.FONT_HERSHEY_SIMPLEX, 0.85, (255, 255, 255), 2)
        cv2.putText(frame, f"Conectado a IP {self.ip} | Esperando fotograma del lente", (int(w/2) - 230, int(h/2) + 80), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (0, 200, 220), 1)

        return frame




    def build_candidate_urls(self) -> list[str]:
        """Genera una lista de URLs RTSP candidatas combinando Tuya Cloud, go2rtc e IP locales."""
        candidates = []

        # 1. Probar URL de transmisión en vivo de Tuya Cloud API PRIMERO
        tuya_url = self.fetch_tuya_stream_url()
        if tuya_url:
            candidates.append(tuya_url)

        # 2. Probar puente local go2rtc (RTSP y HTTP MJPEG)
        candidates.append("rtsp://go2rtc:8554/vta_camera")
        candidates.append("http://go2rtc:1984/api/frame.jpeg?src=vta_camera")
        candidates.append("rtsp://localhost:8554/vta_camera")
        candidates.append("http://localhost:1984/api/frame.jpeg?src=vta_camera")

        # 3. Probar URL personalizada si se configuró
        if self.custom_url and self.custom_url not in candidates:
            candidates.append(self.custom_url)

        ip = self.ip.strip()
        port = self.port
        user = self.user.strip()
        password = self.password.strip()

        paths = [
            self.path,
            "/live/ch0",
            "/stream1",
            "/h264Preview_01_main",
            "/ch0",
            "/onvif1",
            "/live/ch1",
        ]
        unique_paths = []
        for p in paths:
            if p not in unique_paths:
                unique_paths.append(p)

        users = [user, "admin", "ayolapalacioi@gmail.com"]
        unique_users = []
        for u in users:
            if u and u not in unique_users:
                unique_users.append(u)

        for u in unique_users:
            for p in unique_paths:
                route = p if p.startswith("/") else f"/{p}"
                url = f"rtsp://{u}:{password}@{ip}:{port}{route}"
                if url not in candidates:
                    candidates.append(url)

        return candidates

    def mask_url(self, url: str | None) -> str:
        if not url:
            return ""
        if "@" in url and ":" in url:
            try:
                proto, rest = url.split("://", 1)
                creds, host_path = rest.split("@", 1)
                if ":" in creds:
                    u, _ = creds.split(":", 1)
                    return f"{proto}://{u}:****@{host_path}"
            except Exception:
                pass
        return url

    def get_status(self) -> dict[str, Any]:
        return {
            "enabled": self.enabled,
            "status": self.status,
            "ip": self.ip,
            "user": self.user,
            "port": self.port,
            "path": self.path,
            "activeUrl": self.mask_url(self.active_url),
            "lastFrameAt": self.last_frame_at,
            "fps": round(self.current_fps, 1),
            "processedFrames": self.processed_frames,
            "reconnectCount": self.reconnect_count,
            "lastError": self.last_error,
        }

    def update_config(
        self,
        ip: str | None = None,
        user: str | None = None,
        password: str | None = None,
        path: str | None = None,
        url: str | None = None,
        tuya_client_id: str | None = None,
        tuya_client_secret: str | None = None,
        tuya_device_id: str | None = None,
        enabled: bool | None = None,
    ) -> None:
        if ip is not None:
            self.ip = ip.strip()
        if user is not None:
            self.user = user.strip()
        if password is not None:
            self.password = password.strip()
        if path is not None:
            self.path = path.strip()
        if url is not None:
            self.custom_url = url.strip()
        if tuya_client_id is not None:
            self.tuya_client_id = tuya_client_id.strip()
        if tuya_client_secret is not None:
            self.tuya_client_secret = tuya_client_secret.strip()
        if tuya_device_id is not None:
            self.tuya_device_id = tuya_device_id.strip()
        if enabled is not None:
            self.enabled = enabled
        if enabled is not None:
            self.enabled = enabled

        logger.info(f"Configuración de cámara RTSP actualizada: IP={self.ip}, Enabled={self.enabled}")
        if self.enabled and self._thread and self._thread.is_alive():
            self.reconnect_count += 1
            self.status = "RECONNECTING"

    def start(
        self,
        event_loop: asyncio.AbstractEventLoop,
        process_frame_callback: Callable[[FramePayload, str, str | None], Coroutine[Any, Any, None]],
    ) -> None:
        if not self.enabled:
            logger.info("Cámara RTSP desactivada por configuración.")
            self.status = "DISABLED"
            return

        if self._thread and self._thread.is_alive():
            logger.warning("El hilo de captura RTSP ya está en ejecución.")
            return

        self._loop = event_loop
        self._frame_callback = process_frame_callback
        self._stop_event.clear()

        self._thread = threading.Thread(target=self._worker_loop, daemon=True, name="RtspWorkerThread")
        self._thread.start()
        logger.info("Iniciado hilo de background para captura de cámara RTSP VTA.")

    def stop(self) -> None:
        self._stop_event.set()
        self.status = "DISCONNECTED"
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=3.0)
        logger.info("Hilo de cámara RTSP detenido.")

    def _worker_loop(self) -> None:
        while not self._stop_event.is_set():
            if not self.enabled:
                self.status = "DISABLED"
                time.sleep(1.0)
                continue

            candidates = self.build_candidate_urls()
            cap = None
            successful_url = None

            self.status = "CONNECTING"
            logger.info(f"Intentando conectar a cámara VTA IP {self.ip} RTSP...")

            for url in candidates:
                if self._stop_event.is_set():
                    break
                masked = self.mask_url(url)
                logger.info(f"Probando URL RTSP: {masked}")

                try:
                    ffmpeg_opts = "rtsp_transport;tcp|fflags;nobuffer+fastseek|buffer_size;1048576|max_delay;100000|probesize;32|analyzeduration;0|stimeout;3000000"
                    os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = ffmpeg_opts

                    test_cap = cv2.VideoCapture(url) if url.startswith("http") else cv2.VideoCapture(url, cv2.CAP_FFMPEG)
                    if test_cap.isOpened():
                        ret, test_frame = test_cap.read()
                        if ret and test_frame is not None and test_frame.size > 0:
                            cap = test_cap
                            successful_url = url
                            self.active_url = url
                            self.status = "CONNECTED"
                            self.last_error = None
                            logger.info(f"¡¡CONEXION EXITOSA EN VIVO A LA CAMARA VTA!! URL: {masked}")
                            break

                    test_cap.release()
                except Exception as ex:
                    self.last_error = str(ex)
                    logger.debug(f"Fallo al probar URL {masked}: {ex}")

            if cap is None or not cap.isOpened():
                # Intentar solicitar una URL fresca de transmisión en vivo a Tuya Cloud
                if self.tuya_client_id and self.tuya_device_id:
                    fresh_url = self.fetch_tuya_stream_url()
                    if fresh_url:
                        ffmpeg_opts = "rtsp_transport;tcp|fflags;nobuffer+fastseek|buffer_size;1048576|max_delay;100000|probesize;32|analyzeduration;0|stimeout;3000000"
                        os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = ffmpeg_opts
                        fresh_cap = cv2.VideoCapture(fresh_url, cv2.CAP_FFMPEG)
                        if fresh_cap.isOpened():
                            ret, f_frame = fresh_cap.read()
                            if ret and f_frame is not None and f_frame.size > 0:
                                cap = fresh_cap
                                self.active_url = fresh_url
                                self.status = "CONNECTED"
                                self.last_error = None
                                logger.info("¡¡STREAM HLS EN VIVO CONECTADO CON EXITO A LA CAMARA VTA!!")

            if cap is None or not cap.isOpened():
                self.status = "ERROR"
                self.last_error = f"No se pudo establecer flujo de video con la cámara VTA (IP {self.ip})."
                self.reconnect_count += 1
                logger.warning(f"{self.last_error}. Reintentando en 5 segundos...")

                for _ in range(50):
                    if self._stop_event.is_set():
                        break
                    time.sleep(0.1)
                continue

            frame_count = 0
            fps_counter = 0
            fps_start = time.time()

            billboard_mode = str(os.getenv("BILLBOARD_MODE", "true")).lower() == "true"
            latest_billboard_poly = None

            grabber = ThreadedFrameGrabber(cap)
            vision_worker = AsyncVisionWorker(vision_service)
            empty_frame_counter = 0
            last_real_frame = None
            target_interval = 0.0333  # 30.0 FPS sostenidos (33ms)
            last_emit_t = time.time()

            try:
                while not self._stop_event.is_set() and cap.isOpened():
                    try:
                        ret, frame = grabber.read()
                        if ret and frame is not None and frame.size > 0:
                            last_real_frame = frame
                            empty_frame_counter = 0
                        else:
                            empty_frame_counter += 1
                            if empty_frame_counter > 200:
                                logger.warning("Pérdida real de señal en el flujo de video VTA. Reintentando...")
                                break

                        if last_real_frame is None:
                            time.sleep(0.005)
                            continue

                        # Enviar cuadro al trabajador de IA asíncrono
                        vision_worker.submit_frame(last_real_frame)

                        # Control de ritmo estricto a 30 FPS (33ms) sin ninguna pausa
                        now_t = time.time()
                        sleep_dur = target_interval - (now_t - last_emit_t)
                        if sleep_dur > 0:
                            time.sleep(sleep_dur)
                        last_emit_t = time.time()

                        frame_count += 1
                        fps_counter += 1

                        if last_emit_t - fps_start >= 1.0:
                            self.current_fps = fps_counter / (last_emit_t - fps_start)
                            fps_counter = 0
                            fps_start = last_emit_t

                        h, w = last_real_frame.shape[:2]

                        # Obtener detecciones e imprevistos de IA sin detener la transmisión ni 1ms
                        detections = vision_worker.get_detections()
                        image_annotated_base64, raw_jpeg_bytes = vision_service.draw_hitboxes(last_real_frame, detections)

                        if raw_jpeg_bytes:
                            self.latest_jpeg_bytes = raw_jpeg_bytes
                        if not image_annotated_base64:
                            image_annotated_base64 = vision_service.fast_encode(last_real_frame)

                        dynamic_crosswalk = None
                        if billboard_mode:
                            if frame_count % 30 == 0 or latest_billboard_poly is None:
                                detected_poly = vision_service.detect_billboard_polygon(last_real_frame)
                                if detected_poly:
                                    latest_billboard_poly = detected_poly
                            dynamic_crosswalk = latest_billboard_poly

                        from datetime import datetime, timezone
                        timestamp = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

                        crosswalk = dynamic_crosswalk or [
                            {"x": w * 0.34, "y": h * 0.53},
                            {"x": w * 0.66, "y": h * 0.53},
                            {"x": w * 0.74, "y": h * 0.90},
                            {"x": w * 0.26, "y": h * 0.90},
                        ]

                        payload = FramePayload(
                            camera_id=self.camera_id,
                            timestamp=timestamp,
                            gps={"lat": 10.4236, "lng": -75.5457},
                            frame_size={"width": w, "height": h},
                            crosswalk_polygon=crosswalk,
                            detections=detections,
                        )

                        self.processed_frames += 1
                        self.last_frame_at = timestamp

                        if self._loop and self._frame_callback:
                            asyncio.run_coroutine_threadsafe(
                                self._frame_callback(payload, "rtsp_vta", image_annotated_base64),
                                self._loop,
                            )

                    except Exception as ex:
                        logger.error(f"Error procesando cuadro RTSP: {ex}")
                        self.last_error = str(ex)
                        break
            finally:
                vision_worker.stop()
                grabber.stop()

            if cap:
                cap.release()

            self.status = "RECONNECTING"
            self.reconnect_count += 1
            time.sleep(2.0)


rtsp_camera_manager = RtspCameraManager()
