// ─── Lịch học (không gian Lớp học / STUDENT) —— gọi từ UI ───────────
// Workspace STUDENT = 1 trường (SchoolLink) + lưới tiết lặp hằng tuần
// (ScheduleSlot). Import từ URL .ics của trường XÓA toàn bộ tiết cũ nhập
// bằng tay — UI phải cảnh báo trước khi bấm.
import api from './apiClient'

// Danh sách không gian của người dùng — để UI tìm các Lớp học (STUDENT)
export async function listMyWorkspaces() {
  return api('GET', '/workspaces')
}

// Tạo Lớp học (STUDENT) — cần gói Plus trở lên cho lớp thứ 2
export async function createClassWorkspace(name) {
  return api('POST', '/workspaces', { body: { type: 'STUDENT', name } })
}

// Tên trường + URL .ics của lớp hiện tại (theo X-Workspace sẽ do caller gửi)
export async function getSchoolSchedule(headers) {
  return api('GET', '/student/school', { headers })
}

export async function saveSchoolSchedule({ name, icsUrl }, headers) {
  return api('POST', '/student/school', { body: { name, icsUrl }, headers })
}

// Kéo TKB từ URL https công khai (dùng lại URL đã lưu nếu bỏ trống icsUrl)
export async function importTimetable(icsUrl, headers) {
  return api('POST', '/student/school/import', {
    body: icsUrl ? { icsUrl } : {},
    headers,
  })
}

// Danh mục trường hỗ trợ đăng nhập hộ (MyBK/Bách Khoa…)
export async function listSchools() {
  return api('GET', '/student/schools')
}

// Kết nối tài khoản trường: { schoolCode, username, password } — backend tự
// đăng nhập, lấy TKB và lưu mật khẩu đã mã hoá. Mật khẩu không bao giờ trả về.
export async function connectSchool({ schoolCode, username, password }, headers) {
  return api('POST', '/student/connect', { body: { schoolCode, username, password }, headers })
}

export async function disconnectSchool(headers) {
  return api('DELETE', '/student/connect', { headers })
}

export async function syncSchool(headers) {
  return api('POST', '/student/sync', { headers })
}

// Bản tin hôm nay: tiết học các Lớp + việc đến hạn (thông báo trong web)
export async function getTodayBrief() {
  return api('GET', '/student/today-brief')
}

// Nhập TKB từ CSV: dán nội dung file (csv) hoặc link tải (csvUrl)
export async function importTimetableCsv({ csv, csvUrl }, headers) {
  return api('POST', '/student/school/import-csv', {
    body: csv ? { csv } : { csvUrl },
    headers,
  })
}

export async function addScheduleSlot(data, headers) {
  return api('POST', '/student/slots', { body: data, headers })
}

export async function updateScheduleSlot(slotId, data, headers) {
  return api('PUT', `/student/slots/${slotId}`, { body: data, headers })
}

export async function removeScheduleSlot(slotId, headers) {
  return api('DELETE', `/student/slots/${slotId}`, { headers })
}

export async function clearScheduleSlots(headers) {
  return api('POST', '/student/slots/clear', { headers })
}
