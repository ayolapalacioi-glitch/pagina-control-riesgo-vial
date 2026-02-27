"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.env = {
    port: Number(process.env.PORT || 4000),
    frontendOrigin: process.env.FRONTEND_ORIGIN || '*',
    mqttBrokerUrl: process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883',
    mqttTopic: process.env.MQTT_TOPIC || 'sensecraft/crosswalk/cam-001',
    useMqtt: String(process.env.USE_MQTT || 'false') === 'true',
    dbMode: process.env.DB_MODE || 'lowdb'
};
