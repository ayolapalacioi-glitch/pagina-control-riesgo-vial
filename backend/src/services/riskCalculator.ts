import { NearMissEvent, RiskLevel, SenseCraftFramePayload, TrackedActor } from '../types';
import { computePET, computeTTC, predictedConflictWithinSeconds } from './prediction';
import { PEDESTRIAN_CLASSES, VEHICLE_CLASSES } from '../constants/actorClasses';

function classifyRisk(score: number): RiskLevel {
  if (score >= 90) return 'CRITICO';
  if (score >= 65) return 'ALTO';
  if (score >= 40) return 'MEDIO';
  return 'BAJO';
}

export function calculateRisk(payload: SenseCraftFramePayload, tracks: TrackedActor[], source: NearMissEvent['source']): NearMissEvent | null {
  const pedestrians = tracks.filter((x) => PEDESTRIAN_CLASSES.has(x.className));
  const vehicles = tracks.filter((x) => VEHICLE_CLASSES.has(x.className));

  if (!pedestrians.length || !vehicles.length) return null;

  let bestEvent: NearMissEvent | null = null;
  let bestScore = -1;

  for (const pedestrian of pedestrians) {
    for (const vehicle of vehicles) {
      const ttc = computeTTC(vehicle, pedestrian);
      const pet = computePET(vehicle, pedestrian);
      const hasFutureConflict = predictedConflictWithinSeconds(vehicle, pedestrian);
      const factors: string[] = [];
      let score = 10;

      if (pedestrian.inCrosswalk) {
        score += 25;
        factors.push('Peatón en zona de cebra');
      }

      if (vehicle.headingToCrosswalk) {
        score += 20;
        factors.push('Vehículo con trayectoria hacia cebra');
      }

      if (vehicle.speedKmh > 30) {
        score += 20;
        factors.push(`Velocidad vehicular alta (${vehicle.speedKmh.toFixed(1)} km/h)`);
      }

      if (vehicle.className === 'ambulancia') {
        score += 15;
        factors.push('Vehículo de emergencia en zona de conflicto');
      }

      if (ttc !== null) {
        if (ttc < 2.5) {
          score += 30;
          factors.push(`TTC crítico (${ttc.toFixed(2)} s)`);
        } else if (ttc < 4) {
          score += 15;
          factors.push(`TTC preventivo (${ttc.toFixed(2)} s)`);
        }
      }

      if (pet !== null) {
        if (pet < 1.5) {
          score += 20;
          factors.push(`PET crítico (${pet.toFixed(2)} s)`);
        } else if (pet < 3) {
          score += 10;
          factors.push(`PET bajo (${pet.toFixed(2)} s)`);
        }
      }

      if (hasFutureConflict) {
        score += 25;
        factors.push('Predicción de conflicto entre 1-5 segundos');
      }

      const riskLevel = classifyRisk(score);
      if (score > bestScore) {
        bestScore = score;
        bestEvent = {
          event_id: `${payload.camera_id}-${Date.now()}-${vehicle.trackId}-${pedestrian.trackId}`,
          camera_id: payload.camera_id,
          timestamp: payload.timestamp,
          gps: payload.gps,
          risk_level: riskLevel,
          ttc_seconds: ttc,
          pet_seconds: pet,
          vehicle,
          pedestrian,
          factors,
          recommended_action: riskLevel === 'CRITICO'
            ? 'Activar alerta visual/sonora inmediata y priorizar paso peatonal.'
            : riskLevel === 'ALTO'
              ? 'Advertencia preventiva a conductores y monitoreo en tiempo real.'
              : 'Monitoreo continuo y campañas de sensibilización.',
          source
        };
      }
    }
  }

  return bestEvent;
}
