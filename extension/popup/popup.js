// ─── MN-Qronx Extension – Popup ───────────────────────────────────────
// Đăng nhập email/mật khẩu (dùng API /auth/login của web), sau đó hiển thị
// danh sách việc còn hạn hôm nay + việc quá hạn mới. Chuông nền do
// background.js lo — popup chỉ đọc/ghi chrome.storage và gọi API khi mở.

const API_BASE = 'https://mn-qronx.id.vn/api/v1'
const WEB_URL = 'https://mn-qronx.id.vn'
const STORE = chrome.storage.local

const $ = (id) => document.getElementById(id)
const loginView = $('login-view')
const tasksView = $('tasks-view')

// ─── API helper (bản nhỏ của src/services/apiClient.js) ───────────────

async function apiFetch(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  let res
  try {
    res = await fetch(API_BASE + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    return { success: false, message: 'Không kết nối được máy chủ' }
  }
  let payload = null
  try {
    payload = await res.json()
  } catch {
    payload = null
  }
  if (res.ok) return payload || { success: true, data: null }
  return {
    success: false,
    message: payload?.message || `Lỗi máy chủ (${res.status})`,
    status: res.status,
  }
}

// ─── Điền dữ liệu ─────────────────────────────────────────────────────

function showLogin(show) {
  loginView.classList.toggle('hidden', !show)
  tasksView.classList.toggle('hidden', show)
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]))
}

function isSameVNDay(a, b) {
  return a.toLocaleDateString('vi-VN') === b.toLocaleDateString('vi-VN')
}

function renderTasks(items) {
  const list = $('task-list')
  if (!items.length) {
    list.innerHTML = '<div class="empty">🎉 Hôm nay không có việc đến hạn nào</div>'
    return
  }
  const now = new Date()
  list.innerHTML = items
    .map((t) => {
      const due = t.dueAt ? new Date(t.dueAt) : null
      const overdue = due && due < now
      const meta = due
        ? escapeHtml(due.toLocaleString('vi-VN', {
            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
          })) + (overdue ? ' — quá hạn' : '')
        : 'Không có hạn'
      return `
      <div class="task">
        <span class="pill ${escapeHtml(t.priority || '')}"></span>
        <div class="body">
          <div class="title">${escapeHtml(t.title)}</div>
          <div class="meta ${overdue ? 'overdue' : ''}">${meta}</div>
        </div>
      </div>`
    })
    .join('')
}

async function loadTasks(tokens) {
  $('task-list').innerHTML = '<div class="loading">Đang tải…</div>'
  // Lấy việc còn thực thi (kể cả quá hạn mới đủ 1 ngày — cùng bộ lọc bản web)
  const res = await apiFetch('/tasks?pageSize=100&sort=dueAsc&status=TODO', {
    token: tokens.accessToken,
  })
  const items = res?.data?.items || []
  const now = new Date()
  const today = items
    .filter((t) => !t.dueAt || isSameVNDay(new Date(t.dueAt), now) || new Date(t.dueAt) < now)
    .slice(0, 30)

  renderTasks(today)

  // Dòng đếm nhắc đến giờ (cùng dữ liệu background dùng để bấm chuông)
  const alarm = await apiFetch('/reminders/due', { token: tokens.accessToken })
  const due = Array.isArray(alarm?.data) ? alarm.data : alarm?.data?.data || []
  const active = due.filter((r) => r.status === 'SCHEDULED') || []
  $('due-line').textContent = active.length
    ? `⏰ Có ${active.length} nhắc đến giờ — chuông nền đang chạy`
    : 'Không có nhắc nào đến giờ'
}

// ─── Bấm giờ tập trung (Pomodoro) ─────────────────────────────────────
// State lưu background (chrome.storage) nên phiên sống cả khi đóng popup.
// Popup chỉ vẽ lại từ state; hết giờ do alarm nền lo + notification.

const focusClock = $('focus-clock')
const focusRunningEl = $('focus-running')
const focusIdleEl = $('focus-idle')
const focusStateEl = $('focus-state')
const focusPauseBtn = $('focus-pause-btn')

function fmtClock(ms) {
  const total = Math.max(0, Math.round(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  // ≥ 1 giờ hiện 1:05:30 cho gọn; ngắn hơn giữ mm:ss quen thuộc
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

let focusTicker = null

function renderFocus(state) {
  if (!state) {
    clearInterval(focusTicker)
    focusTicker = null
    focusRunningEl.classList.add('hidden')
    focusIdleEl.classList.remove('hidden')
    return
  }
  const running = state.status === 'running'
  focusRunningEl.classList.remove('hidden')
  focusIdleEl.classList.add('hidden')

  const tick = () => {
    const remaining =
      state.status === 'running'
        ? state.endAt - Date.now()
        : state.remainingMs
    focusClock.textContent = fmtClock(remaining)
  }
  focusStateEl.textContent = running ? 'Đang tập trung 🍅' : 'Tạm dừng ⏸'
  focusPauseBtn.textContent = running ? 'Tạm dừng' : 'Tiếp tục'
  focusPauseBtn.classList.toggle('primary', !running)

  clearInterval(focusTicker)
  tick()
  if (running) focusTicker = setInterval(tick, 1000)
}

async function watchFocus() {
  const items = await STORE.get('mnqFocus')
  renderFocus(items.mnqFocus || null)
}

// Bước nhảy 1 giây chỉ khi đang chạy; phiên hoàn tất ở nền alarm xử lý
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.mnqFocus) watchFocus()
})

document.querySelectorAll('.focus-preset').forEach((btn) => {
  btn.addEventListener('click', () => {
    const minutes = Number(btn.dataset.mins)
    // Nhớ lại độ dài vừa chọn để popup mở sau tự điền + nút "Tập trung
    // tiếp" trong notification nền dùng đúng con số này
    STORE.set({ mnqFocusLast: minutes })
    chrome.runtime.sendMessage(
      { type: 'focus-start', minutes },
      () => watchFocus(),
    )
  })
})

// ─── Chọn độ dài phiên tùy thích (giờ/phút, tối đa 8 giờ) ─────────────
// Khớp bản web: trần 8 giờ (background.js cũng chốt MAX_FOCUS_MINUTES=480),
// sàn 1 phút. Lựa chọn lưu mnqFocusLast nên background notification
// "Tập trung tiếp" và prefill popup mở sau đều dùng cùng con số.
const MAX_CUSTOM_MINUTES = 480
const hoursInput = $('focus-hours')
const minsInput = $('focus-mins')

// Prefill độ dài lần trước (mnqFocusLast do popup/background ghi khi bấm/hết phiên)
STORE.get('mnqFocusLast').then((items) => {
  const mins = Math.round(Number(items.mnqFocusLast) || 0)
  if (mins >= 1 && mins <= MAX_CUSTOM_MINUTES) {
    hoursInput.value = Math.floor(mins / 60)
    minsInput.value = mins % 60
  }
})

function startCustomFocus() {
  const minutes = Math.min(
    MAX_CUSTOM_MINUTES,
    Math.max(1, (Number(hoursInput.value) || 0) * 60 + (Number(minsInput.value) || 0)),
  )
  STORE.set({ mnqFocusLast: minutes })
  chrome.runtime.sendMessage({ type: 'focus-start', minutes }, () => watchFocus())
}

$('focus-custom-btn').addEventListener('click', startCustomFocus)
// Gõ số xong nhấn Enter cũng chạy luôn cho tiện
;[hoursInput, minsInput].forEach((el) => {
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') startCustomFocus()
  })
})

$('focus-stop-btn').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'focus-stop' }, () => watchFocus())
})

focusPauseBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage(
    { type: focusStateEl.textContent.includes('Tạm dừng') ? 'focus-resume' : 'focus-pause' },
    () => watchFocus(),
  )
})

// ─── Đăng nhập ────────────────────────────────────────────────────────

function fmtLoginError(res) {
  if (res?.message && res.message !== 'Lỗi máy chủ (undefined)') return res.message
  if (res?.errors) {
    const first = Object.values(res.errors)[0]
    if (first) return String(Array.isArray(first) ? first[0] : first)
  }
  return 'Đăng nhập không thành công'
}

$('login-form').addEventListener('submit', async (e) => {
  e.preventDefault()
  const btn = $('login-btn')
  const errEl = $('login-error')
  btn.disabled = true
  errEl.classList.add('hidden')

  const dataRes = await apiFetch('/auth/login', {
    method: 'POST',
    body: {
      email: $('email').value.trim(),
      password: $('password').value,
    },
  })

  btn.disabled = false
  if (!dataRes.success || !dataRes.data?.accessToken) {
    errEl.textContent = fmtLoginError(dataRes)
    errEl.classList.remove('hidden')
    return
  }

  const tokens = {
    accessToken: dataRes.data.accessToken,
    refreshToken: dataRes.data.refreshToken,
    user: dataRes.data.user || null,
  }
  await STORE.set({
    mnqTokens: tokens,
    mnqDeviceId:
  'ext-' +
  Date.now().toString(36) +
  '-' +
  Math.random().toString(36).slice(2, 10),
  })
  chrome.runtime.sendMessage({ type: 'signed-in' }, () => {})
  await showTasks(tokens)
})

$('logout-btn').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'sign-out' }, () => {
    STORE.remove(['mnqTokens']).then(() => showLogin(true))
  })
})

// ─── Màn danh sách ────────────────────────────────────────────────────

async function showTasks(tokens) {
  const name = tokens.user?.fullName || tokens.user?.email || ''
  const first = String(name).split(' ')[0]
  $('greeting').textContent = first ? `Chào ${first} 👋` : 'Công việc hôm nay'
  showLogin(false)
  watchFocus()
  await loadTasks(tokens)
}

// ─── Khởi động ────────────────────────────────────────────────────────

STORE.get('mnqTokens').then((items) => {
  const tokens = items.mnqTokens
  if (tokens?.accessToken) showTasks(tokens)
  else showLogin(true)
})
