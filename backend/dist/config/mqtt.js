"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMqttClient = createMqttClient;
const mqtt_1 = __importDefault(require("mqtt"));
const env_1 = require("./env");
function createMqttClient(onMessage) {
    if (!env_1.env.useMqtt)
        return null;
    const client = mqtt_1.default.connect(env_1.env.mqttBrokerUrl);
    client.on('connect', () => {
        console.log(`[MQTT] Conectado a ${env_1.env.mqttBrokerUrl}`);
        client.subscribe(env_1.env.mqttTopic, (error) => {
            if (error) {
                console.error('[MQTT] Error al suscribir tópico:', error.message);
            }
            else {
                console.log(`[MQTT] Suscrito a tópico: ${env_1.env.mqttTopic}`);
            }
        });
    });
    client.on('message', (topic, message) => {
        onMessage(topic, message.toString());
    });
    client.on('error', (err) => {
        console.error('[MQTT] Error:', err.message);
    });
    return client;
}
