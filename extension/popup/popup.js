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

async function apiFetch(path, { method = 'GET', body, token, headers: extraHeaders } = {}) {
  const headers = { 'Content-Type': 'application/json', ...(extraHeaders || {}) }
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

// ─── Đăng nhập Google (OAuth trên web) ─────────────────────────────────
// Tài khoản tạo bằng Google không có mật khẩu nên form email bên trên
// vô dụng với họ. Nút này mở luồng OAuth quen thuộc của web trong tab mới;
// sau khi chọn tài khoản Google, web trả về /oauth-callback?accessToken=…
// và oauth-capture.js (content script) gửi token về background để lưu.
$('google-btn').addEventListener('click', async () => {
  // Đánh dấu đây là luồng do tiện ích mở: oauth-capture.js chỉ đóng tab khi
  // thấy dấu này, nhờ vậy đăng nhập Google trên web không bị mất tab.
  await STORE.set({ mnqOAuthPending: Date.now() })
  chrome.tabs.create({ url: API_BASE + '/auth/google' })
  window.close() // đóng popup, tab Google giữ màn chọn tài khoản
})

$('logout-btn').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'sign-out' }, () => {
    STORE.remove(['mnqTokens']).then(() => showLogin(true))
  })
})

// ─── Lịch học từ trang trường (OneUni-style, không lưu mật khẩu) ───────
// Người dùng đăng nhập sẵn trên cổng trường → mở đúng trang TKB → bấm nút.
// Extension đọc bảng HTML trong tab đó rồi gửi tiết về backend; nhờ vậy
// trường nào có trang TKB dạng bảng cũng dùng được, không cần API riêng.
const schoolBox = $('school-box')
const wsSelect = $('ws-select')
const connectSessionBtn = $('connect-session-btn')
const scrapeBtn = $('scrape-btn')
const autoBtn = $('auto-btn')
const schoolStatus = $('school-status')

let classWorkspaces = []
let lastScrape = null // { origin, workspaceId, schoolName }

async function loadClassWorkspaces(tokens) {
  const res = await apiFetch('/workspaces', { token: tokens.accessToken })
  const list = (res?.data || []).filter((m) => m.workspace?.type === 'STUDENT')
  classWorkspaces = list.map((m) => ({ workspaceId: m.workspace.workspaceId, name: m.workspace.name }))
  schoolBox.classList.remove('hidden')

  if (!classWorkspaces.length) {
    wsSelect.innerHTML = '<option value="">Chưa có Lớp học</option>'
    scrapeBtn.disabled = true
    schoolStatus.textContent = 'Tạo một Lớp học trên web (trang Lịch) trước, rồi quay lại đây.'
    return
  }
  wsSelect.innerHTML = classWorkspaces
    .map((w) => `<option value="${w.workspaceId}">${escapeHtml(w.name)}</option>`)
    .join('')
  const saved = (await STORE.get('mnqTkbWorkspace')).mnqTkbWorkspace
  if (saved && classWorkspaces.some((w) => String(w.workspaceId) === String(saved))) {
    wsSelect.value = String(saved)
  }
  schoolStatus.textContent = 'Mở trang thời khoá biểu của trường rồi bấm “Lấy TKB trang này”.'
}

function setSchoolStatus(text) {
  schoolStatus.textContent = text
}

scrapeBtn.addEventListener('click', async () => {
  const items = await STORE.get('mnqTokens')
  const tokens = items.mnqTokens
  if (!tokens?.accessToken) return
  const workspaceId = wsSelect.value
  if (!workspaceId) return setSchoolStatus('Chọn Lớp nhận TKB trước.')

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.url || !/^https?:/.test(tab.url)) {
    return setSchoolStatus('Hãy mở trang thời khoá biểu của trường trong tab này trước.')
  }

  scrapeBtn.disabled = true
  await scrapeAndImport(tokens, workspaceId, tab)
  scrapeBtn.disabled = false
})

// Chụp bảng TKB ngay trong tab đang mở rồi đưa thẳng lên server. Dùng cho
// “Lấy TKB trang này” và làm đường dự phòng khi “Kết nối trường này” không
// tìm thấy cookie phiên nào (một số cổng giữ phiên kiểu khác, ví dụ token
// nằm trong localStorage — server không tự tải được, nhưng đọc tại chỗ thì OK).
async function scrapeAndImport(tokens, workspaceId, tab) {
  setSchoolStatus('Đang đọc bảng TKB trên trang…')
  let result = null
  try {
    // Chạy scraper trong tab đang mở (quyền activeTab có từ cú bấm này)
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['scraper/timetable.js'] })
    const injected = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => (window.__mnqScrapeTimetable ? window.__mnqScrapeTimetable() : null),
    })
    result = injected?.[0]?.result || null
  } catch (err) {
    setSchoolStatus('Không đọc được trang này: ' + (err?.message || 'lỗi không rõ'))
    return false
  }

  if (!result) {
    setSchoolStatus('Không chạy được bộ đọc TKB trên trang này.')
    return false
  }

  const headers = { 'X-Workspace': String(workspaceId) }

  // Trang không có bảng nhưng có link .ics của trường → nhờ backend kéo
  if (!result.ok && result.icsUrl) {
    setSchoolStatus('Trang có file .ics — đang nhập từ link đó…')
    await apiFetch('/student/school', {
      method: 'POST',
      token: tokens.accessToken,
      headers,
      body: { name: result.schoolName, icsUrl: result.icsUrl },
    })
    const imported = await apiFetch('/student/school/import', {
      method: 'POST',
      token: tokens.accessToken,
      headers,
      body: {},
    })
    if (imported?.success) {
      setSchoolStatus(`Đã nhập ${imported.data?.imported ?? 0} tiết từ .ics của trường.`)
      autoBtn.classList.remove('hidden')
      lastScrape = { origin: new URL(tab.url).origin, workspaceId, schoolName: result.schoolName }
      return true
    }
    setSchoolStatus(imported?.message || 'Không nhập được .ics của trường.')
    return false
  }

  if (!result.ok) {
    setSchoolStatus(result.note || 'Không đọc được bảng TKB trên trang này.')
    return false
  }

  setSchoolStatus(`Đọc được ${result.slots.length} tiết — đang lưu…`)
  const saved = await apiFetch('/student/school/import-slots', {
    method: 'POST',
    token: tokens.accessToken,
    headers,
    body: { schoolName: result.schoolName, sourceUrl: result.url, slots: result.slots },
  })
  if (!saved?.success) {
    setSchoolStatus(saved?.message || 'Không lưu được TKB — thử đăng nhập lại.')
    return false
  }
  await STORE.set({ mnqTkbWorkspace: workspaceId })
  lastScrape = { origin: new URL(tab.url).origin, workspaceId, schoolName: result.schoolName }
  autoBtn.classList.remove('hidden')
  setSchoolStatus(`✅ Đã cập nhật ${saved.data?.imported ?? result.slots.length} tiết vào Lớp đang chọn.`)
  return true
}

// ─── Thu thập TOÀN BỘ cookie phiên của trang trường ──────────────────────
// getAll({url}) cũ chỉ hỏi 1 kiểu — dễ trượt mất phiên:
//   • Cookie HttpOnly của cổng .NET (ASP.NET_SessionId): chỉ chrome.cookies thấy
//   • Cookie Partitioned (CHIPS) của trình duyệt mới: phải hỏi kèm
//     partitionKey.topLevelUrl, không thìgetAll mặc định KHÔNG trả
//   • Cookie SSO đặt trên domain cha (.ntt.edu.vn): phải dò theo domain đó
//   • Cookie nhìn thấy từ JS (phi HttpOnly): đọc qua document.cookie của tab
// Gom tất cả nguồn, cookie gắn đúng host xếp trước, ghép thành header chuẩn.
async function collectSchoolCookies(tab) {
  const u = new URL(tab.url)
  const labels = u.hostname.split('.')
  const domains = [...new Set([
    u.hostname,
    labels.length > 2 ? labels.slice(-3).join('.') : u.hostname,
    labels.length > 2 ? labels.slice(-2).join('.') : u.hostname,
  ])]

  const byKey = new Map()
  const put = (c) => {
    if (!c?.name) return
    const key = `${c.domain ?? ''}|${c.name}|${c.path ?? ''}|${c.storeId ?? ''}`
    // Cookie gắn đúng host đang mở là phiên "nguyên" nhất — ưu tiên đứng đầu
    const weight = String(c.domain ?? '').endsWith(u.hostname) ? 0 : 1
    const prev = byKey.get(key)
    if (!prev || weight < prev.weight) byKey.set(key, { ...c, weight })
  }

  const queries = [{ url: u.origin + '/' }, { url: tab.url }]
  for (const domain of domains) queries.push({ domain })
  // Cookie Partitioned chỉ hiện khi hỏi đúng topLevelUrl — trình duyệt cũ
  // không nhận trường này sẽ ném lỗi → bắt và bỏ qua lần dò đó
  queries.push({ url: u.origin + '/', partitionKey: { topLevelUrl: u.origin } })
  queries.push({ url: tab.url, partitionKey: { topLevelUrl: u.origin } })

  for (const q of queries) {
    try {
      for (const c of await chrome.cookies.getAll(q)) put(c)
    } catch {
      /* kiểu dò này không dùng được trên trình duyệt này — bỏ qua */
    }
  }

  // Cookie nhìn thấy được từ JS trong tab (phi HttpOnly) — activeTab còn hiệu
  // lực từ chính cú bấm nút của người dùng, nên executeScript không xin thêm
  try {
    const inj = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => document.cookie,
    })
    for (const pair of String(inj?.[0]?.result || '').split(';')) {
      const m = pair.trim().match(/^([^=]+)=(.*)$/)
      if (m) put({ name: m[1], value: m[2], domain: u.hostname, path: '/', weight: 2 })
    }
  } catch {
    /* không cắm được script vào tab — bỏ qua */
  }

  return [...byKey.values()]
    .sort((a, b) => a.weight - b.weight)
    .map((c) => `${c.name}=${c.value}`)
    .join('; ')
}

// ─── Kết nối trường bằng PHIÊN đăng nhập (đường dự phòng cho mọi trường) ──
// Người dùng đã đăng nhập trên cổng trường; extension gửi URL trang TKB +
// cookie của đúng tên miền đó về server. Server tự tải lại hằng ngày, nên
// trường không cần connector riêng và app KHÔNG lưu mật khẩu trường.
connectSessionBtn.addEventListener('click', async () => {
  const items = await STORE.get('mnqTokens')
  const tokens = items.mnqTokens
  if (!tokens?.accessToken) return
  const workspaceId = wsSelect.value
  if (!workspaceId) return setSchoolStatus('Chọn Lớp nhận TKB trước.')

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.url || !/^https:/.test(tab.url)) {
    return setSchoolStatus('Hãy mở trang thời khoá biểu của trường (https) trong tab này trước.')
  }
  const origin = new URL(tab.url).origin

  connectSessionBtn.disabled = true
  setSchoolStatus('Đang xin quyền đọc phiên đăng nhập của trường…')
  let granted = false
  try {
    granted = await chrome.permissions.request({ origins: [`${origin}/*`] })
  } catch {
    granted = false
  }
  if (!granted) {
    connectSessionBtn.disabled = false
    return setSchoolStatus('Bạn chưa cho phép đọc tên miền trường nên chưa kết nối được.')
  }

  setSchoolStatus('Đang gom cookie phiên của trường…')
  const cookie = await collectSchoolCookies(tab)
  if (!cookie) {
    connectSessionBtn.disabled = false
    // Cổng trường giữ phiên mà không thấy cookie nào (một số cổng để token
    // trong localStorage thay vì cookie) → server không thể tự tải TKB hàng
    // ngày, NHƯNG vẫn chụp được TKB ngay trong tab. Tự chuyển sang đường đó
    // thay vì báo lỗi để người dùng chôn chân ở màn hình nửa vời.
    setSchoolStatus('Không thấy cookie phiên (trang giữ phiên theo kiểu khác) — thử chụp TKB ngay trong tab…')
    await scrapeAndImport(tokens, workspaceId, tab)
    return
  }

  setSchoolStatus('Đang đọc TKB trên server…')
  const schoolName = String(tab.title || new URL(tab.url).hostname).split(/[|–-]/)[0].trim().slice(0, 100)
  const res = await apiFetch('/student/connect', {
    method: 'POST',
    token: tokens.accessToken,
    headers: { 'X-Workspace': String(workspaceId) },
    body: {
      schoolCode: 'CUSTOM',
      username: schoolName || origin,
      timetableUrl: tab.url,
      cookie,
    },
  })
  connectSessionBtn.disabled = false

  if (res?.success) {
    await STORE.set({ mnqTkbWorkspace: workspaceId })
    autoBtn.classList.add('hidden')
    setSchoolStatus(`✅ Đã kết nối ${schoolName || origin} · ${res.data?.imported ?? 0} tiết. Server sẽ tự đồng bộ mỗi sáng.`)
  } else {
    setSchoolStatus(res?.message || 'Không kết nối được trang này — thử “Chỉ lấy lần này”.')
  }
})

// Tự cập nhật: xin quyền đúng tên miền trường đang mở, rồi cắm content
// script vào trang TKB. Mỗi lần người dùng ghé cổng trường (đã đăng nhập),
// tiết học tự đồng bộ — không cần bấm lại, không lưu mật khẩu.
autoBtn.addEventListener('click', async () => {
  if (!lastScrape) return
  const { origin, workspaceId } = lastScrape
  let granted = false
  try {
    granted = await chrome.permissions.request({ origins: [`${origin}/*`] })
  } catch {
    granted = false
  }
  if (!granted) return setSchoolStatus('Bạn chưa cho phép đọc tên miền trường nên chưa bật được tự cập nhật.')

  const id = 'mnq-tkb-' + origin.replace(/[^a-z0-9]/gi, '').slice(0, 40)
  try {
    const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [id] })
    if (existing?.length) await chrome.scripting.unregisterContentScripts({ ids: [id] })
    await chrome.scripting.registerContentScripts([
      {
        id,
        matches: [`${origin}/*`],
        js: ['scraper/timetable.js', 'scraper/auto-sync.js'],
        runAt: 'document_idle',
        persistAcrossSessions: true,
      },
    ])
  } catch (err) {
    return setSchoolStatus('Không bật được tự cập nhật: ' + (err?.message || 'lỗi không rõ'))
  }
  await STORE.set({ mnqTkbAuto: { origin, workspaceId, schoolName: lastScrape.schoolName } })
  setSchoolStatus('✅ Đã bật tự cập nhật: mỗi lần bạn mở trang TKB của trường, tiết học tự đồng bộ.')
})

// ─── Màn danh sách ────────────────────────────────────────────────────

async function showTasks(tokens) {
  const name = tokens.user?.fullName || tokens.user?.email || ''
  const first = String(name).split(' ')[0]
  $('greeting').textContent = first ? `Chào ${first} 👋` : 'Công việc hôm nay'
  showLogin(false)
  watchFocus()
  await loadTasks(tokens)
  loadClassWorkspaces(tokens).catch(() => {})
}

// ─── Khởi động ────────────────────────────────────────────────────────

STORE.get('mnqTokens').then((items) => {
  const tokens = items.mnqTokens
  if (tokens?.accessToken) showTasks(tokens)
  else showLogin(true)
})
