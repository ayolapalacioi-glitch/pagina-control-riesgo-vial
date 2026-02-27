(function attachVisionFrameSchema(globalScope) {
  class VisionFrameSchema {
    static buildObjectsEnvelope({
      cameraId,
      timestamp,
      risk,
      ttc,
      pet,
      vRel,
      objects,
      events
    }) {
      return {
        schema: 'vision-frame/v1',
        cameraId,
        timestamp,
        state: {
          risk,
          ttc,
          pet,
          vRel
        },
        objects: Array.isArray(objects) ? objects : [],
        events: Array.isArray(events) ? events : []
      };
    }
  }

  globalScope.VisionFrameSchema = VisionFrameSchema;
})(window);
