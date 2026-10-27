// ─── MN-Qronx Extension – Bắt token sau đăng nhập Google ──────────────
// Content script chạy trên /oauth-callback của web (đích cuối của luồng
// OAuth trên web). Đọc accessToken/refreshToken từ query và gửi về nền
// extension (background.js) để lưu — nhờ vậy tài khoản tạo bằng Google
// cũng đăng nhập được vào extension.
// Chạy "document_start" để đọc query trước khi React SPA thay URL.

const params = new URLSearchParams(location.search)
const accessToken = params.get('accessToken')
const refreshToken = params.get('refreshToken')

if (accessToken && refreshToken) {
  chrome.runtime.sendMessage(
    { type: 'oauth-tokens', accessToken, refreshToken },
    (reply) => {
      if (chrome.runtime.lastError) {
        showBanner(false, 'Không bắt được token — hãy mở tiện ích MN-Qronx và thử lại')
        return
      }
      if (reply?.ok) {
        showBanner(true, 'Đăng nhập Google thành công — token đã về MN-Qronx')
        window.close() // tab được extension mở nên được phép tự đóng
      } else {
        showBanner(false, 'Không lưu được phiên đăng nhập — thử lại trong tiện ích')
      }
    },
  )
}

function showBanner(ok, text) {
  const el = document.createElement('div')
  el.textContent = text
  el.style.cssText =
    'position:fixed;inset:auto 12px 12px 12px;z-index:2147483647;padding:12px 16px;' +
    'border-radius:10px;font:13px/1.4 -apple-system,system-ui,sans-serif;color:#fff;' +
    'background:' + (ok ? '#137a67' : '#8c2f39') + ';box-shadow:0 6px 18px rgba(0,0,0,.35)'
  document.documentElement.appendChild(el)
}
