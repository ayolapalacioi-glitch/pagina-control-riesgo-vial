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

    def infer(self, image_bgr: np.ndarray) -> list[dict]:
        self._ensure_model()
        if not self.model:
            return []

        results = self.model.predict(image_bgr, conf=self.config.conf_threshold, verbose=False)
        detections: list[dict] = []
        if not results:
            return detections

        result = results[0]
        names = result.names
        boxes = result.boxes

        for i in range(len(boxes)):
            box = boxes[i]
            conf = float(box.conf.item())
            cls_id = int(box.cls.item())
            cls_name = names.get(cls_id, str(cls_id))
            mapped = self.map_class(cls_name)

            xyxy = box.xyxy[0].tolist()
            x1, y1, x2, y2 = [float(v) for v in xyxy]
            w = max(1.0, x2 - x1)
            h = max(1.0, y2 - y1)

            detections.append(
                {
                    "track_id": None,
                    "class_name": mapped,
                    "confidence": conf,
                    "bbox": {"x": x1, "y": y1, "width": w, "height": h},
                }
            )

        return detections


vision_service = VisionService()
