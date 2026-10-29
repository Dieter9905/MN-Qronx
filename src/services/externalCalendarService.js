// ─── Lịch ngoài (Google Calendar / Outlook .ics) — gọi từ UI ─────────────
// Người dùng dán "Secret address in iCal format" của lịch Google (hoặc link
// xuất .ics của Outlook/iCloud) vào trang Lịch; backend kéo sự kiện về cache,
// trang Lịch đọc thêm lớp sự kiện này để hiển thị cạnh công việc. Đọc thôi —
// không thể ghi gì lên lịch nguồn.
import api from './apiClient'

export async function listExternalCalendars() {
  return api('GET', '/me/external-calendars')
}

export async function addExternalCalendar(url, name) {
  return api('POST', '/me/external-calendars', { body: { url, name: name || undefined } })
}

export async function updateExternalCalendar(calendarId, { name, isActive } = {}) {
  return api('PUT', `/me/external-calendars/${calendarId}`, {
    body: { name: name || undefined, isActive },
  })
}

export async function syncExternalCalendar(calendarId) {
  return api('POST', `/me/external-calendars/${calendarId}/sync`)
}

export async function removeExternalCalendar(calendarId) {
  return api('DELETE', `/me/external-calendars/${calendarId}`)
}

// Sự kiện của mọi lịch ngoài đang bật, đóng gói theo khoảng thời gian
export async function getExternalEvents({ from, to }) {
  return api('GET', '/me/external-calendars/events', {
    query: {
      from: from ? new Date(from).toISOString() : undefined,
      to: to ? new Date(to).toISOString() : undefined,
    },
  })
}
