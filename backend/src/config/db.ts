import path from 'path';
import { JSONFilePreset } from 'lowdb/node';
import { NearMissEvent } from '../types';

type DbSchema = {
  nearMissEvents: NearMissEvent[];
};

const dbFilePath = path.resolve(process.cwd(), '../data/mock-near-miss-events.json');

export const dbPromise = JSONFilePreset<DbSchema>(dbFilePath, {
  nearMissEvents: []
});
