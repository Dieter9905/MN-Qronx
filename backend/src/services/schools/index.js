// ─── Danh mục cổng trường hỗ trợ đăng nhập hộ ─────────────────────────────
// Mỗi trường là một adapter có cùng hợp đồng:
//   fetchTimetable({ username, password }) -> { slots, studentId, studentName }
// Thêm trường mới = thêm 1 file adapter + 1 dòng ở đây; phần còn lại (mã hoá
// mật khẩu, đồng bộ hằng ngày, ghi ScheduleSlot, cảnh báo xung đột) dùng chung.
import hcmut from './hcmut.js'
import custom from './custom.js'

// Trường có connector riêng đứng trước; CUSTOM là đường dự phòng cho mọi
// trường còn lại (dùng phiên đăng nhập + đọc bảng HTML).
const ADAPTERS = [hcmut, custom]

export function listSchools() {
  return ADAPTERS.map(({ meta }) => meta)
}

export function getSchool(code) {
  return ADAPTERS.find((a) => a.meta.code === String(code || '').toUpperCase()) || null
}
