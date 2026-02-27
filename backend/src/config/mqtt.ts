import mqtt, { MqttClient } from 'mqtt';
import { env } from './env';

export function createMqttClient(onMessage: (topic: string, payload: string) => void): MqttClient | null {
  if (!env.useMqtt) return null;

  const client = mqtt.connect(env.mqttBrokerUrl);

  client.on('connect', () => {
    console.log(`[MQTT] Conectado a ${env.mqttBrokerUrl}`);
    client.subscribe(env.mqttTopic, (error) => {
      if (error) {
        console.error('[MQTT] Error al suscribir tópico:', error.message);
      } else {
        console.log(`[MQTT] Suscrito a tópico: ${env.mqttTopic}`);
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
