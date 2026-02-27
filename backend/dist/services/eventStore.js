"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveEvent = saveEvent;
exports.getAllEvents = getAllEvents;
exports.getEventsSince = getEventsSince;
const db_1 = require("../config/db");
async function saveEvent(event) {
    const db = await db_1.dbPromise;
    db.data.nearMissEvents.push(event);
    const maxEvents = 5000;
    if (db.data.nearMissEvents.length > maxEvents) {
        db.data.nearMissEvents = db.data.nearMissEvents.slice(-maxEvents);
    }
    await db.write();
}
async function getAllEvents() {
    const db = await db_1.dbPromise;
    return db.data.nearMissEvents;
}
async function getEventsSince(hoursBack) {
    const now = Date.now();
    const minTs = now - hoursBack * 3600 * 1000;
    const events = await getAllEvents();
    return events.filter((event) => new Date(event.timestamp).getTime() >= minTs);
}
