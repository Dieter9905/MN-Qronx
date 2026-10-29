// ─── Lịch học (không gian STUDENT) ─────────────────────────────────
// Workspace STUDENT = một lớp học gắn đúng 1 trường (SchoolLink). TKB nằm
// trong bảng ScheduleSlot dạng "tiết lặp hằng tuần" (weekDay + giờ), KHÔNG
// ép thành Task để không lẫn vào nhắc chuông cá nhân — trang Lịch vẽ lớp
// như một lớp calendar riêng.
//
// Import tái dụng đúng parser ICS của lịch ngoài Google/Outlook: parseIcs +
// expandRrule + fetch có timeout/giới hạn dung lượng. Khác điểm duy nhất:
// URL trường là https:// công khai BẤT KỲ (qldt.hcmut.edu.vn, my.uit.edu.vn…)
// chứ không chỉ 3 nhà cung cấp lớn — vẫn chặn cứng host nội bộ (SSRF).
//
// Nguồn thứ hai: CSV (nhiều cổng qldt chỉ cho tải bảng Excel/CSV). Tách cột
// theo tiêu đề tiếng Việt/Anh, dùng chung đích đến là bảng ScheduleSlot nên
// lưới TKB và cảnh báo xung đột không cần biết nguồn nhập là gì.

import prisma from '../config/prisma.js'
import ApiError from '../utils/ApiError.js'
import { parseIcs, expandRrule, fetchIcs } from './externalCalendarService.js'
import { sealSecret, openSecret } from '../utils/secretBox.js'
import { getSchool as getSchoolAdapter, listSchools as listSchoolAdapters } from './schools/index.js'

// Ký tự chặn SSRF giống lịch ngoài: chỉ https + không host loopback/LAN.
// (Ngược với isAllowedIcsUrl — ở đó allowlist 3 nhà cung cấp vì lịch cá nhân;
// lịch trường thì tên miền đa dạng nên coi https công khai là đủ an toàn.)
const PRIVATE_HOST_RE = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|::1|\[?fd)/i

function isAllowedSchoolUrl(rawUrl) {
  try {
    const u = new URL(String(rawUrl))
    if (u.protocol !== 'https:') return false
    return !PRIVATE_HOST_RE.test(u.hostname)
  } catch {
    return false
  }
}

const MAX_SLOTS = 800
const IMPORT_HORIZON_DAYS = 180 // đủ che 1 học kỳ

const MIXED_PALETTE = ['#7c8cff', '#34b98a', '#f59e42', '#ef4d70', '#8b5cf6', '#0ea5e9', '#eab308', '#14b8a6']
function colorForIndex(i) {
  return MIXED_PALETTE[i % MIXED_PALETTE.length]
}

// ── Quyền: đọc cho mọi thành viên; ghi chỉ OWNER/ADMIN ──────────────
function assertWritable(req) {
  if (!req.workspace) {
    throw ApiError.badRequest('Lịch học thuộc không gian Lớp học — hãy chọn một Lớp trên sidebar trước')
  }
  if (req.workspace.type !== 'STUDENT') {
    throw ApiError.badRequest('Không gian này không phải Lớp học (STUDENT) — lịch học chỉ hoạt động với Lớp')
  }
  if (!['OWNER', 'ADMIN'].includes(req.workspace.role)) {
    throw ApiError.forbidden('Chỉ người tạo lớp (Owner/Admin) mới được chỉnh lịch học')
  }
}

// ── Lấy / tạo SchoolLink ────────────────────────────────────────────
export async function getSchool(workspaceId) {
  const school = await prisma.schoolLink.findUnique({
    where: { workspaceId },
    include: {
      slots: { orderBy: [{ weekDay: 'asc' }, { startTime: 'asc' }] },
    },
  })
  if (!school) return null
  // Kèm trạng thái kết nối tài khoản trường — KHÔNG bao giờ trả mật khẩu
  const account = await prisma.schoolAccount.findUnique({ where: { workspaceId } })
  return {
    ...school,
    connection: account
      ? {
          schoolCode: account.schoolCode,
          username: account.username,
          mssv: account.mssv,
          status: account.status,
          lastSyncedAt: account.lastSyncedAt,
          lastError: account.lastError,
        }
      : null,
  }
}

// ── Danh mục trường hỗ trợ đăng nhập hộ ────────────────────────────
export function listSupportedSchools() {
  return listSchoolAdapters()
}

// Ghi một lượt TKB vào SchoolLink: thay toàn bộ tiết cũ, đánh dấu đã đồng bộ.
async function writeSlots(schoolLinkId, slots) {
  const rows = slots.map((slot, i) => ({
    schoolLinkId,
    ...slot,
    colorCode: slot.colorCode || colorForIndex(i),
  }))
  const now = new Date()
  await prisma.$transaction([
    prisma.scheduleSlot.deleteMany({ where: { schoolLinkId } }),
    prisma.scheduleSlot.createMany({ data: rows, skipDuplicates: true }),
    prisma.schoolLink.update({
      where: { schoolLinkId },
      data: { lastSyncedAt: now, lastError: null },
    }),
  ])
  return rows.length
}

// ── Kết nối tài khoản trường (OneUni-style) ─────────────────────────
// Đăng nhập thử NGAY để báo sai mật khẩu liền; chỉ khi thành công mới lưu
// bản mã hoá mật khẩu. Lần đồng bộ sau (hằng ngày) dùng lại bản mã hoá đó.
export async function connectSchool(req, { schoolCode, username, password, timetableUrl, cookie }) {
  assertWritable(req)
  const adapter = getSchoolAdapter(schoolCode)
  if (!adapter) throw ApiError.badRequest('Trường này chưa được hỗ trợ đăng nhập tự động')

  const workspaceId = req.workspace.workspaceId
  const bySession = !!adapter.meta.requiresSession

  // Hai kiểu xác thực:
  //  • PASSWORD — connector riêng của trường (HCMUT): nhập tài khoản/mật khẩu.
  //  • COOKIE   — trường chưa có connector: dùng phiên đăng nhập sẵn từ trình
  //               duyệt (extension gửi lên), KHÔNG lưu mật khẩu.
  const user = String(username || '').trim()
  let result
  if (bySession) {
    if (!timetableUrl) throw ApiError.badRequest('Cần link trang thời khoá biểu của trường')
    if (!cookie) {
      throw ApiError.badRequest(
        'Thiếu phiên đăng nhập trường — mở trang TKB trong trình duyệt rồi bấm “Kết nối trường này” trên extension'
      )
    }
    try {
      result = await adapter.fetchTimetable({ cookie, timetableUrl })
    } catch (err) {
      throw err instanceof ApiError
        ? err
        : ApiError.badRequest(`Không đọc được TKB: ${err?.message || 'lỗi không rõ'}`)
    }
  } else {
    if (!user) throw ApiError.badRequest('Nhập tài khoản trường (BKNetID/MSSV)')
    if (!password) throw ApiError.badRequest('Nhập mật khẩu tài khoản trường')
    try {
      result = await adapter.fetchTimetable({ username: user, password })
    } catch (err) {
      // Không lưu mật khẩu khi đăng nhập thất bại
      throw err instanceof ApiError
        ? err
        : ApiError.badRequest(`Không đăng nhập được cổng trường: ${err?.message || 'lỗi không rõ'}`)
    }
  }

  const schoolName = bySession ? user || adapter.meta.name : adapter.meta.name
  const school = await prisma.schoolLink.upsert({
    where: { workspaceId },
    create: { workspaceId, name: schoolName.slice(0, 150) },
    update: { name: schoolName.slice(0, 150) },
  })
  const imported = await writeSlots(school.schoolLinkId, result.slots)

  const data = {
    schoolCode: adapter.meta.code,
    username: bySession ? user || adapter.meta.name : user,
    authType: bySession ? 'COOKIE' : 'PASSWORD',
    passwordEnc: bySession ? null : sealSecret(password),
    cookieEnc: bySession ? sealSecret(cookie) : null,
    timetableUrl: bySession ? String(timetableUrl).slice(0, 1000) : null,
    mssv: result.studentId || null,
    status: 'CONNECTED',
    lastSyncedAt: new Date(),
    lastError: null,
  }
  await prisma.schoolAccount.upsert({
    where: { workspaceId },
    create: { workspaceId, ...data },
    update: data,
  })

  return {
    imported,
    studentId: result.studentId || null,
    studentName: result.studentName || null,
    schoolCode: adapter.meta.code,
    schoolName: school.name,
  }
}

/** Ngắt kết nối: xoá tài khoản + mật khẩu đã lưu, giữ nguyên tiết đã đồng bộ. */
export async function disconnectSchool(req) {
  assertWritable(req)
  await prisma.schoolAccount.deleteMany({ where: { workspaceId: req.workspace.workspaceId } })
  return true
}

/** Đồng bộ lại ngay cho một Lớp đã kết nối. */
export async function syncConnectedSchool(req) {
  assertWritable(req)
  const workspaceId = req.workspace.workspaceId
  const account = await prisma.schoolAccount.findUnique({ where: { workspaceId } })
  if (!account) throw ApiError.badRequest('Lớp này chưa kết nối tài khoản trường')
  return syncAccount(account)
}

// Dùng chung cho "Đồng bộ ngay" và job hằng ngày
async function syncAccount(account) {
  const adapter = getSchoolAdapter(account.schoolCode)
  if (!adapter) throw ApiError.badRequest('Trường của tài khoản này không còn được hỗ trợ')

  // Trường dùng phiên đăng nhập (CUSTOM): giải mã cookie thay vì mật khẩu
  const bySession = account.authType === 'COOKIE'
  const secret = openSecret(bySession ? account.cookieEnc : account.passwordEnc)
  const secretLabel = bySession ? 'phiên đăng nhập' : 'mật khẩu'
  if (!secret) {
    await prisma.schoolAccount.update({
      where: { schoolAccountId: account.schoolAccountId },
      data: { status: 'ERROR', lastError: `Không giải mã được ${secretLabel} — hãy kết nối lại trường` },
    })
    throw ApiError.badRequest(`Không giải mã được ${secretLabel} đã lưu — hãy kết nối lại trường`)
  }

  const school = await prisma.schoolLink.findUnique({ where: { workspaceId: account.workspaceId } })
  if (!school) throw ApiError.notFound('Lớp chưa có thông tin trường')

  try {
    const result = bySession
      ? await adapter.fetchTimetable({ cookie: secret, timetableUrl: account.timetableUrl })
      : await adapter.fetchTimetable({ username: account.username, password: secret })
    const imported = await writeSlots(school.schoolLinkId, result.slots)
    await prisma.schoolAccount.update({
      where: { schoolAccountId: account.schoolAccountId },
      data: {
        status: 'CONNECTED',
        lastSyncedAt: new Date(),
        lastError: null,
        mssv: result.studentId || account.mssv,
      },
    })
    return { imported, studentId: result.studentId || account.mssv, schoolName: adapter.meta.name }
  } catch (err) {
    const msg = String(err?.message || 'Đồng bộ thất bại').slice(0, 290)
    await prisma.schoolAccount
      .update({
        where: { schoolAccountId: account.schoolAccountId },
        data: { status: 'ERROR', lastError: msg },
      })
      .catch(() => {})
    throw err instanceof ApiError ? err : ApiError.badRequest(msg)
  }
}

/** Job hằng ngày: đồng bộ mọi Lớp đã kết nối tài khoản trường. */
export async function syncAllConnectedSchools() {
  const accounts = await prisma.schoolAccount.findMany({
    select: {
      schoolAccountId: true,
      workspaceId: true,
      schoolCode: true,
      username: true,
      authType: true,
      passwordEnc: true,
      cookieEnc: true,
      timetableUrl: true,
      mssv: true,
    },
  })
  let ok = 0
  let failed = 0
  for (const account of accounts) {
    try {
      await syncAccount(account)
      ok += 1
    } catch {
      failed += 1 // lỗi đã ghi vào lastError của từng tài khoản
    }
  }
  return { total: accounts.length, ok, failed }
}

function validateSlotInput({ title, weekDay, startTime, endTime, room, teacher, dateOverride, colorCode }) {
  if (!title?.trim()) throw ApiError.badRequest('Tên môn/tiết trống')
  const wd = parseInt(weekDay, 10)
  if (!Number.isInteger(wd) || wd < 1 || wd > 7) {
    throw ApiError.badRequest('weekDay phải là 1 (Thứ 2) … 7 (Chủ nhật)')
  }
  for (const [key, val] of [['startTime', startTime], ['endTime', endTime]]) {
    if (!/^\d{2}:\d{2}$/.test(String(val || ''))) {
      throw ApiError.badRequest(`${key} phải dạng "HH:mm" (ví dụ 07:30)`)
    }
  }
  const [sh, sm] = String(startTime).split(':').map(Number)
  const [eh, em] = String(endTime).split(':').map(Number)
  if (sh * 60 + sm >= eh * 60 + em) {
    throw ApiError.badRequest('Giờ bắt đầu phải TRƯỚC giờ kết thúc')
  }
  return {
    title: title.trim().slice(0, 200),
    weekDay: wd,
    startTime: String(startTime).slice(0, 5),
    endTime: String(endTime).slice(0, 5),
    room: room ? String(room).slice(0, 100) : null,
    teacher: teacher ? String(teacher).slice(0, 120) : null,
    dateOverride: dateOverride ? String(dateOverride).slice(0, 10) : null,
    colorCode: /^#[0-9a-f]{6}$/i.test(colorCode || '') ? colorCode : null,
  }
}

/** Tạo/cập nhật trường của Workspace STUDENT + đồng bộ ngay nếu có URL .ics. */
export async function saveSchool(req, { name, icsUrl }) {
  assertWritable(req)
  const workspaceId = req.workspace.workspaceId
  if (icsUrl && !isAllowedSchoolUrl(icsUrl)) {
    throw ApiError.badRequest('URL TKB phải là link https:// công khai của trường (không nhận địa chỉ nội bộ)')
  }

  const data = {
    name: name?.trim().slice(0, 150) || 'Trường của lớp',
    ...(icsUrl !== undefined ? { icsUrl: icsUrl ? String(icsUrl).slice(0, 1000) : null } : {}),
  }
  const school = await prisma.schoolLink.upsert({
    where: { workspaceId },
    create: { workspaceId, ...data },
    update: data,
  })
  return school
}

// ── Import TKB từ URL .ics → các tiết lặp hằng tuần ─────────────────
// Chiến lược: mở rộng RRULE tới horizon 180 ngày, mỗi lần xuất hiện biến
// thành chữ ký (weekday, giờ bắt đầu, giờ kết thúc, tên môn). Các chữ ký
// số lượng >= 2 (hoặc sự kiện không lặp) mới thành slot — nhờ vậy lỗi lẻ
// (từ vło ngày thi một lần) không làm mỗi ô Lịch nổ ra hàng chục dòng.
export async function importFromIcs(req, { icsUrl }) {
  assertWritable(req)
  const workspaceId = req.workspace.workspaceId
  const school = await prisma.schoolLink.findUnique({ where: { workspaceId } })
  if (!school) throw ApiError.notFound('Chưa gắn trường cho lớp — hãy đặt tên trường trước')

  const url = icsUrl || school.icsUrl
  if (!url) throw ApiError.badRequest('Chưa có URL .ics — dán link xuất TKB của trường trước')
  if (!isAllowedSchoolUrl(url)) {
    throw ApiError.badRequest('URL TKB phải là link https:// công khai (không nhận địa chỉ nội bộ)')
  }

  const now = new Date()
  const horizon = new Date(now.getTime() + IMPORT_HORIZON_DAYS * 86_400_000)
  try {
    const text = await fetchIcs(url)
    const parsed = parseIcs(text)
    const expanded = []
    for (const e of parsed) {
      if (e.allDay) continue // thi/ration ngày không giờ — không vẽ được trên lưới tiết
      expanded.push(...(e.rrule ? expandRrule(e, e.rrule, horizon) : [e]))
    }

    // Chữ ký tiết theo tuần: giờ theo UTC+7 (nguồn VN không cần Z trước đây)
    const signatureCounts = new Map()
    const signatures = []
    for (const occ of expanded) {
      const startVN = new Date(occ.startsAt.getTime() + 7 * 3_600_000)
      const endVN = new Date(occ.endsAt.getTime() + 7 * 3_600_000)
      const weekDay = startVN.getUTCDay() === 0 ? 7 : startVN.getUTCDay()
      const startTime = `${String(startVN.getUTCHours()).padStart(2, '0')}:${String(startVN.getUTCMinutes()).padStart(2, '0')}`
      const endTime = `${String(endVN.getUTCHours()).padStart(2, '0')}:${String(endVN.getUTCMinutes()).padStart(2, '0')}`
      const baseUid = String(occ.uid).split('#')[0].slice(0, 240)
      const key = `${occ.title}~${weekDay}~${startTime}~${endTime}`
      if (!signatureCounts.has(key)) {
        signatureCounts.set(key, 0)
        signatures.push({ title: occ.title, weekDay, startTime, endTime, baseUid, key })
      }
      signatureCounts.set(key, signatureCounts.get(key) + 1)
    }

    // Tiết xuất hiện ít nhất 2 lần trong horizon (lớp học lặp hàng tuần) hoặc
    // sự kiện đơn lẻ của môn không lặp — giữ cả hai, tránh rớt tiết mới nhập giữa kỳ.
    const keep = signatures.filter((s) => signatureCounts.get(s.key) >= 2).slice(0, MAX_SLOTS)
    const singles = signatures.filter((s) => signatureCounts.get(s.key) === 1).slice(0, Math.max(0, MAX_SLOTS - keep.length))

    const rows = [...keep, ...singles].map((s, i) => ({
      schoolLinkId: school.schoolLinkId,
      title: s.title.slice(0, 200),
      weekDay: s.weekDay,
      startTime: s.startTime,
      endTime: s.endTime,
      colorCode: colorForIndex(i),
      sourceUid: `${s.baseUid}#${s.key}`,
    }))

    await prisma.$transaction([
      prisma.scheduleSlot.deleteMany({ where: { schoolLinkId: school.schoolLinkId } }),
      prisma.scheduleSlot.createMany({ data: rows, skipDuplicates: true }),
      prisma.schoolLink.update({ where: { schoolLinkId: school.schoolLinkId }, data: { lastSyncedAt: now, lastError: null } }),
    ])
    return { imported: rows.length }
  } catch (err) {
    const msg = `Lỗi import TKB: ${err?.name === 'AbortError' ? 'quá thời gian chờ máy chủ trường' : (err.message || 'không rõ')}`.slice(0, 290)
    await prisma.schoolLink.update({
      where: { schoolLinkId: school.schoolLinkId },
      data: { lastError: msg },
    }).catch(() => {})
    throw new Error(msg)
  }
}

// ── Import TKB từ CSV ──────────────────────────────────────────────
// Cổng quản lý đào tạo thường chỉ xuất Excel/CSV chứ không có .ics. Chỉ cần
// người dùng dán nội dung CSV (hoặc link https tải file) là đủ: tiêu đề cột
// nhận cả tiếng Việt lẫn tiếng Anh, dấu phẩy/chấm phẩy/tab đều được.
const CSV_MAX_BYTES = 512 * 1024

const CSV_COLUMNS = {
  title: ['mon', 'mon hoc', 'ten mon', 'ten mon hoc', 'title', 'subject', 'course'],
  weekDay: ['thu', 'thu trong tuan', 'weekday', 'day'],
  startTime: ['bat dau', 'gio bat dau', 'tu', 'start', 'start time', 'starttime'],
  endTime: ['ket thuc', 'gio ket thuc', 'den', 'end', 'end time', 'endtime'],
  room: ['phong', 'phong hoc', 'room', 'location'],
  teacher: ['giao vien', 'giang vien', 'teacher', 'lecturer'],
}

function normalizeCell(value) {
  return String(value ?? '')
    .trim()
    .replace(/^"(.*)"$/s, '$1')
    .trim()
}

// Bỏ dấu tiếng Việt + hạ chữ để so tiêu đề cột: "Bắt đầu" = "bat dau".
function normalizeHeader(value) {
  return normalizeCell(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
}

// Đọc CSV thủ công thay vì thêm thư viện: cần đúng một việc là tách ô có
// ngoặc kép (tên môn hay chứa dấu phẩy) và tự nhận dấu phân cách.
function splitCsv(text) {
  const firstLine = text.split(/\r?\n/).find((l) => l.trim()) || ''
  const delimiter = [';', '\t', ','].reduce(
    (best, d) => (firstLine.split(d).length > firstLine.split(best).length ? d : best),
    ','
  )
  const rows = []
  let row = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"'
        i += 1
      } else if (ch === '"') {
        quoted = false
      } else {
        cell += ch
      }
      continue
    }
    if (ch === '"') {
      quoted = true
    } else if (ch === delimiter) {
      row.push(cell)
      cell = ''
    } else if (ch === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else if (ch !== '\r') {
      cell += ch
    }
  }
  row.push(cell)
  rows.push(row)
  return { delimiter, rows: rows.filter((r) => r.some((c) => String(c).trim() !== '')) }
}

// "Thứ 2", "T2", "2", "monday", "CN" → 1..7 (7 = Chủ nhật)
function parseWeekDay(raw) {
  const value = normalizeHeader(raw)
  if (!value) return null
  if (/^(cn|chu nhat|sunday|sun|8)$/.test(value)) return 7
  const named = { 'thu 2': 1, 'thu hai': 1, monday: 1, mon: 1, 'thu 3': 2, 'thu ba': 2, tuesday: 2, tue: 2, 'thu 4': 3, 'thu tu': 3, wednesday: 3, wed: 3, 'thu 5': 4, 'thu nam': 4, thursday: 4, thu: 4, 'thu 6': 5, 'thu sau': 5, friday: 5, fri: 5, 'thu 7': 6, 'thu bay': 6, saturday: 6, sat: 6 }
  if (named[value]) return named[value]
  const digit = value.replace(/^(t|thu)\s*/, '').match(/^[1-7]$/)
  return digit ? Number(digit[0]) : null
}

// "07:30", "7:30", "7h30", "0730", "7" → "HH:mm"
function parseClock(raw) {
  const value = normalizeCell(raw).toLowerCase().replace(/\s/g, '')
  if (!value) return null
  let m = value.match(/^(\d{1,2})[:h.](\d{1,2})$/) || value.match(/^(\d{1,2})$/)
  if (!m) {
    m = value.match(/^(\d{2})(\d{2})$/) ? [null, value.slice(0, 2), value.slice(2)] : null
  }
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2] ?? 0)
  if (h > 23 || min > 59) return null
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

/** Đổi nội dung CSV → danh sách tiết (đã khử trùng theo môn + thứ + giờ). */
export function parseTimetableCsv(text) {
  if (!text || typeof text !== 'string') throw ApiError.badRequest('File CSV trống')
  if (Buffer.byteLength(text, 'utf8') > CSV_MAX_BYTES) {
    throw ApiError.badRequest('File CSV quá lớn — tối đa 512KB')
  }
  const { rows } = splitCsv(text.replace(/^\uFEFF/, ''))
  if (rows.length < 2) {
    throw ApiError.badRequest('CSV phải có dòng tiêu đề và ít nhất một tiết học')
  }

  // Ghép tiêu đề cột → trường chuẩn; cột lạ thì bỏ qua thay vì từ chối cả file.
  const headerMap = {}
  rows[0].forEach((cell, index) => {
    const header = normalizeHeader(cell)
    for (const [field, aliases] of Object.entries(CSV_COLUMNS)) {
      if (headerMap[field] === undefined && aliases.includes(header)) headerMap[field] = index
    }
  })
  for (const required of ['title', 'weekDay', 'startTime', 'endTime']) {
    if (headerMap[required] === undefined) {
      throw ApiError.badRequest(
        'CSV thiếu cột bắt buộc: Môn học / Thứ / Bắt đầu / Kết thúc'
      )
    }
  }

  const seen = new Set()
  const slots = []
  for (const row of rows.slice(1)) {
    const title = normalizeCell(row[headerMap.title]).slice(0, 200)
    const weekDay = parseWeekDay(row[headerMap.weekDay])
    const startTime = parseClock(row[headerMap.startTime])
    const endTime = parseClock(row[headerMap.endTime])
    // Bỏ dòng hỏng im lặng: một dòng lỗi không được làm cả bảng điểm danh sập.
    if (!title || !weekDay || !startTime || !endTime) continue
    if (startTime >= endTime) continue
    const key = `${title}~${weekDay}~${startTime}~${endTime}`
    if (seen.has(key)) continue
    seen.add(key)
    slots.push({
      title,
      weekDay,
      startTime,
      endTime,
      room: headerMap.room !== undefined ? normalizeCell(row[headerMap.room]).slice(0, 100) || null : null,
      teacher: headerMap.teacher !== undefined ? normalizeCell(row[headerMap.teacher]).slice(0, 120) || null : null,
    })
    if (slots.length >= MAX_SLOTS) break
  }
  if (slots.length === 0) {
    throw ApiError.badRequest('Không đọc được tiết nào — kiểm tra cột Thứ/Giờ trong CSV')
  }
  return slots
}

export async function importFromCsv(req, { csv, csvUrl }) {
  assertWritable(req)
  const workspaceId = req.workspace.workspaceId
  const school = await prisma.schoolLink.findUnique({ where: { workspaceId } })
  if (!school) throw ApiError.notFound('Chưa gắn trường cho lớp — hãy đặt tên trường trước')

  let text = csv
  if (!text && csvUrl) {
    if (!isAllowedSchoolUrl(csvUrl)) {
      throw ApiError.badRequest('Link CSV phải là https:// công khai (không nhận địa chỉ nội bộ)')
    }
    text = await fetchIcs(csvUrl)
  }
  if (!text) throw ApiError.badRequest('Dán nội dung CSV hoặc link tải CSV của trường')

  const slots = parseTimetableCsv(text)
  const rows = slots.map((slot, i) => ({
    schoolLinkId: school.schoolLinkId,
    ...slot,
    colorCode: colorForIndex(i),
  }))

  const now = new Date()
  await prisma.$transaction([
    prisma.scheduleSlot.deleteMany({ where: { schoolLinkId: school.schoolLinkId } }),
    prisma.scheduleSlot.createMany({ data: rows, skipDuplicates: true }),
    prisma.schoolLink.update({
      where: { schoolLinkId: school.schoolLinkId },
      data: { lastSyncedAt: now, lastError: null },
    }),
  ])
  return { imported: rows.length }
}

// ── Nạp tiết từ extension (OneUni-style) ─────────────────────────
// Người dùng đã đăng nhập sẵn trên cổng trường; extension đọc bảng TKB
// trong tab đó rồi gửi danh sách tiết đã chuẩn hoá về đây. Không lưu mật
// khẩu trường, nên trường nào cũng dùng được miễn trang TKB là bảng HTML.
export async function importSlots(req, { schoolName, sourceUrl, slots }) {
  assertWritable(req)
  const workspaceId = req.workspace.workspaceId
  if (!Array.isArray(slots) || slots.length === 0) {
    throw ApiError.badRequest('Không có tiết nào để lưu — hãy mở đúng trang thời khoá biểu rồi thử lại')
  }
  if (slots.length > MAX_SLOTS) {
    throw ApiError.badRequest(`Quá ${MAX_SLOTS} tiết — file có thể không phải thời khoá biểu`)
  }

  const clean = []
  for (const raw of slots) {
    try {
      clean.push(validateSlotInput(raw))
    } catch {
      // Bỏ dòng không đủ thông tin thay vì làm hỏng cả lần đồng bộ
    }
    if (clean.length >= MAX_SLOTS) break
  }
  if (clean.length === 0) {
    throw ApiError.badRequest('Không đọc được tiết hợp lệ nào — kiểm tra cột Thứ/Giờ trên trang trường')
  }

  const now = new Date()
  const school = await prisma.schoolLink.upsert({
    where: { workspaceId },
    create: {
      workspaceId,
      name: (schoolName || 'Trường của lớp').trim().slice(0, 150),
      lastSyncedAt: now,
    },
    update: {
      ...(schoolName ? { name: String(schoolName).trim().slice(0, 150) } : {}),
      lastSyncedAt: now,
      lastError: null,
    },
  })

  const rows = clean.map((slot, i) => ({
    schoolLinkId: school.schoolLinkId,
    ...slot,
    colorCode: slot.colorCode || colorForIndex(i),
  }))

  await prisma.$transaction([
    prisma.scheduleSlot.deleteMany({ where: { schoolLinkId: school.schoolLinkId } }),
    prisma.scheduleSlot.createMany({ data: rows, skipDuplicates: true }),
  ])

  return {
    imported: rows.length,
    schoolName: school.name,
    sourceUrl: sourceUrl ? String(sourceUrl).slice(0, 500) : null,
  }
}

// ── Lịch hôm nay (thông báo trong web) ─────────────────────────────
// Gộp mọi Lớp của người dùng + việc đến hạn trong ngày, tính theo giờ VN.
// Không cần X-Workspace: đây là bản tin "hôm nay" nên phải thấy cả 3 chế độ.
export async function getTodayBrief(userId) {
  const now = new Date()
  const vnNow = new Date(now.getTime() + 7 * 3_600_000)
  const weekDay = vnNow.getUTCDay() === 0 ? 7 : vnNow.getUTCDay()
  const dayStartUtc = new Date(Date.UTC(vnNow.getUTCFullYear(), vnNow.getUTCMonth(), vnNow.getUTCDate()) - 7 * 3_600_000)
  const dayEndUtc = new Date(dayStartUtc.getTime() + 86_400_000)

  const memberships = await prisma.workspaceMember.findMany({
    where: { userId, workspace: { type: 'STUDENT' } },
    include: {
      workspace: {
        select: {
          workspaceId: true,
          name: true,
          schoolLink: {
            select: {
              name: true,
              slots: { where: { weekDay }, orderBy: { startTime: 'asc' } },
            },
          },
        },
      },
    },
  })

  const classes = memberships.flatMap((m) =>
    (m.workspace.schoolLink?.slots || []).map((slot) => ({
      scheduleSlotId: slot.scheduleSlotId,
      title: slot.title,
      startTime: slot.startTime,
      endTime: slot.endTime,
      room: slot.room,
      colorCode: slot.colorCode,
      className: m.workspace.name,
      schoolName: m.workspace.schoolLink?.name || null,
    }))
  )
  classes.sort((a, b) => a.startTime.localeCompare(b.startTime))

  const [tasks, overdueCount] = await Promise.all([
    prisma.task.findMany({
      where: {
        userId,
        deletedAt: null,
        status: { in: ['TODO', 'IN_PROGRESS'] },
        dueAt: { gte: dayStartUtc, lt: dayEndUtc },
      },
      orderBy: { dueAt: 'asc' },
      select: { taskId: true, title: true, dueAt: true, priority: true, status: true },
    }),
    prisma.task.count({
      where: {
        userId,
        deletedAt: null,
        status: { in: ['TODO', 'IN_PROGRESS'] },
        dueAt: { lt: dayStartUtc },
      },
    }),
  ])

  return {
    date: dayStartUtc.toISOString(),
    weekDay,
    classes,
    tasks: tasks.map((t) => ({
      id: t.taskId,
      title: t.title,
      dueAt: t.dueAt,
      priority: t.priority,
      status: t.status,
    })),
    overdueCount,
  }
}

// ── CRUD tiết học thủ công ─────────────────────────────────────────
function hisSchool(req) {
  const workspaceId = req.workspace?.workspaceId
  if (!workspaceId) throw ApiError.badRequest('Cần không gian Lớp học (STUDENT)')
  return prisma.schoolLink.findUnique({ where: { workspaceId } })
}

export async function addSlot(req, input) {
  assertWritable(req)
  const school = await hisSchool(req)
  if (!school) {
    // Chưa gắn trường? Cho phép tạo ẩn danh để nhập tay nhanh, đặt tên chung
    throw ApiError.notFound('Hãy đặt tên trường cho lớp trước (POST /student/school)')
  }
  const data = validateSlotInput(input)
  return prisma.scheduleSlot.create({
    data: {
      schoolLinkId: school.schoolLinkId,
      ...data,
      colorCode: data.colorCode || colorForIndex(school.slots ?? 0),
    },
  })
}

export async function updateSlot(req, slotId, input) {
  assertWritable(req)
  const school = await hisSchool(req)
  if (!school) throw ApiError.notFound('Lớp chưa gắn trường')
  const exists = await prisma.scheduleSlot.findFirst({ where: { scheduleSlotId: slotId, schoolLinkId: school.schoolLinkId } })
  if (!exists) throw ApiError.notFound('Không tìm thấy tiết học')
  const data = validateSlotInput({ ...exists, ...input })
  return prisma.scheduleSlot.update({ where: { scheduleSlotId: exists.scheduleSlotId }, data })
}

export async function removeSlot(req, slotId) {
  assertWritable(req)
  const school = await hisSchool(req)
  if (!school) throw ApiError.notFound('Lớp chưa gắn trường')
  const exists = await prisma.scheduleSlot.findFirst({ where: { scheduleSlotId: slotId, schoolLinkId: school.schoolLinkId } })
  if (!exists) throw ApiError.notFound('Không tìm thấy tiết học')
  await prisma.scheduleSlot.delete({ where: { scheduleSlotId: exists.scheduleSlotId } })
  return true
}

export async function clearSlots(req) {
  assertWritable(req)
  const school = await hisSchool(req)
  if (!school) throw ApiError.notFound('Lớp chưa gắn trường')
  await prisma.scheduleSlot.deleteMany({ where: { schoolLinkId: school.schoolLinkId } })
  return true
}
