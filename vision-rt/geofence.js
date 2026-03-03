(function attachGeofence(globalScope) {
  'use strict';

  const ZONE_COLORS = ['#ff6b35', '#f7c59f', '#efefd0', '#004e89', '#1a936f'];
  const ZONE_OPACITY_HEX = Math.round(0.18 * 255).toString(16).padStart(2, '0');
  const ZONE_STROKE_WIDTH = 2;
  const MIN_POLYGON_POINTS = 3;

  class Geofence {
    constructor(overlay, ctx) {
      this.overlay = overlay;
      this.ctx = ctx;
      this.zones = [];
      this.drawing = false;
      this.currentPoints = [];
      this.nextZoneId = 1;
      this.onAlert = null;
      this._insideState = new Map();

      this._onPointerDown = this._onPointerDown.bind(this);
      this._onDblClick = this._onDblClick.bind(this);
      this._onKeyDown = this._onKeyDown.bind(this);
    }

    startDrawing() {
      if (this.drawing) return;
      this.drawing = true;
      this.currentPoints = [];
      this.overlay.style.pointerEvents = 'auto';
      this.overlay.style.cursor = 'crosshair';
      this.overlay.addEventListener('pointerdown', this._onPointerDown);
      this.overlay.addEventListener('dblclick', this._onDblClick);
      window.addEventListener('keydown', this._onKeyDown);
    }

    stopDrawing() {
      this.drawing = false;
      this.currentPoints = [];
      this.overlay.style.pointerEvents = 'none';
      this.overlay.style.cursor = '';
      this.overlay.removeEventListener('pointerdown', this._onPointerDown);
      this.overlay.removeEventListener('dblclick', this._onDblClick);
      window.removeEventListener('keydown', this._onKeyDown);
    }

    clearZones() {
      this.zones = [];
      this._insideState.clear();
    }

    _canvasPoint(event) {
      const rect = this.overlay.getBoundingClientRect();
      const scaleX = this.overlay.width / rect.width;
      const scaleY = this.overlay.height / rect.height;
      return {
        x: (event.clientX - rect.left) * scaleX,
        y: (event.clientY - rect.top) * scaleY
      };
    }

    _onPointerDown(event) {
      if (event.detail >= 2) return; // ignore dblclick first click
      this.currentPoints.push(this._canvasPoint(event));
    }

    _onDblClick(event) {
      this._finishZone();
    }

    _onKeyDown(event) {
      if (event.key === 'Enter') this._finishZone();
      if (event.key === 'Escape') this.stopDrawing();
    }

    _finishZone() {
      if (this.currentPoints.length < MIN_POLYGON_POINTS) {
        this.stopDrawing();
        return;
      }
      const colorIndex = this.zones.length % ZONE_COLORS.length;
      this.zones.push({
        id: `Z${String(this.nextZoneId).padStart(3, '0')}`,
        name: `Geocerca ${this.nextZoneId}`,
        polygon: [...this.currentPoints],
        color: ZONE_COLORS[colorIndex],
        active: true
      });
      this.nextZoneId += 1;
      this.stopDrawing();
    }

    _isInsidePolygon(point, polygon) {
      let inside = false;
      for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].x;
        const yi = polygon[i].y;
        const xj = polygon[j].x;
        const yj = polygon[j].y;
        if ((yi > point.y) !== (yj > point.y) && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi) {
          inside = !inside;
        }
      }
      return inside;
    }

    checkTracks(tracks) {
      const alerts = [];
      for (const zone of this.zones) {
        if (!zone.active) continue;
        for (const track of tracks) {
          const key = `${zone.id}-${track.id}`;
          const wasInside = this._insideState.get(key) || false;
          const isInside = this._isInsidePolygon(track.center, zone.polygon);
          this._insideState.set(key, isInside);
          if (isInside && !wasInside) {
            const alert = {
              zone: zone.name,
              trackId: track.id,
              classType: track.classType,
              event: 'enter'
            };
            alerts.push(alert);
            if (typeof this.onAlert === 'function') {
              this.onAlert(alert);
            }
          }
        }
      }
      return alerts;
    }

    render() {
      for (const zone of this.zones) {
        if (!zone.polygon.length) continue;
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.moveTo(zone.polygon[0].x, zone.polygon[0].y);
        for (let i = 1; i < zone.polygon.length; i++) {
          this.ctx.lineTo(zone.polygon[i].x, zone.polygon[i].y);
        }
        this.ctx.closePath();
        this.ctx.fillStyle = zone.color + ZONE_OPACITY_HEX;
        this.ctx.fill();
        this.ctx.strokeStyle = zone.color;
        this.ctx.lineWidth = ZONE_STROKE_WIDTH;
        this.ctx.setLineDash([6, 3]);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
        this.ctx.fillStyle = zone.color;
        this.ctx.font = 'bold 13px Segoe UI';
        this.ctx.fillText(zone.name, zone.polygon[0].x + 4, zone.polygon[0].y - 6);
        this.ctx.restore();
      }

      if (this.drawing && this.currentPoints.length > 0) {
        this.ctx.save();
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 1.5;
        this.ctx.setLineDash([4, 4]);
        this.ctx.beginPath();
        this.ctx.moveTo(this.currentPoints[0].x, this.currentPoints[0].y);
        for (let i = 1; i < this.currentPoints.length; i++) {
          this.ctx.lineTo(this.currentPoints[i].x, this.currentPoints[i].y);
        }
        this.ctx.stroke();
        this.ctx.setLineDash([]);
        for (const pt of this.currentPoints) {
          this.ctx.beginPath();
          this.ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
          this.ctx.fillStyle = '#ffffff';
          this.ctx.fill();
        }
        this.ctx.restore();
      }
    }

    getZoneSummary() {
      return this.zones.map((z) => ({ id: z.id, name: z.name, active: z.active, points: z.polygon.length }));
    }
  }

  globalScope.Geofence = Geofence;
})(window);
