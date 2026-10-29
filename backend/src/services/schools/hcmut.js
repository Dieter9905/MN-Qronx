// ─── Adapter cổng trường HCMUT (MyBK) — đăng nhập hộ, CHỈ ĐỌC ───────────────
// Luồng (theo đặc tả công khai của dự án cộng đồng mybk-planner, không phải
// API chính thức của trường):
//   1. GET https://mybk.hcmut.edu.vn/app/login?type=cas  → 302 sang CAS
//   2. GET trang CAS → lấy lt / execution / form action
//   3. POST username + password (form-urlencoded) → 302 kèm ?ticket=ST-…
//   4. GET ticket → HTML app shell chứa hid_Token (JWT)
//   5. GET /api/v1/student/get-student-info   (lấy MSSV)
//      GET /api/v1/student/schedule?studentId=…&semesterYear=…&null
//
// Chỉ đọc thời khoá biểu. Không gọi endpoint ghi (đăng ký môn, huỷ phiếu…),
// không lưu cookie của trường, không log tài khoản/mật khẩu.
import ApiError from '../../utils/ApiError.js'

const BASE = 'https://mybk.hcmut.edu.vn'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) MN-Qronx/1.2'
const TIMEOUT_MS = 15_000

// Cookie jar tối giản: CAS đặt TGC qua Set-Cookie, mỗi request phải gửi lại.
function createClient() {
  const jar = new Map()

  async function request(url, { method = 'GET', headers = {}, body } = {}) {
    const cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ')
    const res = await fetch(url, {
      method,
      headers: {
        'User-Agent': UA,
        ...(cookie ? { cookie } : {}),
        ...headers,
      },
      body,
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    // Node 20+: getSetCookie() trả về từng header riêng
    for (const raw of res.headers.getSetCookie?.() || []) {
      const pair = raw.split(';')[0]
      const i = pair.indexOf('=')
      if (i > 0) jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim())
    }
    return res
  }

  return request
}

const absolute = (url) => (url.startsWith('http') ? url : new URL(url, BASE).href)

function pick(html, re) {
  const m = html.match(re)
  return m ? m[1].trim() : null
}

// CAS: đăng nhập, trả về JWT của app shell
async function casLogin(username, password) {
  const request = createClient()

  const entry = await request(`${BASE}/app/login?type=cas`)
  const location = entry.headers.get('location') || ''
  if (!location.includes('cas/login')) {
    throw ApiError.badRequest('Cổng trường chưa trả về trang đăng nhập CAS — thử lại sau ít phút')
  }
  const casUrl = absolute(location)

  const formRes = await request(casUrl)
  const formHtml = await formRes.text()
  const lt = pick(formHtml, /name="lt"\s+value="([^"]+)"/i)
  const execution = pick(formHtml, /name="execution"\s+value="([^"]+)"/i)
  const action = pick(formHtml, /<form[^>]*action="([^"]+)"/i)
  if (!lt || !execution) {
    throw ApiError.badRequest('Không đọc được form đăng nhập CAS — trường đang chặn tạm thời, thử lại sau')
  }

  const body = new URLSearchParams({
    username,
    password,
    lt,
    execution,
    _eventId: 'submit',
    submit: 'Login',
  })
  const post = await request(absolute(action || casUrl), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (![301, 302, 303].includes(post.status)) {
    // CAS trả 200 = sai tài khoản/mật khẩu (hoặc bị giới hạn tần suất)
    throw ApiError.badRequest('Sai tài khoản hoặc mật khẩu trường (hoặc trường đang tạm chặn đăng nhập)')
  }
  const ticketLocation = post.headers.get('location') || ''
  if (!ticketLocation.includes('ticket=')) {
    throw ApiError.badRequest('Đăng nhập CAS không trả về ticket — thử lại sau')
  }

  const shell = await request(absolute(ticketLocation))
  const shellHtml = await shell.text()
  const jwt = pick(shellHtml, /id="hid_Token"\s+value="([^"]+)"/i)
  if (!jwt) throw ApiError.badRequest('Đăng nhập xong nhưng không lấy được token cổng trường')

  return { request, jwt }
}

async function apiGet(request, jwt, path, params = {}) {
  const url = new URL(`${BASE}/api/${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  // Portal chèn tham số `null` để chống cache; thiếu nó một số endpoint trả rỗng
  url.searchParams.set('null', '')

  const res = await request(url.href, {
    headers: {
      Authorization: jwt, // app shell gửi JWT trần, không có tiền tố Bearer
      Accept: 'application/json',
      'Accept-Language': 'vi',
      'Content-Type': 'application/json',
      Origin: BASE,
      Referer: `${BASE}/app/`,
    },
  })
  const text = (await res.text()).replace(/^\uFEFF/, '')
  let payload
  try {
    payload = JSON.parse(text)
  } catch {
    throw ApiError.badRequest(`Cổng trường trả dữ liệu lạ (HTTP ${res.status})`)
  }
  const code = String(payload?.code ?? '')
  if (code !== '200' && code !== '400') {
    throw ApiError.badRequest(payload?.msg || `Cổng trường báo lỗi (mã ${code || res.status})`)
  }
  return payload?.data
}

// "07g00" / "0700" / "7:00" → "07:00"
function clock(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  const g = raw.replace(/g/i, ':')
  const m = g.match(/^(\d{1,2}):?(\d{2})$/)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

// HCMUT đánh số thứ 2..8 (8 = Chủ nhật); hệ thống ta dùng 1..7 (7 = CN)
function weekDayOf(code) {
  const n = Number(code)
  if (!Number.isFinite(n) || n < 2 || n > 8) return null
  return n - 1
}

export const meta = {
  code: 'HCMUT',
  name: 'ĐH Bách Khoa TP.HCM',
  portal: `${BASE}/app/login`,
  usernameLabel: 'BKNetID (phần trước @hcmut.edu.vn)',
  usernamePlaceholder: 'vd: 2212345',
  note: 'Đăng nhập bằng tài khoản MyBK. Hệ thống chỉ ĐỌC thời khoá biểu, không đăng ký môn.',
}

/** Đăng nhập + lấy TKB hiện tại. Trả { slots, studentId, studentName }. */
export async function fetchTimetable({ username, password }) {
  const { request, jwt } = await casLogin(username, password)

  const profile = await apiGet(request, jwt, 'v1/student/get-student-info').catch(() => null)
  const studentId =
    profile?.code || profile?.maSinhVien || profile?.mssv || profile?.studentId || username
  const studentName = [profile?.lastName, profile?.firstName].filter(Boolean).join(' ') || null

  const schedule = await apiGet(request, jwt, 'v1/student/schedule', {
    studentId: String(studentId),
    semesterYear: '', // trống = học kỳ hiện tại
  })

  const rows = Array.isArray(schedule) ? schedule : []
  const seen = new Set()
  const slots = []
  for (const r of rows) {
    const weekDay = weekDayOf(r?.dayOfWeek)
    const startTime = clock(r?.startTime)
    const endTime = clock(r?.endTime)
    const title = String(r?.subject?.nameVi || r?.subject?.nameEn || r?.subject?.code || '').trim()
    if (!weekDay || !startTime || !endTime || !title) continue
    const key = `${title}~${weekDay}~${startTime}~${endTime}`
    if (seen.has(key)) continue
    seen.add(key)
    const teacher = [r?.employee?.lastName, r?.employee?.firstName].filter(Boolean).join(' ').trim()
    slots.push({
      title: title.slice(0, 200),
      weekDay,
      startTime,
      endTime,
      room: r?.room?.code ? String(r.room.code).slice(0, 100) : null,
      teacher: teacher ? teacher.slice(0, 120) : null,
    })
    if (slots.length >= 800) break
  }

  if (!slots.length) {
    throw ApiError.badRequest('Cổng trường trả về TKB rỗng — có thể đang ngoài học kỳ hoặc chưa đăng ký môn')
  }
  return { slots, studentId: String(studentId), studentName }
}

export default { meta, fetchTimetable }
