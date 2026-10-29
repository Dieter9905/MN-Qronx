// ─── Đọc thời khoá biểu từ HTML (dùng cho trường chưa có connector riêng) ───
// Cổng trường nào cũng hiển thị TKB bằng bảng: cột là Thứ (T2…CN) và dòng là
// Tiết, hoặc mỗi dòng một buổi học. Bộ đọc này chạy trên SERVER nên không phụ
// thuộc trình duyệt; extension chỉ cần gửi cookie phiên + URL trang TKB.
//
// Không bao giờ đoán giờ: ô nào không có giờ cụ thể ("07:30 - 09:15") thì bỏ,
// vì lịch sai giờ còn tệ hơn lịch thiếu.

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

function decodeEntities(text) {
  return String(text).replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, code) => {
    const key = String(code).toLowerCase()
    if (key.startsWith('#x')) {
      const n = parseInt(key.slice(2), 16)
      return Number.isFinite(n) ? String.fromCodePoint(n) : m
    }
    if (key.startsWith('#')) {
      const n = parseInt(key.slice(1), 10)
      return Number.isFinite(n) ? String.fromCodePoint(n) : m
    }
    return ENTITIES[key] ?? m
  })
}

// Ô HTML → chuỗi nhiều dòng (br thành xuống dòng, bỏ thẻ, gộp khoảng trắng)
function cellText(html) {
  return decodeEntities(
    String(html || '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li)>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/\u00a0/g, ' ')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
}

const plain = (value) =>
  String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim()

const WEEKDAY_NAMES = {
  '2': 1, hai: 1, t2: 1, 'thu 2': 1, monday: 1, mon: 1,
  '3': 2, ba: 2, t3: 2, 'thu 3': 2, tuesday: 2, tue: 2,
  '4': 3, tu: 3, t4: 3, 'thu 4': 3, wednesday: 3, wed: 3,
  '5': 4, nam: 4, t5: 4, 'thu 5': 4, thursday: 4, thu: 4,
  '6': 5, sau: 5, t6: 5, 'thu 6': 5, friday: 5, fri: 5,
  '7': 6, bay: 6, t7: 6, 'thu 7': 6, saturday: 6, sat: 6,
  cn: 7, 'chu nhat': 7, sunday: 7, sun: 7,
}

function weekdayOf(text) {
  const t = plain(text)
  if (!t || t.length > 24) return null
  if (WEEKDAY_NAMES[t]) return WEEKDAY_NAMES[t]
  const compact = t.replace(/^(thu|t)\s*/, (m) => (m === 't' ? 't' : ''))
  if (WEEKDAY_NAMES[compact]) return WEEKDAY_NAMES[compact]
  const m = t.match(/^(?:thu|t)\s*([2-7])$/)
  return m ? Number(m[1]) : null
}

function clocksIn(text) {
  const found = []
  const re = /(\d{1,2})\s*[:h.]\s*(\d{1,2})/g
  let m
  while ((m = re.exec(String(text)))) {
    const h = Number(m[1])
    const min = Number(m[2])
    if (h > 23 || min > 59) continue
    found.push(`${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`)
  }
  return found
}

const cleanTitle = (text) =>
  String(text || '')
    .replace(/^(môn( học)?|mon hoc|học phần|hoc phan|subject)\s*[:\-]\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200)

function roomIn(text) {
  const m = String(text).match(/(?:phòng( học)?|phong|room|p\.)\s*[:\-]?\s*([A-Za-z0-9._/-]{2,20})/i)
  if (m) return m[2]
  const t = String(text).match(/\b([A-Z]{1,3}\d{2,4}(?:[-.]\d{1,4})?)\b/)
  return t ? t[1] : null
}

function teacherIn(text) {
  const m = String(text).match(/(?:giảng viên|giang vien|gv|teacher|lecturer)\s*[:\-]\s*([^\n,;]{2,60})/i)
  return m ? m[1].trim().slice(0, 120) : null
}

/** Tách bảng HTML thành mảng 2 chiều [dòng][ô] (mỗi ô là text nhiều dòng). */
function readTables(html) {
  const tables = []
  const tableRe = /<table[\s\S]*?<\/table>/gi
  let tableMatch
  while ((tableMatch = tableRe.exec(html))) {
    const rows = []
    const rowRe = /<tr[\s\S]*?<\/tr>/gi
    let rowMatch
    while ((rowMatch = rowRe.exec(tableMatch[0]))) {
      const cells = []
      const cellRe = /<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi
      let cellMatch
      while ((cellMatch = cellRe.exec(rowMatch[0]))) cells.push(cellText(cellMatch[1]))
      if (cells.length) rows.push(cells)
    }
    if (rows.length >= 2) tables.push(rows)
  }
  return tables
}

function scrapeGrid(rows) {
  let headerIndex = -1
  let columnDays = {}
  for (let i = 0; i < Math.min(rows.length, 4); i += 1) {
    const map = {}
    let hits = 0
    rows[i].forEach((cell, index) => {
      const day = weekdayOf(cell)
      if (day) {
        map[index] = day
        hits += 1
      }
    })
    if (hits >= 5) {
      headerIndex = i
      columnDays = map
      break
    }
  }
  if (headerIndex < 0) return []

  const slots = []
  for (const row of rows.slice(headerIndex + 1)) {
    for (const [indexRaw, day] of Object.entries(columnDays)) {
      const text = row[Number(indexRaw)]
      if (!text || text.length < 4) continue
      const segments = text.split(/\n{2,}/).filter((s) => s.trim().length >= 4)
      for (const segment of segments.length ? segments : [text]) {
        const clocks = clocksIn(segment)
        if (clocks.length < 2) continue
        const lines = segment.split('\n').map((l) => l.trim()).filter(Boolean)
        const title = cleanTitle(
          lines.find((l) => !clocksIn(l).length && !/^(phòng|room|gv|giảng)/i.test(l)) || lines[0]
        )
        if (!title || title.length < 3) continue
        slots.push({
          title,
          weekDay: day,
          startTime: clocks[0],
          endTime: clocks[1],
          room: roomIn(segment),
          teacher: teacherIn(segment),
        })
      }
    }
  }
  return slots
}

function scrapeRows(rows) {
  let header = null
  let headerRow = -1
  for (let i = 0; i < Math.min(rows.length, 4); i += 1) {
    const cells = rows[i].map(plain)
    const hasTitle = cells.some((c) => /^(mon|mon hoc|ten mon|hoc phan|subject|title|noi dung)/.test(c))
    const hasDay = cells.some((c) => /^(thu|thu trong tuan|weekday|day)/.test(c))
    if (hasTitle && hasDay) {
      header = cells
      headerRow = i
      break
    }
  }
  if (!header) return []

  const pick = (...patterns) => header.findIndex((c) => patterns.some((p) => new RegExp(p).test(c)))

  const titleCol = pick('^(mon|mon hoc|ten mon|hoc phan|subject|title|noi dung)')
  const dayCol = pick('^(thu|thu trong tuan|weekday|day)')
  const startCol = pick('bat dau|gio bat dau|^tu$|start')
  const endCol = pick('ket thuc|gio ket thuc|^den$|end')
  const roomCol = pick('phong|room|dia diem')
  const teacherCol = pick('giao vien|giang vien|teacher|lecturer')

  const slots = []
  for (const row of rows.slice(headerRow + 1)) {
    const day = weekdayOf(row[dayCol])
    const title = cleanTitle(row[titleCol])
    if (!day || !title || title.length < 3) continue
    let start = startCol >= 0 ? clocksIn(row[startCol])[0] : null
    let end = endCol >= 0 ? clocksIn(row[endCol])[0] : null
    if (!start || !end) {
      const merged = clocksIn(row.join(' '))
      start = start || merged[0]
      end = end || merged[1]
    }
    if (!start || !end || start >= end) continue
    slots.push({
      title,
      weekDay: day,
      startTime: start,
      endTime: end,
      room: roomCol >= 0 ? String(row[roomCol] || '').trim().slice(0, 100) || null : null,
      teacher: teacherCol >= 0 ? String(row[teacherCol] || '').trim().slice(0, 120) || null : null,
    })
  }
  return slots
}

/** HTML trang TKB → danh sách tiết (đã khử trùng). */
export function parseTimetableHtml(html) {
  const tables = readTables(String(html || ''))
  let best = []
  for (const rows of tables) {
    const grid = scrapeGrid(rows)
    const found = grid.length ? grid : scrapeRows(rows)
    if (found.length > best.length) best = found
  }
  const seen = new Set()
  return best.filter((s) => {
    const key = `${s.title}~${s.weekDay}~${s.startTime}~${s.endTime}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export default { parseTimetableHtml }
