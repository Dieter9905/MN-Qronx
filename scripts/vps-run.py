# ─── Chạy lệnh trên VPS qua SSH (paramiko) ────────────────────────────
# Cách dùng:
#   python vps-run.py root  "lệnh"
#   python vps-run.py       "lệnh"     (mặc định user thuevps1)

import os
import sys

import paramiko

HOST = "103.77.209.154"
# Mật khẩu VPS KHÔNG nằm trong code: đặt biến môi trường VPS_PASSWORD trước khi chạy
#   VPS_PASSWORD='...' python scripts/vps-run.py root "uname -a"
PASS = os.environ.get("VPS_PASSWORD", "")
if not PASS:
    sys.exit(" Thiếu biến môi trường VPS_PASSWORD (mật khẩu SSH VPS).")


def main() -> None:
    argv = sys.argv[1:]
    user = "thuevps1"
    if argv and not argv[0].startswith("-"):
        user = argv.pop(0)
    script = argv[0] if argv else "echo 'không có lệnh'"

    transport = paramiko.Transport((HOST, 22))
    transport.connect()
    try:
        transport.auth_password(user, PASS)
    except paramiko.SSHException as exc:
        print(f"AUTH_FAIL user={user}: {exc}")
        sys.exit(2)
    client = paramiko.SSHClient()
    client._transport = transport  # tái dùng kết nối, khỏi mở thêm handshelakhe
    stdin, stdout, stderr = client.exec_command(script, timeout=600)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    code = stdout.channel.recv_exit_status()
    if out:
        print(out.rstrip())
    if err:
        print("[stderr]", err.rstrip(), file=sys.stderr)
    sys.exit(code)


if __name__ == "__main__":
    main()
