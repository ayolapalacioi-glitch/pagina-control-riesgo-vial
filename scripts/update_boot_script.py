import os
import sys
import paramiko

host = os.environ.get('RPI_HOST', sys.argv[1] if len(sys.argv) > 1 else '192.168.1.12')
username = 'juanes08'
password = 'juanes123'

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(host, username=username, password=password, timeout=10)

script_body = """#!/bin/bash
exec > /boot/firmware/wifi_setup.log 2>&1
echo "=== Setup WiFi script running at $(date) ==="

for i in $(seq 1 20); do
    if nmcli general status >/dev/null 2>&1; then
        echo "NetworkManager is ready (try $i)"
        break
    fi
    sleep 1
done

rfkill unblock wifi >/dev/null 2>&1 || true

add_or_update_wifi() {
    name="$1"
    ssid="$2"
    psk="$3"
    prio="${4:-100}"
    echo "Configuring: $name (Priority: $prio)"
    nmcli connection delete "$name" >/dev/null 2>&1 || true
    nmcli connection add type wifi con-name "$name" ifname wlan0 ssid "$ssid" wifi-sec.key-mgmt wpa-psk wifi-sec.psk "$psk" autoconnect yes || true
    nmcli connection modify "$name" connection.autoconnect-priority "$prio" connection.autoconnect-retries 0 || true
}

# 1. Si existe wifi.txt en la raiz de la SD (/boot/firmware/wifi.txt)
if [ -f /boot/firmware/wifi.txt ]; then
    echo "Found /boot/firmware/wifi.txt! Processing..."
    NEW_SSID=$(head -n 1 /boot/firmware/wifi.txt | tr -d '\\r\\n')
    NEW_PASS=$(sed -n '2p' /boot/firmware/wifi.txt | tr -d '\\r\\n')
    if [ -n "$NEW_SSID" ] && [ -n "$NEW_PASS" ]; then
        echo "Adding network from wifi.txt: $NEW_SSID"
        add_or_update_wifi "$NEW_SSID" "$NEW_SSID" "$NEW_PASS" 110
        nmcli connection up "$NEW_SSID" || true
    fi
fi

# 2. Redes conocidas guardadas
add_or_update_wifi "Juanes" "Juanes" "Misarita1980" 100
add_or_update_wifi "Juanes 5G" "Juanes 5G" "Misarita1980" 95
add_or_update_wifi "A106" "A106" "1234567890" 90
add_or_update_wifi "@PHICOMM_7C" "@PHICOMM_7C" "12345678" 80

echo "Attempting connection..."
nmcli device wifi rescan >/dev/null 2>&1 || true
sleep 2

hostname -I | awk '{print $1}' > /boot/firmware/my_ip.txt || true
echo "Assigned IP: $(cat /boot/firmware/my_ip.txt)"
echo "=== WiFi setup finished at $(date) ==="
"""

cmd = f"echo '{script_body}' | sudo tee /boot/firmware/setup_wifi.sh >/dev/null && sudo chmod +x /boot/firmware/setup_wifi.sh && echo SUCCESS"
stdin, stdout, stderr = ssh.exec_command(cmd)
out = stdout.read().decode('utf-8')
err = stderr.read().decode('utf-8')

print("OUT:", out.strip())
if err:
    print("ERR:", err.strip())

ssh.close()
