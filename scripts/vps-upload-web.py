# ─── Đẩy dist web lên VPS: upload tar → giải nén vào /var/www/qronx ───
# Cách dùng: python vps-upload-web.py
import os
import sys

import paramiko

HOST = "103.77.209.154"
# Mật khẩu VPS KHÔNG nằm trong code: đặt biến môi trường VPS_PASSWORD trước khi chạy
#   VPS_PASSWORD='...' python scripts/vps-upload-web.py
PASS = os.environ.get("VPS_PASSWORD", "")
if not PASS:
    sys.exit(" Thiếu biến môi trường VPS_PASSWORD (mật khẩu SSH VPS).")
LOCAL_TAR = "dist-web.tar.gz"
REMOTE_TAR = "/tmp/dist-web.tar.gz"
WEB_ROOT = "/var/www/qronx"


def main() -> None:
    transport = paramiko.Transport((HOST, 22))
    transport.connect(username="root", password=PASS)

    sftp = paramiko.SFTPClient.from_transport(transport)
    sftp.put(LOCAL_TAR, REMOTE_TAR)
    sftp.close()

    client = paramiko.SSHClient()
    client._transport = transport

    def run(cmd: str) -> tuple[int, str, str]:
        stdin, stdout, stderr = client.exec_command(cmd, timeout=600)
        out = stdout.read().decode("utf-8", "replace")
        err = stderr.read().decode("utf-8", "replace")
        code = stdout.channel.recv_exit_status()
        return code, out, err

    steps = [
        f"tar xzf {REMOTE_TAR} -C {WEB_ROOT}/",           # ghi đè file trùng tên
        f"chown -R www-data:www-data {WEB_ROOT}/assets {WEB_ROOT}/index.html {WEB_ROOT}/favicon.svg {WEB_ROOT}/icons {WEB_ROOT}/manifest.json {WEB_ROOT}/sw.js {WEB_ROOT}/privacy.html 2>/dev/null; true",
        "rm /tmp/dist-web.tar.gz",
    ]
    for cmd in steps:
        code, out, err = run(cmd)
        print(f"$ {cmd}\n  exit={code}")
        if out.strip():
            print(out.rstrip())
        if err.strip():
            print("[stderr]", err.rstrip())

    # xác minh nhanh qua chính máy VPS
    code, out, err = run(
        "curl -s http://127.0.0.1/ -H 'Host: mn-qronx.id.vn' | head -5; "
        "echo ---; curl -s -o /dev/null -w '%{http_code} %{size_download}B icon512' -k https://127.0.0.1/icons/icon-512.png -H 'Host: mn-qronx.id.vn'; echo; "
        "curl -sk https://127.0.0.1/favicon.svg -H 'Host: mn-qronx.id.vn' | head -c 80; echo"
    )
    print("--- xác minh ---")
    print(out.rstrip())
    if err.strip():
        print("[stderr]", err.rstrip())

    client.close()
    transport.close()


if __name__ == "__main__":
    main()
