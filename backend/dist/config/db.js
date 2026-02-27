"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dbPromise = void 0;
const path_1 = __importDefault(require("path"));
const node_1 = require("lowdb/node");
const dbFilePath = path_1.default.resolve(process.cwd(), '../data/mock-near-miss-events.json');
exports.dbPromise = (0, node_1.JSONFilePreset)(dbFilePath, {
    nearMissEvents: []
});
