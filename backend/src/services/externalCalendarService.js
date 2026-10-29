import prisma from '../config/prisma.js'
import ApiError from '../utils/ApiError.js'

// ─── Lịch ngoài: nhập sự kiện từ Google Calendar / Outlook (URL .ics) ──
// Bước 2 của "đồng bộ hai chiều Google Calendar": chiều app → lịch đã có sẵn
// (src/services/calendarIcsService.js — khách dán URL iCal của MN-Qronx vào
// Google Calendar). Chiều ngược lại: khách dán "Secret address in iCal format"
// của Google Calendar (hoặc link xuất .ics của Outlook/iCloud) vào đây, backend
// tự kéo sự kiện về và cache trong external_events. Đọc thôi, không có quyền
// ghi gì lên lịch nguồn, nên không cần OAuth — URL công khai đủ dùng.
//
// Lưu ý: sự kiện lặp (RRULE) được mở rộng cho các kiểu thường gặp
// (DAILY / WEEKLY ± BYDAY / MONTHLY, INTERVAL, COUNT, UNTIL) — đủ cho lịch
// họp, sinh nhật, học trên lớp; RRULE phức tạp ngoài nhóm này hiện lần đầu.

const FETCH_TIMEOUT_MS = 20_000
const MAX_ICS_BYTES = 3 * 1024 * 1024 // chặn phản hồi khổng lồ
const MAX_EVENTS_PER_CALENDAR = 2_000
// Chỉ đàm phán với nhà cung cấp lịch quen thuộc: chặn người dùng dán
// http://localhost/db-admin style URL vào service của chính mình (SSRF).
const ALLOWED_HOST_SUFFIXES = [
  'google.com',
  'googleapis.com',
  'outlook.office365.com',
  'outlook.office.com',
  'outlook.live.com',
  'outlook.com',
  'icloud.com',
  'icloud-content.com',
  'apple.com',
  'cloud.microsoft',
]
const PRIVATE_HOST_RE = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|::1|\[?fd)/i

// ─── Parse tệp ICS → danh sách sự kiện thường ──────────────────────
// Toàn bộ parser chỉ dùng chuỗi, không cần thư viện: ICS là dạng KV đơn giản.
// Trả về [{ uid, title, startsAt (Date), endsAt (Date), allDay }].
export function parseIcs(text) {
  // ICS gấp dòng dài: dòng tiếp theo bắt đầu bằng dấu cách/tab thì nối vào trước
  const lines = String(text).replace(/\r\n/g, '\n').split('\n')
  const unfolded = []
  for (const line of lines) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && unfolded.length) {
      unfolded[unfolded.length - 1] += line.slice(1)
    } else {
      unfolded.push(line)
    }
  }

  const events = []
  let ev = null
  for (const line of unfolded) {
    if (line === 'BEGIN:VEVENT') {
      ev = {}
      continue
    }
    if (line === 'END:VEVENT') {
      if (ev?.uid) {
        const start = parseIcsDateValue(ev.dtstart)
        if (start) {
          const end = parseIcsDateValue(ev.dtend) || null
          events.push({
            uid: String(ev.uid).slice(0, 255),
            title: String(ev.summary || '(Sự kiện không tên)').slice(0, 300),
            startsAt: start.at,
            endsAt: end ? end.at : new Date(start.at.getTime() + (start.allDay ? 86_400_000 : 0)),
            allDay: start.allDay,
            rrule: ev.rrule,         // bắt buộc còn nguyên cho bước mở rộng RRULE,
                                     // trước đây bị mất làm lịch lặp chỉ hiện lần 1
            exdate: ev.exdate,       // giữ lại để bước lọc RRULE dùng
            recurrenceId: ev.recurrenceId,
          })
        }
      }
      ev = null
      continue
    }
    if (!ev) continue
    const sep = line.indexOf(':')
    if (sep === -1) continue
    const head = line.slice(0, sep)
    const value = line.slice(sep + 1)
    const key = head.split(';')[0].toUpperCase()
    switch (key) {
      case 'UID': ev.uid = value; break
      case 'SUMMARY': ev.summary = unfoldQuotes(value); break
      case 'DTSTART': ev.dtstart = value; break
      case 'DTEND': ev.dtend = value; break
      case 'RRULE': ev.rrule = value; break
      case 'EXDATE': ev.exdate = value; break
      case 'RECURRENCE-ID': ev.recurrenceId = value; break
      case 'STATUS': if (/CANCELLED/i.test(value)) ev.uid = null; break // bỏ sự kiện hủy
      default: break
    }
  }
  return events
}

// "- trong Markdown" escape của ICS: \\n, \\, \\, \\; \\, → ký tự thật
function unfoldQuotes(v) {
  return v.replace(/\\n/gi, ' ').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\')
}

// Định dạng ICS: YYYYMMDD | YYYYMMDDTHHMMSS | ...Z.
// Ngày cả ngày (allDay) ghi DTSTART bằng YYYYMMDD (không kèm giờ).
// Có Z → UTC. Không có Z mà có giờ (floating, thường là với TZID của nguồn)
// → coi như giờ Việt Nam UTC+7 (múi giờ các lịch VN chọn trong Google).
function parseIcsDateValue(raw) {
  if (!raw) return null
  const v = raw.trim()
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2}))?(Z)?$/i.exec(v)
  if (!m) return null
  const [, y, mo, d, hh, mi, ss, z] = m
  const allDay = !hh
  const utcBase = Date.UTC(+y, +mo - 1, +d, allDay ? 0 : +hh, +mi || 0, +ss || 0)
  // allDay: neo đúng 00:00 UTC ngày đó; UI tự đối chiếu theo ngày dương
  const at = allDay || z ? new Date(utcBase) : new Date(utcBase - 7 * 3_600_000)
  return { at, allDay }
}

// ─── Mở rộng RRULE cho các dạng thường gặp ──────────────────────────
// Về "mốc dừng": mỗi sự kiện sinh thêm mức CẮT 400 hoặc tới SELECT horizon
// (mặc định +18 tháng), đủ cho bộ lịch học/họp hàng năm dùng 1-2 năm tới.
export function expandRrule(base, rruleStr, horizon) {
  const params = Object.fromEntries(
    String(rruleStr).split(';').map((p) => {
      const i = p.indexOf('=')
      return i === -1 ? [p, ''] : [p.slice(0, i).toUpperCase(), p.slice(i + 1)]
    })
  )
  const freq = (params.FREQ || '').toUpperCase()
  if (!['DAILY', 'WEEKLY', 'MONTHLY'].includes(freq)) return [base] // dạng lạ: giữ nguyên lần 1

  const interval = Math.max(1, parseInt(params.INTERVAL || '1', 10) || 1)
  const untilAt = params.UNTIL ? parseIcsDateValue(params.UNTIL)?.at : null
  const count = params.COUNT ? parseInt(params.COUNT, 10) : Infinity
  const endHard = horizon && untilAt ? Math.min(horizon.getTime(), untilAt.getTime()) : (untilAt ?? horizon)
  if (!endHard && count === Infinity) return [base] // không mốc: tránh sinh vô hạn

  const byDay = (params.BYDAY || '').split(',').filter(Boolean).map(dayCodeToIndex) // 0=CN
  const results = [base]
  // Sự kiện gốc là lần 1; sinh tiếp từ lần 2.
  // Đếm bằng results.length chứ không dùng biến riêng: biến `produced` trước
  // đây không được tăng ở nhánh nào và đã từng gây vòng lặp vô hạn.
  const remaining = Math.min(count, MAX_EVENTS_PER_CALENDAR)
  let current = new Date(base.startsAt)
  const step = interval * (freq === 'DAILY' ? 1 : freq === 'WEEKLY' ? 7 : 30) // ~1 tháng bằng 30 ngày

  while (results.length < remaining &&
         (!endHard || current.getTime() <= endHard.getTime()) &&
         results.length < MAX_EVENTS_PER_CALENDAR) {
    if (freq === 'DAILY') {
      current = new Date(current.getTime() + interval * 86_400_000)
      pushOccurrence()
    } else if (freq === 'WEEKLY') {
      // WEEKLY có BYDAY: sinh theo các ngày trong tuần được chọn của cùng tuần
      if (byDay.length) {
        const weekAnchor = new Date(current)
        weekAnchor.setUTCDate(weekAnchor.getUTCDate() - weekAnchor.getUTCDay()) // Chủ nhật tuần đó
        for (const dayIdx of byDay) {
          const at = new Date(weekAnchor)
          at.setUTCDate(at.getUTCDate() + dayIdx)
          // chỉ giữ chu kỳ đúng tuần lặp: đếm tuần lệch so với sự kiện gốc
          const weeksDiff = Math.round((at.getTime() - base.startsAt.getTime()) / (7 * 86_400_000))
          if (weeksDiff % interval === 0 && at.getTime() > base.startsAt.getTime()) {
            pushOccurrenceAt(at)
          }
        }
        current = new Date(weekAnchor.getTime() + 7 * interval * 86_400_000)
      } else {
        current = new Date(current.getTime() + step)
        pushOccurrence()
      }
    } else {
      // MONTHLY: nhảy theo tháng giữ nguyên ngày/giờ (BYMONTHDAY đơn giản)
      const next = new Date(current)
      next.setUTCMonth(next.getUTCMonth() + interval)
      if (next.getUTCDate() !== current.getUTCDate()) {
        // tháng thiếu ngày (vd 31/2): nhảy tới cuối tháng trước đó
        next.setUTCDate(0)
      }
      current = next
      pushOccurrence()
    }
    if (step <= 0) break // lần phòng hộ
  }
  return results

  function pushOccurrence() {
    pushOccurrenceAt(new Date(current))
  }
  function pushOccurrenceAt(at) {
    if (endHard && at.getTime() > endHard.getTime()) return
    if (results.length >= remaining) return
    const dur = base.endsAt.getTime() - base.startsAt.getTime()
    const idx = results.length
    results.push({
      ...base,
      uid: `${base.uid}#${idx + 1}`,
      startsAt: at,
      endsAt: new Date(at.getTime() + dur),
    })
  }
}

const DAY_CODES = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 }
function dayCodeToIndex(code) {
  return DAY_CODES[code?.trim().slice(-2).toUpperCase()] ?? 1 // mặc định thứ 2
}

// ─── URL an toàn ────────────────────────────────────────────────────
export function isAllowedIcsUrl(rawUrl) {
  try {
    const u = new URL(String(rawUrl))
    if (u.protocol !== 'https:') return false
    if (PRIVATE_HOST_RE.test(u.hostname)) return false
    return ALLOWED_HOST_SUFFIXES.some((s) => u.hostname === s || u.hostname.endsWith(`.${s}`))
  } catch {
    return false
  }
}

// ─── Lấy + đồng bộ ──────────────────────────────────────────────────
export async function fetchIcs(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { accept: 'text/calendar,text/plain;q=0.5,*/*;q=0.1' },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const contentType = res.headers.get('content-type') || ''
    if (contentType.includes('text/html')) {
      throw new Error('URL trả về trang web chứ không phải tệp .ics')
    }
    const buf = await res.arrayBuffer()
    return new TextDecoder('utf-8', { fatal: false }).decode(buf.slice(0, MAX_ICS_BYTES))
  } finally {
    clearTimeout(timer)
  }
}

/** Đồng bộ một lịch ngoài: xoá cache cũ, nạp-cache mới, ghi trạng thái. */
export async function syncCalendar(cal) {
  const now = new Date()
  const horizon = new Date(now.getTime() + 540 * 86_400_000) // ~18 tháng
  try {
    const text = await fetchIcs(cal.url)
    const parsed = parseIcs(text)

    // RRULE: sự kiện gốc được mở thành nhiều lần — đủ cho DAILY/ WEEKLY/ MONTHLY
    // thường gặp; RRULE phức tạp hơn thì giữ nguyên lần đầu tiên sẽ có.
    const expanded = []
    for (const e of parsed) {
      const group = e.rrule ? expandRrule(e, e.rrule, horizon) : [e]
      expanded.push(...group)
    }

    if (expanded.length === 0) {
      await prisma.externalEvent.deleteMany({ where: { calendarId: cal.externalCalendarId } })
      await prisma.externalCalendar.update({ where: { externalCalendarId: cal.externalCalendarId }, data: { lastSyncedAt: now, lastError: null } })
      return 0
    }

    const rows = expanded.slice(0, MAX_EVENTS_PER_CALENDAR).map((e, i) => ({
      calendarId: cal.externalCalendarId,
      uid: uniquifyUid(e.uid, i),
      title: e.title || '(Sự kiện không tên)',
      startsAt: e.startsAt,
      endsAt: e.endsAt,
      allDay: e.allDay,
    }))
    await prisma.$transaction([
      prisma.externalEvent.deleteMany({ where: { calendarId: cal.externalCalendarId } }),
      prisma.externalEvent.createMany({ data: rows, skipDuplicates: true }),
      prisma.externalCalendar.update({ where: { externalCalendarId: cal.externalCalendarId }, data: { lastSyncedAt: now, lastError: null } }),
    ])
    return rows.length
  } catch (err) {
    const msg = `Lỗi đồng bộ: ${err?.name === 'AbortError' ? 'quá thời gian chờ Google/Outlook' : (err.message || 'không rõ')}`.slice(0, 290)
    await prisma.externalCalendar.update({ where: { externalCalendarId: cal.externalCalendarId }, data: { lastError: msg } }).catch(() => {})
    throw new Error(msg)
  }
}

// uid trùng trong cùng tệp (xảy ra khi RRULE + override được nguồn xuất song song)
function uniquifyUid(uid, index) {
  const s = String(uid).slice(0, 245)
  return index === 0 ? s : `${s}~${index}`
}

/** Đồng bộ toàn bộ lịch ngoài đang bật — chạy qua cron mỗi giờ. */
export async function syncAllExternalCalendars() {
  const calendars = await prisma.externalCalendar.findMany({ where: { isActive: true } })
  let ok = 0
  let fail = 0
  for (const cal of calendars) {
    try {
      await syncCalendar(cal)
      ok += 1
    } catch {
      fail += 1
    }
  }
  return { ok, fail, total: calendars.length }
}

// ─── Truy vấn đọc cho UI ────────────────────────────────────────────
export async function listByUser(userId) {
  return prisma.externalCalendar.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { events: true } } },
  })
}

export async function findById(userId, calendarId) {
  return prisma.externalCalendar.findFirst({ where: { externalCalendarId: calendarId, userId } })
}

export async function create(userId, { url, name, color }) {
  if (!isAllowedIcsUrl(url)) {
    throw new Error('URL lịch không hợp lệ — chỉ nhận https:// của Google Calendar, Outlook hoặc iCloud Calendar')
  }
  // Chặn trùng URL: cho phép cùng một lịch 2 lần sẽ nhân đôi toàn bộ sự kiện trên lưới
  const dup = await prisma.externalCalendar.findFirst({ where: { userId, url: String(url).slice(0, 1000) } })
  if (dup) {
    throw ApiError.badRequest('Lịch này đã có trong danh sách rồi — không cần thêm lại')
  }
  const cal = await prisma.externalCalendar.create({
    data: {
      userId,
      url: String(url).slice(0, 1000),
      name: (name || 'Lịch ngoài').slice(0, 120),
      color: /^#[0-9a-f]{6}$/i.test(color || '') ? color : '#7c8cff',
    },
  })
  try {
    await syncCalendar(cal)
  } catch (err) {
    // thêm xong nhưng fetch đầu chưa được: vẫn giữ lịch cho khách sửa/kéo lại,
    // trả lời lỗi để UI cho biết nguyên nhân rõ.
    const created = await findById(userId, cal.externalCalendarId)
    created.syncError = err?.message || 'Đồng bộ đầu chưa thành công — sẽ thử lại trong 1 giờ'
    return created
  }
  return findById(userId, cal.externalCalendarId)
}

export async function updateCalendar(userId, calendarId, { name, isActive }) {
  const cal = await findById(userId, calendarId)
  if (!cal) return null
  await prisma.externalCalendar.update({
    where: { externalCalendarId: calendarId },
    data: {
      ...(name !== undefined && name !== null ? { name: String(name).slice(0, 120) } : {}),
      ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
    },
  })
  return findById(userId, calendarId)
}

export async function removeCalendar(userId, calendarId) {
  const cal = await findById(userId, calendarId)
  if (!cal) return false
  await prisma.externalCalendar.delete({ where: { externalCalendarId: calendarId } })
  return true
}

/** Sự kiện của mọi lịch ngoài đang bật trong khoảng thời gian — cho trang Lịch. */
export async function eventsInRange(userId, { from, to }) {
  const calendars = await prisma.externalCalendar.findMany({
    where: { userId, isActive: true },
    select: { externalCalendarId: true, name: true, color: true },
  })
  if (calendars.length === 0) return []
  const events = await prisma.externalEvent.findMany({
    where: {
      calendar: { userId, isActive: true },
      endsAt: { gte: from },
      startsAt: { lte: to },
    },
    orderBy: { startsAt: 'asc' },
    take: 1_000,
    select: {
      externalEventId: true,
      title: true,
      startsAt: true,
      endsAt: true,
      allDay: true,
      calendar: { select: { name: true, color: true } },
    },
  })
  return events
}
