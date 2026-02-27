import { dbPromise } from '../config/db';
import { NearMissEvent } from '../types';

export async function saveEvent(event: NearMissEvent): Promise<void> {
  const db = await dbPromise;
  db.data.nearMissEvents.push(event);
  const maxEvents = 5000;
  if (db.data.nearMissEvents.length > maxEvents) {
    db.data.nearMissEvents = db.data.nearMissEvents.slice(-maxEvents);
  }
  await db.write();
}

export async function getAllEvents(): Promise<NearMissEvent[]> {
  const db = await dbPromise;
  return db.data.nearMissEvents;
}

export async function getEventsSince(hoursBack: number): Promise<NearMissEvent[]> {
  const now = Date.now();
  const minTs = now - hoursBack * 3600 * 1000;
  const events = await getAllEvents();
  return events.filter((event) => new Date(event.timestamp).getTime() >= minTs);
}
