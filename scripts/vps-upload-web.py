# ─── Đẩy dist web lên VPS: upload tar → giải nén vào /var/www/qronx ───
# Cách dùng: python vps-upload-web.py
#
# Xác thực: ưu tiên SSH key (~/.ssh/id_ed25519, đổi bằng VPS_KEY),
# dự phòng mật khẩu qua biến môi trường VPS_PASSWORD.
import os
import sys

import paramiko

HOST = "103.77.209.154"
KEY_PATH = os.environ.get("VPS_KEY") or os.path.expanduser("~/.ssh/id_ed25519")
PASS = os.environ.get("VPS_PASSWORD", "")
LOCAL_TAR = "dist-web.tar.gz"
REMOTE_TAR = "/tmp/dist-web.tar.gz"
WEB_ROOT = "/var/www/qronx"

# Thư mục trong dist/ KHÔNG thuộc web: desktop/ là gói .zip 86 MB cho khách,
# extension/ là gói tiện ích. Đẩy nhầm lên web root là vừa phình bản deploy
# vừa lộ file tải trực tiếp ngoài ý muốn.
TAR_EXCLUDES = ["--exclude=./desktop", "--exclude=./extension"]


def connect() -> paramiko.Transport:
    """Mở transport tới VPS: xác thực bằng key, dự phòng mật khẩu."""
    transport = paramiko.Transport((HOST, 22))
    transport.connect()
    if os.path.exists(KEY_PATH):
        try:
            pkey = paramiko.Ed25519Key.from_private_key_file(KEY_PATH)
            transport.auth_publickey("root", pkey)
            return transport
        except (paramiko.SSHException, ValueError):
            pass
    if not PASS:
        transport.close()
        sys.exit(
            f" Không đăng nhập được bằng key {KEY_PATH} và thiếu VPS_PASSWORD.\n"
            " Cài key một lần: ssh-copy-id -i ~/.ssh/id_ed25519.pub root@" + HOST
        )
    transport.auth_password("root", PASS)
    return transport


def refresh_tar() -> None:
    """dist/ mới hơn tar thì đóng gói lại — tránh đẩy nhầm bản tar cũ."""
    from pathlib import Path

    tar = Path(LOCAL_TAR)
    dist = Path("dist")
    dist_marker = dist / "index.html"
    if not dist_marker.exists():
        return  # không có dist, dùng tar sẵn có
    if tar.exists() and tar.stat().st_mtime >= dist_marker.stat().st_mtime:
        return  # tar đã đóng gói sau lần build gần nhất
    print("→ dist mới hơn tar, đóng gói lại...", flush=True)
    import subprocess

    subprocess.run(
        ["tar", "czf", LOCAL_TAR, *TAR_EXCLUDES, "-C", str(dist), "."], check=True
    )


def main() -> None:
    refresh_tar()
    transport = connect()

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
        f"chown -R www-data:www-data {WEB_ROOT}/assets {WEB_ROOT}/index.html {WEB_ROOT}/favicon.svg {WEB_ROOT}/icons {WEB_ROOT}/manifest.json {WEB_ROOT}/sw.js {WEB_ROOT}/privacy.html {WEB_ROOT}/privacy-extension.html 2>/dev/null; true",
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
