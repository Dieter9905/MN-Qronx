import config from '../config/index.js'
import prisma from '../config/prisma.js'
import ApiError from '../utils/ApiError.js'
import { PLANS, isPlanExpired } from '../utils/planLimits.js'
import { addDays, startOfDay, endOfDay } from '../utils/dateUtils.js'

/**
 * Báo cáo năng suất (gói Pro).
 *
 * Vì sao có file này: trước đây gói Pro chỉ "nới trần" (không giới hạn việc,
 * nhiều thiết bị) — thứ người dùng chưa chắc đã chạm tới, nên cảm giác không
 * đáng tiền. Báo cáo là thứ họ NHÌN THẤY giá trị mỗi tuần: mình xong bao nhiêu
 * việc, có đúng hạn không, giờ nào làm tốt nhất, việc nào đang bị bỏ quên lâu
 * nhất — và mang được ra ngoài (Excel/PDF) để báo cáo với cấp trên hoặc tự nhìn
 * lại. Đây là lý do trả tiền song song với "nhắc dai" (nagService.js).
 *
 * Nguyên tắc số liệu:
 *   • Mọi truy vấn đều lọc deletedAt = null (việc trong thùng rác không được
 *     tính vào thành tích — nếu không, "xong 20 việc" có thể là việc đã xoá).
 *   • Ngày/giờ tính theo múi giờ Việt Nam, không theo giờ server (Render chạy UTC,
 *     lệch 7 giờ — cùng lý do đã ghi ở dateUtils.startOfDay).
 *   • "Đúng hạn" = completedAt <= dueAt. Việc xong muộn vẫn được tính là xong,
 *     chỉ không tính là đúng hạn.
 *   • Chỉ trả số liệu của CHÍNH người dùng (lọc userId ở mọi query).
 */

/** Các khoảng thời gian cho phép xem báo cáo (số ngày, tính cả hôm nay). */
export const REPORT_DAYS = [7, 30, 90]

/** Trần số dòng xuất ra file — báo cáo là để đọc, không phải để dump cả DB. */
export const REPORT_EXPORT_ROW_LIMIT = 2000

const WEEKDAY_LABELS = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7']

const PRIORITY_LABELS = {
  URGENT: 'Khẩn cấp',
  HIGH: 'Cao',
  MEDIUM: 'Trung bình',
  LOW: 'Thấp',
}

// Múi giờ dùng chung với phần đếm hạn mức AI / mã đơn (billingService.vnDateKey).
const TZ = config.mail?.quotaTimezone || 'Asia/Ho_Chi_Minh'

// Định dạng sẵn một lần: báo cáo phải quét hàng nghìn dòng completedAt, dựng
// Intl.DateTimeFormat cho từng dòng sẽ chậm vô ích.
const dayKeyFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})
const hourFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  hour: '2-digit',
  hourCycle: 'h23',
})
const stampFormatter = new Intl.DateTimeFormat('vi-VN', {
  timeZone: TZ,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/** Khoá ngày "YYYY-MM-DD" theo giờ Việt Nam của một thời điểm. */
function dayKey(date) {
  return dayKeyFormatter.format(date)
}

/** Giờ trong ngày (0–23) theo giờ Việt Nam. */
function hourOf(date) {
  return Number(hourFormatter.format(date)) % 24
}

/** Chuỗi ngày giờ dễ đọc cho file Excel: "27/09/2026 14:35". */
function stamp(date) {
  return stampFormatter.format(date)
}

/** Nhãn ngắn cho biểu đồ theo ngày: "27/09". */
function shortLabel(key) {
  const [, month, day] = key.split('-')
  return `${day}/${month}`
}

/** Ngày trong tuần của khoá ngày "YYYY-MM-DD" (0 = Chủ nhật). */
function weekdayOf(key) {
  return new Date(`${key}T00:00:00Z`).getUTCDay()
}

/**
 * Chuẩn hoá tham số `days` người dùng gửi lên.
 * Sai giá trị thì báo lỗi rõ ràng thay vì im lặng dùng mặc định — người dùng sẽ
 * tưởng báo cáo tính đúng trong khi nó đang tính khoảng khác.
 */
export function parseReportDays(value) {
  if (value === undefined || value === null || value === '') return 30
  const days = Number(value)
  if (!REPORT_DAYS.includes(days)) {
    throw ApiError.badRequest(
      `Khoảng thời gian báo cáo không hợp lệ. Chọn một trong: ${REPORT_DAYS.join(', ')} ngày.`
    )
  }
  return days
}

/**
 * Gói hiệu lực của user (gói trả phí hết hạn tính như FREE ngay, không chờ cron).
 * @returns {Promise<{userId:number, plan:string}>}
 */
async function effectiveUser(userId) {
  const user = await prisma.user.findUnique({
    where: { userId },
    select: { userId: true, plan: true, planExpiresAt: true, fullName: true },
  })
  if (!user) throw ApiError.notFound('Không tìm thấy người dùng')
  return { ...user, plan: isPlanExpired(user) ? 'FREE' : user.plan }
}

/**
 * Chặn xem báo cáo nếu gói không có quyền. Nói thẳng tên gói và lợi ích để
 * người dùng biết mình đang thiếu gì (im lặng trả trang trống là mất khách).
 */
export function assertReportsAllowed(plan) {
  if (!PLANS[plan]?.reports) {
    throw ApiError.badRequest(
      'Báo cáo năng suất và xuất Excel/PDF là tính năng của gói Pro. Nâng cấp để biết mình đang làm tốt ở đâu và đang bỏ quên việc gì.'
    )
  }
}

function round1(value) {
  return Math.round(value * 10) / 10
}

/**
 * Dựng toàn bộ số liệu báo cáo của một người dùng.
 *
 * @param {number} userId
 * @param {{ days?: number, now?: Date }} options
 * @returns {Promise<object>} Xem cấu trúc ở cuối hàm.
 */
export async function buildReport(userId, { days = 30, now = new Date() } = {}) {
  const user = await effectiveUser(userId)
  assertReportsAllowed(user.plan)

  const to = endOfDay(now)
  const from = startOfDay(addDays(now, -(days - 1)))
  // Kỳ trước liền kề, cùng độ dài — để trả lời câu hỏi "tuần này có khá hơn không?"
  const prevFrom = startOfDay(addDays(now, -(days * 2 - 1)))
  const prevTo = new Date(from.getTime() - 1)

  const scope = { userId, deletedAt: null }

  const [
    completedRows,
    completedPrev,
    createdRows,
    dueInRange,
    openNow,
    overdueOpen,
    nagRows,
    worstOverdueRaw,
  ] = await Promise.all([
    // 1. Việc xong trong kỳ (cột nhẹ — còn phải quét để chia theo ngày/giờ)
    prisma.task.findMany({
      where: { ...scope, status: 'COMPLETED', completedAt: { gte: from, lte: to } },
      select: { taskId: true, completedAt: true, dueAt: true, priority: true, categoryId: true },
      orderBy: { completedAt: 'asc' },
    }),
    // 2. Việc xong kỳ trước (chỉ cần số lượng)
    prisma.task.count({
      where: { ...scope, status: 'COMPLETED', completedAt: { gte: prevFrom, lte: prevTo } },
    }),
    // 3. Việc tạo mới trong kỳ (để thấy "tạo vào" so với "làm xong")
    prisma.task.findMany({
      where: { ...scope, createdAt: { gte: from, lte: to } },
      select: { createdAt: true },
    }),
    // 4. Khối lượng đến hạn trong kỳ
    prisma.task.count({ where: { ...scope, dueAt: { gte: from, lte: to } } }),
    // 5. Việc còn mở
    prisma.task.count({ where: { ...scope, status: { in: ['TODO', 'IN_PROGRESS'] } } }),
    // 6. Việc quá hạn chưa xong
    prisma.task.count({
      where: { ...scope, status: { in: ['TODO', 'IN_PROGRESS'] }, dueAt: { lt: now } },
    }),
    // 7. Nhắc dai đã kêu lại cho những việc xong trong kỳ → "nhắc dai đã cứu được gì"
    prisma.reminder.findMany({
      where: {
        nagCount: { gt: 0 },
        task: { userId, deletedAt: null, status: 'COMPLETED', completedAt: { gte: from, lte: to } },
      },
      select: { taskId: true, nagCount: true },
    }),
    // 8. Việc tồn đọng lâu nhất — danh sách hành động được, không chỉ con số
    prisma.task.findMany({
      where: { ...scope, status: { in: ['TODO', 'IN_PROGRESS'] }, dueAt: { lt: now } },
      select: {
        taskId: true,
        title: true,
        dueAt: true,
        priority: true,
        nagEveryMinutes: true,
        category: { select: { categoryName: true } },
      },
      orderBy: { dueAt: 'asc' },
      take: 5,
    }),
  ])

  const completed = completedRows.length

  // ── Chia việc xong theo ngày / thứ / giờ (giờ Việt Nam) ──
  const dayKeys = []
  for (let i = 0; i < days; i += 1) {
    dayKeys.push(dayKey(addDays(from, i)))
  }
  const todayKey = dayKey(now)

  const completedByDay = new Map(dayKeys.map((k) => [k, 0]))
  const createdByDay = new Map(dayKeys.map((k) => [k, 0]))
  const completedByWeekday = new Array(7).fill(0)
  const completedByHour = new Array(24).fill(0)

  let onTime = 0
  let late = 0
  let totalHoursBeforeDue = 0
  const completedByCategory = new Map()

  completedRows.forEach((t) => {
    const finishedAt = new Date(t.completedAt)
    const key = dayKey(finishedAt)
    if (completedByDay.has(key)) completedByDay.set(key, completedByDay.get(key) + 1)
    completedByWeekday[weekdayOf(key)] += 1
    completedByHour[hourOf(finishedAt)] += 1

    // Đúng hạn: xong trước hoặc đúng mốc dueAt
    const hoursBefore = (new Date(t.dueAt) - finishedAt) / 3600000
    totalHoursBeforeDue += hoursBefore
    if (hoursBefore >= 0) onTime += 1
    else late += 1

    if (t.categoryId) {
      completedByCategory.set(t.categoryId, (completedByCategory.get(t.categoryId) || 0) + 1)
    }
  })

  createdRows.forEach((t) => {
    const key = dayKey(new Date(t.createdAt))
    if (createdByDay.has(key)) createdByDay.set(key, createdByDay.get(key) + 1)
  })

  // ── Chuỗi ngày có việc xong (streak) ──
  // `current` đứt nếu hôm nay chưa xong gì — nhưng hôm nay còn đang diễn ra, nên
  // vẫn tính chuỗi tới hôm qua; chỉ khi cả hôm qua cũng trống mới coi là đứt.
  let streakBest = 0
  let run = 0
  dayKeys.forEach((key) => {
    if (completedByDay.get(key) > 0) {
      run += 1
      streakBest = Math.max(streakBest, run)
    } else {
      run = 0
    }
  })
  let streakCurrent = 0
  for (let i = dayKeys.length - 1; i >= 0; i -= 1) {
    const key = dayKeys[i]
    if (completedByDay.get(key) > 0) {
      streakCurrent += 1
    } else if (key === todayKey && streakCurrent === 0) {
      // Hôm nay chưa xong việc nào → bỏ qua, chuỗi vẫn tính từ hôm qua
      continue
    } else {
      break
    }
  }

  // ── Danh mục ──
  const categoryIds = [...completedByCategory.keys()]
  const categories = categoryIds.length
    ? await prisma.category.findMany({
        where: { categoryId: { in: categoryIds } },
        select: { categoryId: true, categoryName: true, colorCode: true },
      })
    : []
  const categoryMap = new Map(categories.map((c) => [c.categoryId, c]))
  const topCategories = [...completedByCategory.entries()]
    .map(([categoryId, count]) => ({
      categoryId,
      name: categoryMap.get(categoryId)?.categoryName || 'Không có danh mục',
      color: categoryMap.get(categoryId)?.colorCode || null,
      completed: count,
      share: completed ? Math.round((count / completed) * 100) : 0,
    }))
    .sort((a, b) => b.completed - a.completed)
    .slice(0, 6)

  // ── Ưu tiên ──
  const priorityCount = new Map()
  completedRows.forEach((t) => {
    priorityCount.set(t.priority, (priorityCount.get(t.priority) || 0) + 1)
  })
  const priorities = ['URGENT', 'HIGH', 'MEDIUM', 'LOW']
    .filter((p) => priorityCount.get(p))
    .map((p) => ({ priority: p, label: PRIORITY_LABELS[p], completed: priorityCount.get(p) }))

  // ── Nhắc dai ──
  const nagTaskIds = new Set(nagRows.map((r) => r.taskId))
  const nagRepeats = nagRows.reduce((sum, r) => sum + (r.nagCount || 0), 0)

  // ── Giờ vàng: giờ có nhiều việc xong nhất ──
  let goldenHour = null
  let goldenCount = 0
  completedByHour.forEach((count, hour) => {
    if (count > goldenCount) {
      goldenCount = count
      goldenHour = hour
    }
  })

  const daily = dayKeys.map((key) => ({
    date: key,
    label: shortLabel(key),
    completed: completedByDay.get(key) || 0,
    created: createdByDay.get(key) || 0,
  }))

  const hours = completedByHour.map((count, hour) => ({ hour, completed: count }))

  const weekday = WEEKDAY_LABELS.map((label, index) => ({
    weekday: index,
    label,
    completed: completedByWeekday[index],
  }))

  const onTimeRate = completed ? Math.round((onTime / completed) * 100) : 0
  const avgHoursBeforeDue = completed ? round1(totalHoursBeforeDue / completed) : null
  const worstOverdue = worstOverdueRaw.map((t) => ({
    taskId: t.taskId,
    title: t.title,
    dueAt: t.dueAt,
    daysLate: Math.max(0, Math.floor((now - new Date(t.dueAt)) / 86400000)),
    priority: t.priority,
    nagEveryMinutes: t.nagEveryMinutes ?? null,
    categoryName: t.category?.categoryName || null,
  }))

  const periodLabel = days === 7 ? 'tuần qua' : `${days} ngày qua`

  return {
    plan: user.plan,
    generatedAt: now,
    range: { days, from: dayKeys[0], to: todayKey, fromISO: from, toISO: to },
    totals: {
      completed,
      completedPrev,
      completedDelta: completed - completedPrev,
      created: createdRows.length,
      dueInRange,
      openNow,
      overdueOpen,
      onTime,
      late,
      onTimeRate,
      avgHoursBeforeDue,
      nagSaved: nagTaskIds.size,
      nagRepeats,
      streakCurrent,
      streakBest,
      goldenHour,
      goldenCount,
      periodLabel,
    },
    daily,
    weekday,
    hours,
    categories: topCategories,
    priorities,
    worstOverdue,
    insight: buildInsight({
      completed,
      completedDelta: completed - completedPrev,
      onTimeRate,
      days,
      periodLabel,
      goldenHour,
      goldenCount,
      nagSaved: nagTaskIds.size,
      worstOverdue,
      overdueOpen,
    }),
  }
}

/**
 * Một câu tóm tắt bằng tiếng Việt — thứ người dùng thật sự đọc, thay vì tự ghép
 * nghĩa từ một rổ số. Kể cả khi chưa có dữ liệu cũng phải nói điều gì đó hữu ích.
 */
function buildInsight({
  completed,
  completedDelta,
  onTimeRate,
  days,
  periodLabel,
  goldenHour,
  goldenCount,
  nagSaved,
  worstOverdue,
  overdueOpen,
}) {
  if (completed === 0) {
    if (overdueOpen > 0) {
      return `Chưa có việc nào được đánh dấu xong trong ${periodLabel}, nhưng đang có ${overdueOpen} việc quá hạn. Mở danh sách quá hạn và xử lý việc cũ nhất trước.`
    }
    return `Chưa có việc nào được đánh dấu xong trong ${periodLabel}. Đánh dấu Xong vài việc nhỏ hôm nay để bắt đầu có số liệu nhé.`
  }

  const parts = [`Trong ${periodLabel} bạn đã hoàn thành ${completed} việc`]
  if (completedDelta > 0) parts.push(`, nhiều hơn kỳ trước ${completedDelta} việc`)
  else if (completedDelta < 0) parts.push(`, ít hơn kỳ trước ${Math.abs(completedDelta)} việc`)
  else parts.push(', ngang bằng kỳ trước')
  parts.push(`. Tỉ lệ xong đúng hạn là ${onTimeRate}%`)

  if (goldenHour !== null && goldenCount >= 2) {
    parts.push(`, và bạn làm việc hiệu quả nhất vào khoảng ${goldenHour}h`)
  }
  parts.push('.')

  if (nagSaved > 0) {
    parts.push(` Nhắc dai đã kéo bạn quay lại ${nagSaved} việc đáng lẽ bị bỏ quên.`)
  }
  if (worstOverdue.length) {
    parts.push(
      ` Việc “${worstOverdue[0].title}” đã quá hạn ${worstOverdue[0].daysLate} ngày — nên xử lý hoặc dời hạn.`
    )
  }
  return parts.join('')
}

// ─── Xuất file cho Excel ────────────────────────────────────
// Chọn CSV thay vì .xlsx để không phải thêm thư viện nặng vào backend và không
// phải sinh file nhị phân trên web service gói free. File CSV mở thẳng bằng
// Excel/Google Sheets/WPS.
//
// Hai chi tiết bắt buộc cho người dùng Việt Nam:
//   1. BOM UTF-8 ở đầu file — thiếu BOM là tiếng Việt thành ký tự lạ trong Excel.
//   2. Dấu ";" làm dấu phân cách kèm dòng `sep=;` — Excel bản Việt dùng "," làm
//      dấu thập phân nên CSV phân cách bằng "," sẽ dồn hết vào một cột.

function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value)
  if (/[";\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

function csvRow(cells) {
  return cells.map(csvCell).join(';')
}

/** Số thập phân kiểu Việt Nam (dấu phẩy) để Excel hiểu là số, không phải chữ. */
function vnNumber(value, digits = 1) {
  if (value === null || value === undefined) return ''
  return Number(value).toFixed(digits).replace('.', ',')
}

/**
 * Xuất báo cáo thành nội dung CSV (kèm phần tóm tắt ở đầu file, rồi bảng chi
 * tiết từng việc đã xong).
 *
 * @returns {Promise<{filename: string, content: string, rows: number, truncated: boolean}>}
 */
export async function exportReportCsv(userId, { days = 30, now = new Date() } = {}) {
  const report = await buildReport(userId, { days, now })

  const rows = await prisma.task.findMany({
    where: {
      userId,
      deletedAt: null,
      status: 'COMPLETED',
      completedAt: { gte: report.range.fromISO, lte: report.range.toISO },
    },
    select: {
      title: true,
      completedAt: true,
      dueAt: true,
      priority: true,
      category: { select: { categoryName: true } },
      reminders: { select: { nagCount: true } },
    },
    orderBy: { completedAt: 'asc' },
    take: REPORT_EXPORT_ROW_LIMIT,
  })

  const t = report.totals
  const lines = [
    csvRow(['Báo cáo năng suất MN-Qronx']),
    csvRow(['Khoảng thời gian', `${report.range.from} → ${report.range.to} (${days} ngày)`]),
    csvRow(['Xuất lúc', stamp(now)]),
    '',
    csvRow(['Tổng quan']),
    csvRow(['Việc đã hoàn thành', t.completed]),
    csvRow(['Kỳ trước', t.completedPrev]),
    csvRow(['Chênh lệch', t.completedDelta]),
    csvRow(['Việc tạo mới trong kỳ', t.created]),
    csvRow(['Xong đúng hạn', t.onTime]),
    csvRow(['Xong muộn', t.late]),
    csvRow(['Tỉ lệ đúng hạn (%)', t.onTimeRate]),
    csvRow([
      'Trung bình xong trước hạn (giờ)',
      t.avgHoursBeforeDue === null ? '' : vnNumber(t.avgHoursBeforeDue),
    ]),
    csvRow(['Việc quá hạn chưa xong', t.overdueOpen]),
    csvRow(['Chuỗi ngày có việc xong', t.streakCurrent]),
    csvRow(['Việc được nhắc dai cứu', t.nagSaved]),
    csvRow(['Số lần nhắc lại', t.nagRepeats]),
    '',
    csvRow(['Nhận xét', report.insight]),
    '',
    csvRow(['Danh mục', 'Việc đã xong', 'Tỉ lệ (%)']),
  ]

  report.categories.forEach((c) => {
    lines.push(csvRow([c.name, c.completed, c.share]))
  })

  lines.push('', csvRow(['Việc còn quá hạn', 'Quá hạn (ngày)', 'Ưu tiên', 'Hạn']))
  report.worstOverdue.forEach((w) => {
    lines.push(csvRow([w.title, w.daysLate, PRIORITY_LABELS[w.priority] || w.priority, stamp(w.dueAt)]))
  })

  lines.push(
    '',
    csvRow([
      'Ngày hoàn thành',
      'Công việc',
      'Danh mục',
      'Ưu tiên',
      'Hạn',
      'Xong trước hạn (giờ)',
      'Số lần nhắc dai',
    ])
  )

  rows.forEach((r) => {
    const hoursBefore = (new Date(r.dueAt) - new Date(r.completedAt)) / 3600000
    const nagCount = r.reminders.reduce((sum, rem) => sum + (rem.nagCount || 0), 0)
    lines.push(
      csvRow([
        stamp(r.completedAt),
        r.title,
        r.category?.categoryName || '',
        PRIORITY_LABELS[r.priority] || r.priority,
        stamp(r.dueAt),
        vnNumber(hoursBefore),
        nagCount,
      ])
    )
  })

  const fromKey = report.range.from.replace(/-/g, '')
  const toKey = report.range.to.replace(/-/g, '')

  return {
    filename: `bao-cao-mn-qronx-${fromKey}-${toKey}.csv`,
    // "sep=;" giúp Excel bản Việt nhận đúng cột; BOM giữ được dấu tiếng Việt.
    content: `\uFEFFsep=;\n${lines.join('\r\n')}\r\n`,
    rows: rows.length,
    truncated: rows.length >= REPORT_EXPORT_ROW_LIMIT,
  }
}

export default {
  REPORT_DAYS,
  REPORT_EXPORT_ROW_LIMIT,
  parseReportDays,
  assertReportsAllowed,
  buildReport,
  exportReportCsv,
}
