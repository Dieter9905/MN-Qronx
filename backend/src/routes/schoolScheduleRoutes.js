// ─── Routes lịch học (STUDENT: SchoolLink + ScheduleSlot) ──
// Mount tại /api/v1/student (index.js) — auth + workspaceContext gắn ở mount
// nên mọi endpoint xử lý theo header X-Workspace (không gian Lớp học).
import { Router } from 'express'
import * as c from '../controllers/schoolScheduleController.js'

const router = Router()

// Danh mục trường hỗ trợ đăng nhập hộ (MyBK/Bách Khoa…)
router.get('/schools', c.listSchools)
// Kết nối tài khoản trường: {schoolCode, username, password} → đăng nhập thử + đồng bộ
router.post('/connect', c.connectSchool)
router.delete('/connect', c.disconnectSchool)
// Đồng bộ lại ngay cho Lớp đã kết nối
router.post('/sync', c.syncSchool)

// THÔNG TIN TRƯỜNG + toàn bộ lưới tiết
router.get('/school', c.getSchool)
// Đặt tên trường + (tuỳ chọn) URL .ics TKB — chỉ Owner/Admin
router.post('/school', c.saveSchool)
// Đồng bộ lại TKB từ URL đã lưu (hoặc url mới trong body)
router.post('/school/import', c.importIcs)
// Nhập TKB từ CSV: dán nội dung (csv) hoặc link https tải file (csvUrl)
router.post('/school/import-csv', c.importCsv)
// Extension (đã đăng nhập cổng trường) đọc bảng TKB và gửi tiết về — dùng
// được với MỌI trường, không lưu mật khẩu sinh viên.
router.post('/school/import-slots', c.importSlots)
// Bản tin hôm nay: tiết học + việc đến hạn, cho thông báo trong web
router.get('/today-brief', c.todayBrief)

// Tiết học thủ công: nhập tay từng tiết thay vì import
router.post('/slots', c.addSlot)
router.put('/slots/:slotId', c.updateSlot)
router.delete('/slots/:slotId', c.removeSlot)
router.post('/slots/clear', c.clearSlots)

export default router
