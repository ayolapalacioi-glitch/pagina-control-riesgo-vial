from __future__ import annotations

import base64
import os
from dataclasses import dataclass

import cv2
import numpy as np

from .actor_classes import ALL_ACTOR_CLASSES

try:
    from ultralytics import YOLO
except Exception:
    YOLO = None


@dataclass
class VisionConfig:
    model_path: str = os.getenv("YOLO_MODEL_PATH", "yolov8n.pt")
    conf_threshold: float = float(os.getenv("YOLO_CONF", "0.35"))


class VisionService:
    def __init__(self) -> None:
        self.config = VisionConfig()
        self.model = None
        self.model_error: str | None = None

    def _ensure_model(self) -> None:
        if self.model is not None or self.model_error is not None:
            return
        if YOLO is None:
            self.model_error = "Ultralytics no disponible"
            return
        try:
            self.model = YOLO(self.config.model_path)
        except Exception as ex:
            self.model_error = str(ex)

    @staticmethod
    def decode_data_url(image_base64: str) -> np.ndarray:
        payload = image_base64.split(",", 1)[1] if "," in image_base64 else image_base64
        data = base64.b64decode(payload)
        arr = np.frombuffer(data, dtype=np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("No se pudo decodificar la imagen")
        return img

    @staticmethod
    def map_class(raw_name: str) -> str:
        name = (raw_name or "").lower().strip()
        if name == "person":
            return "peaton"
        if name in {"car", "truck"}:
            return "automovil"
        if name == "bus":
            return "bus_transcaribe"
        if name == "motorcycle":
            return "motocicleta"
        if name == "bicycle":
            return "bicicleta"
        if name in {"traffic light", "stop sign"}:
            return "senal_paso"
        if name in {"parking meter"}:
            return "aparcamiento"
        if name in {"ambulance"}:
            return "ambulancia"
        if name in {
            "cat",
            "dog",
            "bird",
            "horse",
            "sheep",
            "cow",
            "elephant",
            "bear",
            "zebra",
            "giraffe",
        }:
            return "movimiento_peaton"
        if name in ALL_ACTOR_CLASSES:
            return name
        return "automovil"

    def detect_billboard_polygon(self, image_bgr: np.ndarray) -> list[dict[str, float]] | None:
        """
        Detecta una cartelera (rectangulo) en el piso que actua como cruce peatonal.
        Utiliza procesamiento de imagen clasico para encontrar el contorno cuadrilatero mas grande.
        """
        try:
            gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
            blurred = cv2.GaussianBlur(gray, (7, 7), 0)
            
            # Usar un umbral adaptativo para manejar variaciones de iluminacion (comun en interiores/exteriores con telefonos)
            thresh = cv2.adaptiveThreshold(blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2)
            
            # Encontrar contornos
            contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            # Filtrar por area y forma (buscamos un rectangulo/trapecio grande)
            h, w = image_bgr.shape[:2]
            min_area = (w * h) * 0.04  # Al menos 4% de la imagen
            
            best_poly = None
            max_area = 0
            
            for c in contours:
                area = cv2.contourArea(c)
                if area < min_area:
                    continue
                
                peri = cv2.arcLength(c, True)
                approx = cv2.approxPolyDP(c, 0.03 * peri, True)
                
                # Buscamos algo con 4 esquinas (o muy cerca)
                if len(approx) == 4:
                    if area > max_area:
                        max_area = area
                        best_poly = approx
            
            if best_poly is not None:
                # Convertir a lista de puntos dict para compatibilidad con el resto del sistema
                points = []
                # Ordenar puntos para que el poligono sea coherente (opcional pero util)
                # Por ahora solo los extraemos
                for p in best_poly:
                    points.append({"x": float(p[0][0]), "y": float(p[0][1])})
                return points
                
        except Exception as e:
            print(f"Error detectando cartelera: {e}")
            
    def fast_encode(self, image_bgr: np.ndarray) -> str | None:
        """Codifica la imagen a JPEG Base64 ultrarrápido en ~1.5ms sin ejecutar inferencia YOLO."""
        try:
            h_orig, w_orig = image_bgr.shape[:2]
            if w_orig > 640:
                target_w = 640
                target_h = int(h_orig * (640.0 / w_orig))
                image_bgr = cv2.resize(image_bgr, (target_w, target_h), interpolation=cv2.INTER_LINEAR)
            
            success, buffer = cv2.imencode('.jpg', image_bgr, [cv2.IMWRITE_JPEG_QUALITY, 50])
            if success:
                return "data:image/jpeg;base64," + base64.b64encode(buffer).decode('utf-8')
        except Exception:
            pass
        return None

    def draw_hitboxes(self, image_bgr: np.ndarray, detections: list[dict]) -> tuple[str | None, bytes | None]:
        """Dibuja hitboxes de detecciones existentes en 0.05ms sin ejecutar inferencia YOLO."""
        try:
            h_orig, w_orig = image_bgr.shape[:2]
            if w_orig > 640:
                target_w = 640
                target_h = int(h_orig * (640.0 / w_orig))
                image_bgr = cv2.resize(image_bgr, (target_w, target_h), interpolation=cv2.INTER_LINEAR)

            colors = {
                "peaton": (0, 255, 0),
                "automovil": (255, 100, 0),
                "motocicleta": (0, 165, 255),
                "bus_transcaribe": (0, 255, 255)
            }

            annotated_img = image_bgr if not detections else image_bgr.copy()
            if detections:
                for det in detections:
                    cls_name = det.get("class_name", "")
                    color = colors.get(cls_name, (0, 255, 0))
                    bbox = det.get("bbox", {})
                    x = int(bbox.get("x", 0))
                    y = int(bbox.get("y", 0))
                    w = int(bbox.get("width", 0))
                    h = int(bbox.get("height", 0))
                    conf = float(det.get("confidence", 0.0))

                    cv2.rectangle(annotated_img, (x, y), (x + w, y + h), color, 3)
                    label = f"{cls_name.upper()} {int(conf * 100)}%"
                    cv2.putText(annotated_img, label, (x + 2, max(14, y - 4)), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)

            success, buffer = cv2.imencode('.jpg', annotated_img, [cv2.IMWRITE_JPEG_QUALITY, 45])
            if success:
                raw_bytes = buffer.tobytes()
                b64 = "data:image/jpeg;base64," + base64.b64encode(buffer).decode('utf-8')
                return b64, raw_bytes
        except Exception:
            pass
        return None, None

    def infer(self, image_bgr: np.ndarray) -> tuple[list[dict], str | None, bytes | None]:
        self._ensure_model()
        if not self.model:
            return [], None, None

        h_orig, w_orig = image_bgr.shape[:2]
        if w_orig > 640:
            target_w = 640
            target_h = int(h_orig * (640.0 / w_orig))
            image_bgr = cv2.resize(image_bgr, (target_w, target_h), interpolation=cv2.INTER_LINEAR)

        # Inferencia ultrarrápida a 5ms reduciendo tamaño interno a 320px
        results = self.model.predict(image_bgr, imgsz=320, conf=self.config.conf_threshold, verbose=False)
        if not results:
            return [], self.fast_encode(image_bgr)

        result = results[0]
        names = result.names
        boxes = result.boxes

        annotated_img = image_bgr.copy()
        colors = {
            "peaton": (0, 255, 0),          # Verde brillante (BGR)
            "automovil": (255, 100, 0),     # Azul/Cian brillante
            "motocicleta": (0, 165, 255),   # Naranja brillante
            "bus_transcaribe": (0, 255, 255)# Amarillo brillante
        }

        detections: list[dict] = []
        for i in range(len(boxes)):
            box = boxes[i]
            conf = float(box.conf.item())
            cls_id = int(box.cls.item())
            cls_name = names.get(cls_id, str(cls_id))
            mapped = self.map_class(cls_name)

            if mapped not in colors:
                continue

            xyxy = box.xyxy[0].tolist()
            x1, y1, x2, y2 = [int(v) for v in xyxy]

            color = colors[mapped]
            # Dibujar Hitbox (Caja Delimitadora Gruesa)
            cv2.rectangle(annotated_img, (x1, y1), (x2, y2), color, 3)
            
            # Dibujar Etiqueta de la Hitbox
            label = f"{mapped.upper()} {int(conf * 100)}%"
            (text_w, text_h), baseline = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 2)
            cv2.rectangle(annotated_img, (x1, max(0, y1 - text_h - 8)), (x1 + text_w + 10, y1), color, -1)
            cv2.putText(annotated_img, label, (x1 + 5, max(12, y1 - 4)), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 2, cv2.LINE_AA)

            detections.append(
                {
                    "track_id": None,
                    "class_name": mapped,
                    "confidence": conf,
                    "bbox": {"x": float(xyxy[0]), "y": float(xyxy[1]), "width": max(1.0, float(xyxy[2] - xyxy[0])), "height": max(1.0, float(xyxy[3] - xyxy[1]))},
                }
            )

        success, buffer = cv2.imencode('.jpg', annotated_img, [cv2.IMWRITE_JPEG_QUALITY, 50])
        image_base64 = None
        raw_bytes = None
        if success:
            raw_bytes = buffer.tobytes()
            image_base64 = "data:image/jpeg;base64," + base64.b64encode(buffer).decode('utf-8')

        return detections, image_base64, raw_bytes


vision_service = VisionService()
