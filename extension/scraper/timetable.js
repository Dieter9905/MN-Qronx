// ─── Đọc thời khoá biểu từ trang trường (dùng chung mọi trường) ────────────
// Chạy trong tab đang mở (extension đã có quyền activeTab khi người dùng bấm
// nút). KHÔNG lưu mật khẩu trường: người dùng đăng nhập sẵn trên cổng, tab
// đó đã có phiên, ta chỉ đọc bảng TKB đang hiển thị.
//
// Hai kiểu bảng phổ biến:
//  1. Lưới: cột là Thứ (T2…CN), dòng là Tiết 1…12, ô chứa môn + phòng + giờ.
//  2. Dòng: mỗi dòng một buổi học (Môn | Thứ | Bắt đầu | Kết thúc | Phòng).
// Trả về danh sách tiết đã chuẩn hoá để backend ghi thẳng vào ScheduleSlot.
;(() => {
  if (window.__mnqScrapeTimetable) return

  const WEEKDAY_NAMES = {
    '2': 1, hai: 1, t2: 1, 'thu 2': 1, monday: 1, mon: 1,
    '3': 2, ba: 2, t3: 2, 'thu 3': 2, tuesday: 2, tue: 2,
    '4': 3, tu: 3, t4: 3, 'thu 4': 3, wednesday: 3, wed: 3,
    '5': 4, nam: 4, t5: 4, 'thu 5': 4, thursday: 4, thu: 4,
    '6': 5, sau: 5, t6: 5, 'thu 6': 5, friday: 5, fri: 5,
    '7': 6, bay: 6, t7: 6, 'thu 7': 6, saturday: 6, sat: 6,
    cn: 7, 'chu nhat': 7, sunday: 7, sun: 7,
  }

  // Bỏ dấu để so khớp tiêu đề/ô: "Thứ Hai" → "thu hai", "CN" → "cn"
  const plain = (value) =>
    String(value ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/\s+/g, ' ')
      .trim()

  function weekdayOf(text) {
    const t = plain(text)
    if (!t) return null
    // Chỉ nhận ô NGẮN là tên thứ — tránh nhầm tiêu đề trang có chữ "thứ"
    const compact = t.replace(/^(thu|t)\s*/, (m) => (m === 't' ? 't' : ''))
    if (WEEKDAY_NAMES[t]) return WEEKDAY_NAMES[t]
    if (WEEKDAY_NAMES[compact]) return WEEKDAY_NAMES[compact]
    const m = t.match(/^(?:thu|t)\s*([2-7])$/)
    return m ? Number(m[1]) : null
  }

  // "07:30", "7h30", "7:30 - 9:15" → ['07:30','09:15']
  function clocksIn(text) {
    const found = []
    const re = /(\d{1,2})\s*[:h.]\s*(\d{1,2})/g
    let m
    while ((m = re.exec(text))) {
      const h = Number(m[1])
      const min = Number(m[2])
      if (h > 23 || min > 59) continue
      found.push(`${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`)
    }
    return found
  }

  // Đọc chữ trong ô TÁCH DÒNG theo <br> thay vì innerText: ô đang ẩn, tab
  // background hay table dựng bằng display:none đều làm innerText mất xuống
  // dòng, khi đó "Công nghệ phần mềm" + "07:30 - 09:15" dính thành một chuỗi
  // và tên môn bị lẫn giờ/phòng.
  function readCell(cell) {
    if (!cell) return ''
    const clone = cell.cloneNode(true)
    clone.querySelectorAll('br').forEach((br) => br.replaceWith('\n'))
    return String(clone.textContent || '')
      .replace(/\u00a0/g, ' ')
      .split('\n')
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join('\n')
  }

  function cleanTitle(text) {
    return String(text || '')
      .replace(/^(môn( học)?|mon hoc|học phần|hoc phan|subject)\s*[:\-]\s*/i, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 200)
  }

  function roomIn(text) {
    const m = String(text).match(/(?:phòng( học)?|phong|room|p\.)\s*[:\-]?\s*([A-Za-z0-9._/-]{2,20})/i)
    if (m) return m[2]
    // Mã phòng kiểu A101, B2-301, 105 — chỉ nhận khi đứng riêng một dòng/token
    const t = String(text).match(/\b([A-Z]{1,3}\d{2,4}(?:[-.]\d{1,4})?)\b/)
    return t ? t[1] : null
  }

  function teacherIn(text) {
    const m = String(text).match(/(?:giảng viên|giang vien|gv|teacher|lecturer)\s*[:\-]\s*([^\n,;]{2,60})/i)
    return m ? m[1].trim() : null
  }

  // ── Kiểu lưới: cột = thứ, dòng = tiết ────────────────────────────────
  function scrapeGrid(table) {
    const rows = [...table.querySelectorAll('tr')].map((tr) =>
      [...tr.querySelectorAll('th,td')].map(readCell)
    )
    if (rows.length < 2) return []

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
        const index = Number(indexRaw)
        const cellText = row[index]
        if (!cellText || cellText.length < 4) continue
        // Một ô có thể chứa nhiều buổi (học ghép) — tách theo dòng trống
        const segments = cellText.split(/\n{2,}/).filter((s) => s.trim().length >= 4)
        for (const segment of segments.length ? segments : [cellText]) {
          const clocks = clocksIn(segment)
          // Không có giờ cụ thể thì KHÔNG đoán bừa giờ tiết — bỏ ô đó
          if (clocks.length < 2) continue
          const lines = segment.split('\n').map((l) => l.trim()).filter(Boolean)
          const title = cleanTitle(lines.find((l) => !clocksIn(l).length && !/^(phòng|room|gv|giảng)/i.test(l)) || lines[0])
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

  // ── Kiểu dòng: mỗi dòng một buổi ─────────────────────────────────────
  function scrapeRows(table) {
    const rows = [...table.querySelectorAll('tr')].map((tr) =>
      [...tr.querySelectorAll('th,td')].map(readCell)
    )
    if (rows.length < 2) return []

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

    const pick = (...patterns) =>
      header.findIndex((c) => patterns.some((p) => new RegExp(p).test(c)))

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
        // Một cột "Thời gian" gộp: "07:30 - 09:15"
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

  function scrape() {
    const url = location.href
    const schoolName = (document.title || location.hostname).split(/[|–-]/)[0].trim().slice(0, 150)

    // Trang có link xuất .ics → để backend kéo thẳng, chính xác hơn đọc bảng
    const icsLink = [...document.querySelectorAll('a[href]')]
      .map((a) => a.href)
      .find((href) => /\.ics(\?|#|$)/i.test(href))

    const tables = [...document.querySelectorAll('table')]
    let slots = []
    for (const table of tables) {
      const grid = scrapeGrid(table)
      const found = grid.length ? grid : scrapeRows(table)
      // Chọn bảng đọc được NHIỀU tiết nhất: trang cổng trường thường có
      // nhiều bảng phụ (menu, thông báo) và chỉ một bảng là TKB thật.
      if (found.length > slots.length) slots = found
    }

    // Khử trùng + bỏ tiết trùng tên/giờ
    const seen = new Set()
    slots = slots.filter((s) => {
      const key = `${s.title}~${s.weekDay}~${s.startTime}~${s.endTime}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    let note = ''
    if (!slots.length && icsLink) {
      note = 'Trang này có link .ics — dùng nút nhập .ics ở web để lấy chính xác hơn.'
    } else if (!slots.length) {
      note =
        'Không đọc được bảng TKB. Hãy mở đúng trang thời khoá biểu (có bảng Thứ/Tiết), hoặc tải file .ics/CSV của trường và nhập ở web.'
    }

    return {
      ok: slots.length > 0,
      slots: slots.slice(0, 800),
      schoolName,
      url,
      icsUrl: icsLink || null,
      note,
    }
  }

  window.__mnqScrapeTimetable = scrape
})()
