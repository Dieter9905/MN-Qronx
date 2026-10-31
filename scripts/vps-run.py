# ─── Chạy lệnh trên VPS qua SSH (paramiko) ────────────────────────────
# Cách dùng:
#   python vps-run.py root  "lệnh"
#   python vps-run.py       "lệnh"     (mặc định user thuevps1)
#
# Xác thực: ưu tiên SSH key (~/.ssh/id_ed25519, đổi bằng VPS_KEY=<đường dẫn>),
# dự phòng mật khẩu qua biến môi trường VPS_PASSWORD. Máy dev đã cài key nên
# deploy không cần nhập/giữ mật khẩu; mật khẩu chỉ dùng khi đổi máy.

import os
import sys

import paramiko

HOST = "103.77.209.154"
KEY_PATH = os.environ.get("VPS_KEY") or os.path.expanduser("~/.ssh/id_ed25519")
# Mật khẩu VPS KHÔNG nằm trong code
PASS = os.environ.get("VPS_PASSWORD", "")


def connect(user: str) -> paramiko.Transport:
    """Mở transport và xác thực: key trước, mật khẩu sau."""
    transport = paramiko.Transport((HOST, 22))
    transport.connect()
    if os.path.exists(KEY_PATH):
        try:
            pkey = paramiko.Ed25519Key.from_private_key_file(KEY_PATH)
            transport.auth_publickey(user, pkey)
            return transport
        except (paramiko.SSHException, ValueError):
            pass  # key bị từ chối hoặc không đọc được → thử mật khẩu
    if not PASS:
        transport.close()
        sys.exit(
            f" Không đăng nhập được bằng key {KEY_PATH} và thiếu VPS_PASSWORD.\n"
            " Cài key một lần: ssh-copy-id -i ~/.ssh/id_ed25519.pub root@" + HOST
        )
    try:
        transport.auth_password(user, PASS)
    except paramiko.SSHException as exc:
        transport.close()
        print(f"AUTH_FAIL user={user}: {exc}")
        sys.exit(2)
    return transport


def main() -> None:
    argv = sys.argv[1:]
    user = "thuevps1"
    if argv and not argv[0].startswith("-"):
        user = argv.pop(0)
    script = argv[0] if argv else "echo 'không có lệnh'"

    transport = connect(user)
    client = paramiko.SSHClient()
    client._transport = transport  # tái dùng kết nối, khỏi mở thêm handshake
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
