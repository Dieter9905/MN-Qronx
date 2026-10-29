// ─── Controller lịch học (STUDENT) ─────────────────────────────
import * as s from '../services/schoolScheduleService.js'
import { success } from '../dto/response/apiResponse.js'

export async function getSchool(req, res) {
  // Cho phép thành viên đọc cả khi chưa gắn trường → trả null để UI hiện "
  // chưa có lịch, bấm để thiết lập".
  if (!req.workspace || req.workspace.type !== 'STUDENT') {
    return success(res, 200, 'Không có lịch học trong ngữ cảnh này', null)
  }
  const school = await s.getSchool(req.workspace.workspaceId)
  return success(res, 200, 'Lịch học của lớp', school)
}

export async function saveSchool(req, res) {
  const school = await s.saveSchool(req, req.body || {})
  return success(res, 200, 'Đã lưu thông tin trường', school)
}

export async function importIcs(req, res) {
  const result = await s.importFromIcs(req, req.body || {})
  return success(res, 200, 'Đã nhập TKB từ URL trường', result)
}

export async function importCsv(req, res) {
  const result = await s.importFromCsv(req, req.body || {})
  return success(res, 200, 'Đã nhập TKB từ CSV', result)
}

// Extension đã đăng nhập sẵn trên cổng trường → gửi danh sách tiết về đây
export async function importSlots(req, res) {
  const result = await s.importSlots(req, req.body || {})
  return success(res, 200, `Đã cập nhật ${result.imported} tiết từ trang trường`, result)
}

// Bản tin hôm nay cho thông báo trong web (mọi Lớp + việc đến hạn)
export async function todayBrief(req, res) {
  const data = await s.getTodayBrief(req.user.id)
  return success(res, 200, 'Lịch hôm nay', data)
}

// Danh mục trường hỗ trợ đăng nhập hộ (để UI dựng ô chọn trường)
export async function listSchools(req, res) {
  return success(res, 200, 'Danh mục trường hỗ trợ', s.listSupportedSchools())
}

// Chọn trường + tài khoản/mật khẩu trường → đăng nhập thử và đồng bộ ngay
export async function connectSchool(req, res) {
  const result = await s.connectSchool(req, req.body || {})
  return success(res, 200, `Đã kết nối ${result.schoolName} và cập nhật ${result.imported} tiết`, result)
}

export async function disconnectSchool(req, res) {
  await s.disconnectSchool(req)
  return success(res, 200, 'Đã ngắt kết nối tài khoản trường', { disconnected: true })
}

// Đồng bộ lại ngay (không chờ job hằng ngày)
export async function syncSchool(req, res) {
  const result = await s.syncConnectedSchool(req)
  return success(res, 200, `Đã đồng bộ ${result.imported} tiết từ cổng trường`, result)
}

export async function addSlot(req, res) {
  const slot = await s.addSlot(req, req.body || {})
  return success(res, 201, 'Đã thêm tiết học', slot)
}

export async function updateSlot(req, res) {
  const slotId = parseInt(req.params.slotId, 10)
  const slot = await s.updateSlot(req, slotId, req.body || {})
  return success(res, 200, 'Đã cập nhật tiết học', slot)
}

export async function removeSlot(req, res) {
  const slotId = parseInt(req.params.slotId, 10)
  await s.removeSlot(req, slotId)
  return success(res, 200, 'Đã xoá tiết học', { removed: true })
}

export async function clearSlots(req, res) {
  await s.clearSlots(req)
  return success(res, 200, 'Đã xoá toàn bộ lịch học của lớp', { cleared: true })
}
