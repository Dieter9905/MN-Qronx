// ─── Tự cập nhật TKB khi người dùng mở trang trường ────────────────────────
// Chỉ chạy trên tên miền người dùng đã bấm "Bật tự cập nhật" (quyền do
// chrome.permissions xin, không xin quyền mọi trang). Mỗi ngày đồng bộ một
// lần: mở cổng trường (đã đăng nhập) là tiết học tự về Lớp đã chọn.
;(() => {
  if (window.__mnqAutoSyncRan) return
  window.__mnqAutoSyncRan = true

  const API_BASE = 'https://mn-qronx.id.vn/api/v1'

  function todayKey() {
    // Ngày theo giờ VN để "mỗi ngày một lần" đúng với người dùng trong nước
    const vn = new Date(Date.now() + 7 * 3_600_000)
    return vn.toISOString().slice(0, 10)
  }

  async function run() {
    const store = await chrome.storage.local.get(['mnqTkbAuto', 'mnqTokens', 'mnqTkbLastSync'])
    const auto = store.mnqTkbAuto
    const tokens = store.mnqTokens
    if (!auto?.origin || location.origin !== auto.origin) return
    if (!tokens?.accessToken) return

    const last = store.mnqTkbLastSync || {}
    if (last[auto.workspaceId] === todayKey()) return

    // Trang có thể render bảng bằng JS sau document_idle → đợi thêm nhịp ngắn
    await new Promise((r) => setTimeout(r, 2000))
    if (typeof window.__mnqScrapeTimetable !== 'function') return

    let result = null
    try {
      result = window.__mnqScrapeTimetable()
    } catch {
      return
    }
    if (!result?.ok || !result.slots?.length) return

    try {
      const res = await fetch(API_BASE + '/student/school/import-slots', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokens.accessToken}`,
          'X-Workspace': String(auto.workspaceId),
        },
        body: JSON.stringify({
          schoolName: result.schoolName || auto.schoolName,
          sourceUrl: result.url,
          slots: result.slots,
        }),
      })
      const payload = await res.json().catch(() => null)
      if (!res.ok || !payload?.success) return

      // Ghi mốc theo ngày để lần mở tab sau trong cùng ngày không gọi lại API
      await chrome.storage.local.set({
        mnqTkbLastSync: { ...last, [auto.workspaceId]: todayKey() },
      })
      // Báo cho popup/background nếu đang mở, để hiện trạng thái mới
      chrome.runtime.sendMessage({ type: 'tkb-synced', count: payload.data?.imported ?? 0 })
    } catch {
      // Mất mạng thì thôi — lần mở trang sau sẽ thử lại
    }
  }

  run()
})()
