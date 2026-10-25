// ─── MN-Qronx Extension – Service Worker ──────────────────────────────
// Chạy nền, hai việc chính:
//   1. Mỗi 1 phút hỏi server "nhắc nào đến giờ rồi?", bắn thông báo
//      chuông của trình duyệt và cập nhật badge trên toolbar.
//   2. Giữ đồng hồ bấm giờ tập trung (Pomodoro): phiên sống bằng
//      chrome.alarms nên đếm ngược vẫn chạy cả khi popup đã đóng.
// Token chỉ nằm trong chrome.storage, không giữ sẵn trong biến toàn cục.

const API_BASE = 'https://mn-qronx.id.vn/api/v1'
const WEB_URL = 'https://mn-qronx.id.vn'
// Tương tự bản web: bỏ qua nhắc của việc đã quá hạn quá lâu
// (việc cũ quá rồi thì gạt đi, không bấm chuông thêm).
const MAX_OVERDUE_DAYS = 1
const POLL_ALARM = 'qronx-poll'
const FOCUS_ALARM = 'qronx-focus-end'
const STORE = chrome.storage.local
const FOCUS_KEY = 'mnqFocus'
const MAX_FOCUS_MINUTES = 180

// State bấm giờ (cũng lưu vào chrome.storage để popup đọc lại):
// { status: 'running'|'paused', endAt (ms, khi chạy), remainingMs (khi dừng), minutes }
let focusState = null

// ─── Token & thiết bị ─────────────────────────────────────────────────

async function getTokens() {
  const items = await STORE.get('mnqTokens')
  return items.mnqTokens || null
}

async function setTokens(tokens) {
  if (tokens) {
    await STORE.set({ mnqTokens: tokens })
  } else {
    await STORE.remove(['mnqTokens', 'mnqNotified', FOCUS_KEY])
    focusState = null
  }
}

async function getDeviceId() {
  let { mnqDeviceId } = await STORE.get('mnqDeviceId')
  if (!mnqDeviceId) {
    mnqDeviceId =
      'ext-' +
      Date.now().toString(36) +
      '-' +
      Math.random().toString(36).slice(2, 10)
    await STORE.set({ mnqDeviceId })
  }
  return mnqDeviceId
}

// ─── Gọi API (kèm refresh token tự động 1 lần) ────────────────────────

async function api(path, { method = 'GET', body } = {}) {
  const tokens = await getTokens()
  const send = (accessToken) => {
    const headers = { 'Content-Type': 'application/json' }
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`
    return fetch(API_BASE + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  }

  let tokensLeft = tokens
  let res
  try {
    res = await send(tokens?.accessToken)
  } catch {
    return { ok: false, network: true }
  }

  // Access token hết hạn → refresh 1 lần rồi thử lại
  if (res.status === 401 && tokens?.refreshToken && !path.startsWith('/auth/')) {
    let refreshed = null
    try {
      const r = await fetch(API_BASE + '/auth/refresh-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: tokens.refreshToken }),
      })
      const payload = await r.json()
      if (r.ok && payload.success && payload.data?.accessToken) {
        refreshed = { ...tokens, accessToken: payload.data.accessToken }
      }
    } catch {
      refreshed = null
    }
    if (refreshed) {
      await setTokens(refreshed)
      tokensLeft = refreshed
      try {
        res = await send(refreshed.accessToken)
      } catch {
        return { ok: false, network: true }
      }
    }
  }

  // Refresh cũng fail → đăng xuất im lặng cho extension
  if (res.status === 401) {
    await signOut(false)
    return { ok: false, signedOut: true }
  }

  let data = null
  try {
    data = await res.json()
  } catch {
    data = null
  }
  return { ok: res.ok, status: res.status, data, tokens: tokensLeft }
}

// ─── Bộ nhớ "đã chuông" (chống lặp thông báo) ─────────────────────────

async function getNotified() {
  const items = await STORE.get('mnqNotified')
  return items.mnqNotified || {}
}

async function markNotified(reminderId, remindAt) {
  const notified = await getNotified()
  notified[reminderId] = {
    remindAt: String(remindAt),
    at: Date.now(),
  }
  // Dọn remind quá cũ (7 ngày) để map không phình ra
  for (const id of Object.keys(notified)) {
    if (Date.now() - notified[id].at > 7 * 24 * 60 * 60 * 1000) delete notified[id]
  }
  await STORE.set({ mnqNotified: notified })
}

// ─── Thông báo & badge ────────────────────────────────────────────────

async function fireNotification(reminder) {
  const task = reminder.task || {}
  const title = task.title || 'Nhắc nhở'
  const remindAt = new Date(reminder.remindAt)
  const timeStr = remindAt.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  })
  const id = `qronx-rem-${reminder.reminderId}-${new Date(reminder.remindAt).getTime()}`

  try {
    await chrome.notifications.create(id, {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon128.png'),
      title: '⏰ ' + title,
      message: `Đến giờ nhắc (${timeStr}) — bấm để mở MN-Qronx`,
      priority: 2,
      requireInteraction: true,
      buttons: [{ title: 'Hoãn 10 phút' }, { title: 'Tắt nhắc' }],
    })
  } catch {
    // Một số Chrome không hỗ trợ buttons / requireInteraction — thử bản gọn
    try {
      await chrome.notifications.create(`qronx-rem-${reminder.reminderId}`, {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon128.png'),
        title: '⏰ ' + title,
        message: `Đến giờ nhắc (${timeStr})`,
        priority: 2,
      })
    } catch {
      /* bỏ qua */
    }
  }
}

async function setBadge(count) {
  try {
    await chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' })
  } catch {
    /* bỏ qua */
  }
}

// ─── Vòng lặp poll mỗi phút ────────────────────────────────────────────

async function pollDue() {
  const tokens = await getTokens()
  if (!tokens?.accessToken) {
    await setBadge(0)
    return
  }

  const res = await api('/reminders/due')
  if (!res.ok || !Array.isArray(res.data?.data || res.data)) {
    if (!res.ok) setBadge(0)
    return
  }
  const all = res.data.data || res.data

  const now = new Date()
  const maxOverdueDate = new Date(
    now.getTime() - MAX_OVERDUE_DAYS * 24 * 60 * 60 * 1000,
  )
  // Giữ đúng điều kiện của bản web: còn SCHEDULED, đã đến giờ, việc không quá hạn lâu
  const due = all
    .filter((r) => r.status === 'SCHEDULED' && r.remindAt && new Date(r.remindAt) <= now)
    .filter((r) => !(r.task?.dueAt && new Date(r.task.dueAt) < maxOverdueDate))

  const notified = await getNotified()
  for (const r of due) {
    const seen = notified[r.reminderId]
    // Chuông lại khi remindAt đổi (sau khi hoãn) hoặc chưa từng chuông
    if (seen && seen.remindAt === String(r.remindAt)) continue
    await fireNotification(r)
    await markNotified(r.reminderId, r.remindAt)
  }

  // Badge: đang chạy bấm giờ thì ưu tiên đếm số phút còn lại của phiên
  await refreshBadge(due.length)
}

function schedulePoll() {
  chrome.alarms.create(POLL_ALARM, { periodInMinutes: 1 })
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === POLL_ALARM) pollDue()
  else if (alarm.name === FOCUS_ALARM) onFocusEnd()
})

chrome.runtime.onInstalled.addListener(() => {
  schedulePoll()
  restoreFocus()
})
chrome.runtime.onStartup.addListener(() => {
  schedulePoll()
  pollDue()
  restoreFocus()
})

// ─── Bấm giờ tập trung (Pomodoro) ─────────────────────────────────────
// Chỉ lưu mốc kết thúc + số phút trong chrome.storage; alarms nền đánh
// thức đúng hạn nên đóng popup (hoặc tắt trình duyệt rồi mở lại) vẫn ok.

function clampMinutes(v) {
  const n = Math.round(Number(v) || 25)
  return Math.min(MAX_FOCUS_MINUTES, Math.max(1, n))
}

async function persistFocus() {
  if (focusState) await STORE.set({ [FOCUS_KEY]: focusState })
  else await STORE.remove(FOCUS_KEY)
}

async function startFocus(minutes) {
  const mins = clampMinutes(minutes)
  focusState = {
    status: 'running',
    endAt: Date.now() + mins * 60 * 1000,
    minutes: mins,
  }
  chrome.alarms.clear(FOCUS_ALARM)
  chrome.alarms.create(FOCUS_ALARM, { when: focusState.endAt })
  await persistFocus()
  await refreshBadge(0)
  return focusState
}

async function pauseFocus() {
  if (!focusState || focusState.status !== 'running') return focusState
  focusState = {
    status: 'paused',
    remainingMs: Math.max(0, focusState.endAt - Date.now()),
    minutes: focusState.minutes,
  }
  chrome.alarms.clear(FOCUS_ALARM)
  await persistFocus()
  await refreshBadge(0)
  return focusState
}

async function resumeFocus() {
  if (!focusState || focusState.status !== 'paused') return focusState
  const remaining = focusState.remainingMs || focusState.minutes * 60 * 1000
  if (remaining <= 0) return onFocusEnd()
  focusState = {
    status: 'running',
    endAt: Date.now() + remaining,
    minutes: Math.round(remaining / 60000),
  }
  chrome.alarms.create(FOCUS_ALARM, { when: focusState.endAt })
  await persistFocus()
  await refreshBadge(0)
  return focusState
}

async function stopFocus() {
  focusState = null
  chrome.alarms.clear(FOCUS_ALARM)
  await persistFocus()
  await refreshBadge(0)
  return null
}

// Hết phiên → thông báo, nút "Tập trung tiếp" bắt đầu phiên cùng độ dài
async function onFocusEnd() {
  const mins = focusState?.minutes || 25
  focusState = null
  await STORE.remove(FOCUS_KEY)
  await STORE.set({ mnqFocusLast: mins })
  await refreshBadge(0)

  try {
    await chrome.notifications.create(`qronx-focus-done-${Date.now()}`, {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon128.png'),
      title: '🍅 Hết phiên tập trung!',
      message: `Bạn vừa tập trung ${mins} phút. Nghỉ ngắn rồi tập trung tiếp nhé.`,
      priority: 2,
      buttons: [{ title: 'Tập trung tiếp' }],
    })
  } catch {
    // Bản gạt cho trình duyệt không hỗ trợ buttons
    try {
      await chrome.notifications.create(`qronx-focus-done-${Date.now()}`, {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon128.png'),
        title: '🍅 Hết phiên tập trung!',
        message: `Bạn vừa tập trung ${mins} phút.`,
        priority: 2,
      })
    } catch {
      /* bỏ qua */
    }
  }
}

// Trình duyệt restart → khôi phục phiên còn hiệu lực
async function restoreFocus() {
  try {
    const items = await STORE.get(FOCUS_KEY)
    const saved = items[FOCUS_KEY]
    if (!saved) return
    if (saved.status === 'running' && saved.endAt > Date.now()) {
      focusState = saved
      chrome.alarms.create(FOCUS_ALARM, { when: saved.endAt })
    } else if (saved.status === 'paused') {
      focusState = saved
    } else if (saved.status === 'running') {
      // Đã trôi qua hạn khi worker vắng — coi như vừa kết thúc
      focusState = saved
      await onFocusEnd()
      return
    }
    await refreshBadge(0)
  } catch {
    /* bỏ qua */
  }
}

// Badge = số phút còn lại của phiên (đang chạy) hoặc khi dừng;
// không có phiên thì nhường chỗ cho số nhắc đến giờ.
async function refreshBadge(dueCount) {
  const now = Date.now()
  if (focusState?.status === 'running') {
    const mins = Math.max(1, Math.ceil((focusState.endAt - now) / 60000))
    try {
      await chrome.action.setBadgeBackgroundColor({ color: '#2563eb' })
      await chrome.action.setBadgeText({ text: String(mins) })
    } catch {
      /* bỏ qua */
    }
    return
  }
  if (focusState?.status === 'paused') {
    try {
      await chrome.action.setBadgeBackgroundColor({ color: '#9aa5c0' })
      await chrome.action.setBadgeText({ text: '⏸' })
    } catch {
      /* một số Chrome không hiện badge blurred — giữ text cũ */
      try {
        await chrome.action.setBadgeText({ text: String(Math.max(1, Math.ceil((focusState.remainingMs || 60000) / 60000))) })
      } catch { /* bỏ qua */ }
    }
    return
  }
  try {
    await chrome.action.setBadgeBackgroundColor({ color: '#3ddc97' })
    await chrome.action.setBadgeText({ text: dueCount > 0 ? String(dueCount) : '' })
  } catch {
    /* bỏ qua */
  }
}

// ─── Sự kiện thông báo ────────────────────────────────────────────────

chrome.notifications.onClicked.addListener((notifId) => {
  if (notifId.startsWith('qronx-rem-')) chrome.tabs.create({ url: WEB_URL })
})

chrome.notifications.onButtonClicked.addListener(async (notifId, buttonIndex) => {
  // Nút "Tập trung tiếp" trên thông báo hết phiên
  if (notifId.startsWith('qronx-focus-done-')) {
    if (buttonIndex === 0) {
      const items = await STORE.get('mnqFocusLast')
      await startFocus(items.mnqFocusLast || 25)
    }
    return
  }
  const match = /qronx-rem-(\d+)/.exec(notifId)
  if (!match) return
  const reminderId = match[1]
  if (buttonIndex === 0) {
    // Hoãn: gọi API rồi chủ động poll lại (remindAt mới sẽ cho chuông tiếp)
    await api(`/reminders/${reminderId}/snooze`, {
      method: 'POST',
      body: { snoozeMinutes: 10 },
    })
  } else {
    await api(`/reminders/${reminderId}/dismiss`, { method: 'POST' })
  }
  await pollDue()
})

// ─── Nhận tin từ popup (login/logout + điều khiển bấm giờ) ────────────

async function signOut(callServer = true) {
  const tokens = await getTokens()
  if (callServer && tokens?.accessToken) {
    try {
      await fetch(API_BASE + '/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      })
    } catch {
      /* bỏ qua */
    }
  }
  await setTokens(null)
  await stopFocus()
  try {
    await chrome.notifications.getAll().then((list) =>
      Object.keys(list).forEach((id) => chrome.notifications.clear(id)),
    )
  } catch {
    /* bỏ qua */
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'signed-in') {
    // Popup login xong sẽ đẩy token vào storage rồi gửi tín hiệu; worker chỉ cần poll ngay
    pollDue().then(() => sendResponse({ ok: true }))
    return true
  }
  if (msg?.type === 'sign-out') {
    signOut(true).then(() => sendResponse({ ok: true }))
    return true
  }
  if (msg?.type === 'focus-start') {
    startFocus(msg.minutes).then((s) => sendResponse({ ok: true, state: s }))
    return true
  }
  if (msg?.type === 'focus-pause') {
    pauseFocus().then((s) => sendResponse({ ok: true, state: s }))
    return true
  }
  if (msg?.type === 'focus-resume') {
    resumeFocus().then((s) => sendResponse({ ok: true, state: s }))
    return true
  }
  if (msg?.type === 'focus-stop') {
    stopFocus().then((s) => sendResponse({ ok: true, state: s }))
    return true
  }
  if (msg?.type === 'focus-status') {
    sendResponse({ ok: true, state: focusState })
    return true
  }
  return undefined
})
