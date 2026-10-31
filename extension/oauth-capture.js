// ─── MN-Qronx Extension – Bắt token sau đăng nhập Google ──────────────
// Content script chạy trên /oauth-callback của web (đích cuối của luồng
// OAuth trên web). Đọc accessToken/refreshToken từ query và gửi về nền
// extension (background.js) để lưu — nhờ vậy tài khoản tạo bằng Google
// cũng đăng nhập được vào extension.
// Chạy "document_start" để đọc query trước khi React SPA thay URL.
//
// LƯU Ý: script này cũng chạy khi người dùng đăng nhập Google *trên web*
// (không liên quan tiện ích). Nếu cứ gửi token về nền thì background sẽ
// đóng luôn tab đó — đúng lỗi "bấm đăng nhập Google là tab biến mất".
// Vì vậy popup đặt dấu mnqOAuthPending trước khi mở tab OAuth; chỉ khi có
// dấu đó (và còn mới) mới được đóng tab / hiện thông báo.

const PENDING_KEY = 'mnqOAuthPending'
const PENDING_TTL_MS = 5 * 60 * 1000

const params = new URLSearchParams(location.search)
const accessToken = params.get('accessToken')
const refreshToken = params.get('refreshToken')

if (accessToken && refreshToken) {
  chrome.storage.local.get(PENDING_KEY, (items) => {
    const startedAt = Number(items?.[PENDING_KEY]) || 0
    const fromExtension = startedAt > 0 && Date.now() - startedAt < PENDING_TTL_MS
    if (fromExtension) chrome.storage.local.remove(PENDING_KEY)

    chrome.runtime.sendMessage(
      { type: 'oauth-tokens', accessToken, refreshToken, fromExtension },
      (reply) => {
        // Đăng nhập trên web: chỉ đồng bộ token cho tiện ích, không đụng vào tab
        if (!fromExtension) return
        if (chrome.runtime.lastError) {
          showBanner(false, 'Không bắt được token — hãy mở tiện ích MN-Qronx và thử lại')
          return
        }
        if (reply?.ok) {
          showBanner(true, 'Đăng nhập Google thành công — token đã về MN-Qronx')
          window.close() // tab do tiện ích mở nên được phép tự đóng
        } else {
          showBanner(false, 'Không lưu được phiên đăng nhập — thử lại trong tiện ích')
        }
      },
    )
  })
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
