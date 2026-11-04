import sys
import os
import paramiko

host = os.environ.get('RPI_HOST', sys.argv[2] if len(sys.argv) > 2 else '192.168.1.12')
cmd = sys.argv[1] if len(sys.argv) > 1 else 'echo hello'
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(host, username='juanes08', password='juanes123', timeout=7)
stdin, stdout, stderr = ssh.exec_command(cmd)
out = stdout.read().decode('utf-8')
err = stderr.read().decode('utf-8')
print("--- STDOUT ---")
print(out)
if err:
    print("--- STDERR ---")
    print(err)
ssh.close()
