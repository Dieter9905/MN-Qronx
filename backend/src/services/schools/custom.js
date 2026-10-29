// ─── Adapter dự phòng: trường CHƯA có connector riêng ─────────────────────
// Người dùng đang đăng nhập sẵn trên cổng trường trong trình duyệt; extension
// gửi lên URL trang thời khoá biểu + cookie phiên của chính tên miền đó.
// Server tải trang bằng cookie ấy và đọc bảng TKB — không lưu mật khẩu,
// không cần biết trường dùng CAS/SSO/ASP.NET gì.
//
// Giới hạn có chủ đích:
//   • chỉ https + tên miền công khai (chặn SSRF vào mạng nội bộ);
//   • cookie là phiên đăng nhập nên được mã hoá như mật khẩu và có thể hết
//     hạn bất cứ lúc nào — khi đó người dùng chỉ cần mở lại cổng trường và
//     bấm kết nối lại, không phải nhập gì thêm.
import ApiError from '../../utils/ApiError.js'
import { parseTimetableHtml } from './htmlTimetable.js'

const PRIVATE_HOST_RE = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|::1|\[?fd)/i
const MAX_BYTES = 4 * 1024 * 1024
const TIMEOUT_MS = 20_000

export function isAllowedTimetableUrl(rawUrl) {
  try {
    const u = new URL(String(rawUrl))
    if (u.protocol !== 'https:') return false
    return !PRIVATE_HOST_RE.test(u.hostname)
  } catch {
    return false
  }
}

function sanitizeCookie(raw) {
  const cookie = String(raw || '').trim()
  // Cookie header chỉ chứa ký tự in được, không xuống dòng (chống header injection)
  if (!cookie || cookie.length > 4000 || !/^[\x20-\x7E]+$/.test(cookie)) return null
  return cookie
}

export const meta = {
  code: 'CUSTOM',
  name: 'Trường khác (dùng phiên đăng nhập)',
  portal: null,
  usernameLabel: 'Tên trường (để phân biệt)',
  usernamePlaceholder: 'vd: ĐH Công nghệ Thông tin',
  requiresSession: true,
  note: 'Mở cổng trường, đăng nhập, vào trang thời khoá biểu rồi bấm “Kết nối trường này” trên extension. Không lưu mật khẩu — chỉ giữ cookie phiên đã mã hoá.',
}

/** Tải trang TKB bằng cookie phiên và đọc bảng. Trả { slots }. */
export async function fetchTimetable({ cookie, timetableUrl }) {
  const safeCookie = sanitizeCookie(cookie)
  if (!safeCookie) throw ApiError.badRequest('Cookie phiên không hợp lệ — hãy đăng nhập lại trên trang trường')
  if (!isAllowedTimetableUrl(timetableUrl)) {
    throw ApiError.badRequest('Link trang TKB phải là https:// công khai của trường')
  }

  let res
  try {
    res = await fetch(timetableUrl, {
      headers: {
        cookie: safeCookie,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) MN-Qronx/1.2',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'vi,en;q=0.8',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (err) {
    throw ApiError.badRequest(
      err?.name === 'TimeoutError'
        ? 'Cổng trường phản hồi quá lâu — thử lại sau'
        : 'Không kết nối được cổng trường'
    )
  }

  // Bị đá về trang đăng nhập = cookie đã hết hạn
  const finalUrl = res.url || timetableUrl
  if (/login|signin|dang-nhap|dangnhap/i.test(finalUrl) && !/login/i.test(timetableUrl)) {
    throw ApiError.badRequest('Phiên đăng nhập trường đã hết hạn — mở lại cổng trường rồi kết nối lại')
  }
  if (res.status === 401 || res.status === 403) {
    throw ApiError.badRequest('Trường từ chối phiên đăng nhập này — mở lại cổng trường rồi kết nối lại')
  }
  if (!res.ok) throw ApiError.badRequest(`Trang TKB trả lỗi HTTP ${res.status}`)

  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length > MAX_BYTES) throw ApiError.badRequest('Trang TKB quá lớn để đọc an toàn')

  const slots = parseTimetableHtml(buf.toString('utf8'))
  if (!slots.length) {
    throw ApiError.badRequest(
      'Không đọc được bảng TKB trên trang này — hãy mở đúng trang thời khoá biểu (có bảng Thứ/Tiết) rồi kết nối lại'
    )
  }
  return { slots, studentId: null, studentName: null }
}

export default { meta, fetchTimetable, isAllowedTimetableUrl }
