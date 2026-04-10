from __future__ import annotations

from typing import Any, Literal, Optional
from pydantic import BaseModel, Field


RiskLevel = Literal["BAJO", "MEDIO", "ALTO", "CRITICO"]


class Point(BaseModel):
    x: float
    y: float


class GPS(BaseModel):
    lat: float
    lng: float


class FrameSize(BaseModel):
    width: int
    height: int


class DetectionBBox(BaseModel):
    x: float
    y: float
    width: float
    height: float


class SenseDetection(BaseModel):
    track_id: Optional[str] = None
    class_name: str
    confidence: float
    bbox: DetectionBBox


class FramePayload(BaseModel):
    camera_id: str
    timestamp: str
    gps: GPS
    frame_size: FrameSize
    crosswalk_polygon: list[Point] = Field(min_length=3)
    detections: list[SenseDetection]


class TrackedActor(BaseModel):
    trackId: str
    className: str
    score: float
    bbox: dict[str, float]
    center: dict[str, float]
    velocityPxPerSec: dict[str, float]
    speedKmh: float
    headingToCrosswalk: bool
    inCrosswalk: bool
    predictedPath: list[dict[str, float]]
    trail: list[dict[str, float]]


class NearMissEvent(BaseModel):
    event_id: str
    camera_id: str
    timestamp: str
    gps: GPS
    risk_level: RiskLevel
    ttc_seconds: Optional[float] = None
    pet_seconds: Optional[float] = None
    vehicle: Optional[TrackedActor] = None
    pedestrian: Optional[TrackedActor] = None
    factors: list[str]
    recommended_action: str
    source: Literal["mqtt", "http", "mock"]


class VisionInferRequest(BaseModel):
    camera_id: str
    timestamp: Optional[str] = None
    gps: GPS
    frame_size: Optional[FrameSize] = None
    crosswalk_polygon: Optional[list[Point]] = None
    image_base64: str


class VisionInferResponse(BaseModel):
    ok: bool
    snapshot: dict[str, Any]
    tracks: list[dict[str, Any]]
    metrics: dict[str, Any]
    envelope: dict[str, Any]
    events: list[dict[str, Any]]
