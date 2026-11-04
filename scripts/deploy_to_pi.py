import os
import sys
import paramiko

host = os.environ.get('RPI_HOST', sys.argv[1] if len(sys.argv) > 1 else '192.168.1.12')
username = 'juanes08'
password = 'juanes123'

print(f"Connecting to {host}...")
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(host, username=username, password=password, timeout=10)

sftp = ssh.open_sftp()
local_script = '/app/scripts/stream_hailo.py'
remote_script = '/home/juanes08/stream_hailo.py'

print(f"Uploading {local_script} to {remote_script}...")
sftp.put(local_script, remote_script)
sftp.chmod(remote_script, 0o755)
sftp.close()

service_content = """[Unit]
Description=Hailo-8 AI Camera Streamer (SAFE-CROSSING)
After=network.target

[Service]
Type=simple
User=juanes08
WorkingDirectory=/home/juanes08
ExecStart=/usr/bin/python3 /home/juanes08/stream_hailo.py
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
"""

cmds = [
    "chmod +x /home/juanes08/stream_hailo.py",
    # Remove masked file and install real service
    f"echo '{service_content}' | sudo tee /etc/systemd/system/hailo-stream.service",
    "sudo systemctl daemon-reload",
    "sudo systemctl unmask hailo-stream.service || true",
    "sudo systemctl enable hailo-stream.service",
    "sudo systemctl restart hailo-stream.service",
    "sleep 2",
    "sudo systemctl status hailo-stream.service --no-pager"
]

full_cmd = " && ".join(cmds)
print(f"Executing setup commands...")
stdin, stdout, stderr = ssh.exec_command(full_cmd)
out = stdout.read().decode('utf-8')
err = stderr.read().decode('utf-8')

print("--- OUTPUT ---")
print(out)
if err:
    print("--- STDERR ---")
    print(err)

ssh.close()
print("Deployment completed!")
