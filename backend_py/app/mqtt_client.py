from __future__ import annotations

import json
import paho.mqtt.client as mqtt


class MqttBridge:
    def __init__(self, broker_url: str, topic: str, enabled: bool, on_payload):
        self.broker_url = broker_url
        self.topic = topic
        self.enabled = enabled
        self.on_payload = on_payload
        self.client: mqtt.Client | None = None

    def start(self) -> None:
        if not self.enabled:
            return

        host, port = self._parse_broker(self.broker_url)
        self.client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)

        def on_connect(client, userdata, flags, reason_code, properties):
            if reason_code == 0:
                client.subscribe(self.topic)

        def on_message(client, userdata, msg):
            try:
                payload = json.loads(msg.payload.decode("utf-8"))
                self.on_payload(payload, "mqtt")
            except Exception:
                return

        self.client.on_connect = on_connect
        self.client.on_message = on_message
        self.client.connect(host, port, 60)
        self.client.loop_start()

    @staticmethod
    def _parse_broker(url: str) -> tuple[str, int]:
        cleaned = url.replace("mqtt://", "")
        if ":" in cleaned:
            host, port = cleaned.rsplit(":", 1)
            return host, int(port)
        return cleaned, 1883
