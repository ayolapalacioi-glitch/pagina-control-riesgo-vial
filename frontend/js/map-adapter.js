(function attachMapAdapter(globalScope) {
  class MapAdapter {
    constructor(bounds) {
      this.bounds = bounds || {
        north: 10.4265,
        south: 10.4203,
        east: -75.5402,
        west: -75.5498
      };
    }

    setMapBounds(bounds) {
      this.bounds = {
        ...this.bounds,
        ...bounds
      };
    }

    normalizePoint(point, canvasSize) {
      const width = Math.max(1, canvasSize.width || 1);
      const height = Math.max(1, canvasSize.height || 1);
      return {
        x: Math.min(1, Math.max(0, point.x / width)),
        y: Math.min(1, Math.max(0, point.y / height))
      };
    }

    toLatLng(point, canvasSize) {
      const normalized = this.normalizePoint(point, canvasSize);
      const lat = this.bounds.north - (this.bounds.north - this.bounds.south) * normalized.y;
      const lng = this.bounds.west + (this.bounds.east - this.bounds.west) * normalized.x;
      return { lat, lng };
    }

    mapTrack(track, canvasSize) {
      const center = track.center || {
        x: track.bbox.x + track.bbox.w / 2,
        y: track.bbox.y + track.bbox.h / 2
      };

      return {
        id: track.id,
        classType: track.classType,
        score: track.score,
        center,
        latLng: this.toLatLng(center, canvasSize),
        bbox: track.bbox,
        predicted: track.predicted || null,
        trail: track.trail || []
      };
    }
  }

  globalScope.MapAdapter = MapAdapter;
})(window);
