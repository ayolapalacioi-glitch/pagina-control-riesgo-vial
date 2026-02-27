import dotenv from 'dotenv';

dotenv.config();

export const env = {
  port: Number(process.env.PORT || 4000),
  frontendOrigin: process.env.FRONTEND_ORIGIN || '*',
  mqttBrokerUrl: process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883',
  mqttTopic: process.env.MQTT_TOPIC || 'sensecraft/crosswalk/cam-001',
  useMqtt: String(process.env.USE_MQTT || 'false') === 'true',
  dbMode: process.env.DB_MODE || 'lowdb'
};
