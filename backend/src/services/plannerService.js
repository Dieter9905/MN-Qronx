import config from '../config/index.js'
import prisma from '../config/prisma.js'
import ApiError from '../utils/ApiError.js'
import { PLANS, isPlanExpired } from '../utils/planLimits.js'
import { startOfDay, endOfDay, addDays } from '../utils/dateUtils.js'

/**
 * Kế hoạch tuần (gói Pro).
 *
 * Vì sao có file này: gói Pro bán ý tưởng "không để bạn quên việc quan trọng",
 * nhưng danh sách công việc chỉ là một đống việc — khách vẫn phải tự quyết định
 * hôm nay làm gì. Trang này trả lời câu đó: trong 7 ngày tới, ngày nào làm việc
 * nào, việc gì đang quá hạn, và quan trọng nhất — **nói thật khi tuần bị quá tải**
 * ("bạn có 23 việc nhưng chỉ đủ chỗ cho 15, 8 việc sẽ trễ").
 *
 * Xếp bằng LUẬT, không gọi AI: dịch vụ AI của MN-Qronx (thư mục `ai/`) là model
 * phân tích câu thành công việc, không phải LLM biết lập kế hoạch. Luật thì chạy
 * ngay, không tốn lượt, và không bao giờ bịa ra công việc không có thật — điều
 * tối quan trọng với một app nhắc việc.
 *
 * Luật xếp (theo thứ tự ưu tiên):
 *   1. Việc QUÁ HẠN lên trước, việc quá hạn lâu nhất lên đầu.
 *   2. Còn lại theo hạn gần nhất trước (dueAt tăng dần).
 *   3. Cùng hạn thì theo mức ưu tiên (Khẩn cấp → Cao → Trung bình → Thấp).
 * Mỗi ngày chỉ nhận tối đa `capacity` việc (người dùng chọn 3/5/8/10). Việc không
 * còn chỗ trước hạn được đưa vào `atRisk` — nói trước để khách dời hạn hoặc làm
 * sớm, thay vì để họ vỡ kế hoạch rồi mất niềm tin vào app.
 *
 * Việc đến hạn sau cửa sổ 7 ngày KHÔNG bị nhồi vào tuần này; chỉ đếm ở `laterCount`
 * để khách biết tuần sau có gì.
 */

export const PLAN_DAYS = 7
export const CAPACITY_OPTIONS = [3, 5, 8, 10]
export const DEFAULT_CAPACITY = 5

/** Trần số việc đọc từ DB cho một lần xếp kế hoạch (đủ rộng cho mọi người dùng thật). */
const MAX_TASKS = 300

const WEEKDAY_SHORT = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7']

const PRIORITY_WEIGHT = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
const PRIORITY_LABELS = { URGENT: 'Khẩn cấp', HIGH: 'Cao', MEDIUM: 'Trung bình', LOW: 'Thấp' }

export const PRIORITIES = PRIORITY_LABELS

const TZ = config.mail?.quotaTimezone || 'Asia/Ho_Chi_Minh'
const hourFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  hour: '2-digit',
  hourCycle: 'h23',
})
const dayKeyFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

function dayKey(date) {
  return dayKeyFormatter.format(date)
}

/**
 * Chuẩn hoá số việc mỗi ngày người dùng chọn.
 * Giá trị lạ bị từ chối rõ ràng thay vì im lặng dùng mặc định — nếu không, khách
 * tưởng đã đổi mà kế hoạch vẫn y như cũ.
 */
export function parseCapacity(value) {
  if (value === undefined || value === null || value === '') return DEFAULT_CAPACITY
  const capacity = Number(value)
  if (!CAPACITY_OPTIONS.includes(capacity)) {
    throw ApiError.badRequest(
      `Số việc mỗi ngày không hợp lệ. Chọn một trong: ${CAPACITY_OPTIONS.join(', ')}.`
    )
  }
  return capacity
}

/** Chặn xem kế hoạch nếu gói không có quyền (nói rõ tên gói + lợi ích). */
export function assertPlannerAllowed(plan) {
  if (!PLANS[plan]?.planner) {
    throw ApiError.badRequest(
      'Kế hoạch tuần là tính năng của gói Pro. Nâng cấp để biết mỗi ngày nên làm gì, và biết trước khi tuần bị quá tải.'
    )
  }
}

/** Ngày (theo giờ VN) của một thời điểm, dạng chỉ số ngày kể từ mốc `from`. */
function dayIndexFrom(from, date) {
  return Math.floor((startOfDay(date).getTime() - startOfDay(from).getTime()) / 86400000)
}

/**
 * XẾP KẾ HOẠCH — hàm thuần, không đụng DB (nhờ vậy test được từng luật).
 *
 * @param {object} input
 * @param {Array<{taskId:number,title:string,dueAt:Date|string,priority:string,
 *                nagEveryMinutes?:number|null,categoryName?:string|null}>} input.tasks
 *        Việc đang mở của MỘT người dùng.
 * @param {number} input.capacity Số việc tối đa mỗi ngày.
 * @param {Date} input.now
 * @returns {{days:Array, atRisk:Array, summary:object}}
 */
export function planWeek({ tasks = [], capacity = DEFAULT_CAPACITY, now = new Date() } = {}) {
  const todayStart = startOfDay(now)
  const lastDayStart = addDays(todayStart, PLAN_DAYS - 1)
  const windowEnd = endOfDay(lastDayStart)

  const dayList = []
  for (let i = 0; i < PLAN_DAYS; i += 1) {
    const date = addDays(todayStart, i)
    const key = dayKey(date)
    dayList.push({
      date: key,
      weekday: WEEKDAY_SHORT[new Date(`${key}T00:00:00Z`).getUTCDay()],
      dayNumber: Number(key.slice(8, 10)),
      month: Number(key.slice(5, 7)),
      isToday: i === 0,
      index: i,
      load: 0,
      capacity,
      items: [],
    })
  }

  // Việc đến hạn sau tuần này: không nhồi vào kế hoạch, chỉ đếm.
  const later = []
  const open = []
  tasks.forEach((task) => {
    const due = new Date(task.dueAt)
    if (due.getTime() > windowEnd.getTime()) {
      later.push(task)
      return
    }
    open.push(task)
  })

  // Thứ tự xếp: quá hạn trước (lâu nhất lên đầu) → hạn gần nhất → ưu tiên cao hơn
  const ordered = [...open].sort((a, b) => {
    const aLate = new Date(a.dueAt).getTime() < now.getTime()
    const bLate = new Date(b.dueAt).getTime() < now.getTime()
    if (aLate !== bLate) return aLate ? -1 : 1
    const dueDiff = new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
    if (dueDiff !== 0) return dueDiff
    return (PRIORITY_WEIGHT[a.priority] ?? 9) - (PRIORITY_WEIGHT[b.priority] ?? 9)
  })

  // Ngày muộn nhất có thể làm mà vẫn đúng hạn (việc quá hạn → hôm nay)
  const dueIndexOf = (task) => {
    const raw = dayIndexFrom(now, new Date(task.dueAt))
    return Math.min(Math.max(raw, 0), PLAN_DAYS - 1)
  }

  const scheduledDay = new Map()
  const lastDayIndex = dayList[dayList.length - 1].index

  for (const day of dayList) {
    const dayStart = addDays(todayStart, day.index)
    // Việc phải làm TRƯỚC hoặc TRONG ngày này (kể cả việc tồn từ hôm trước).
    // Hết chỗ thì để ngày sau — luôn xếp sớm nhất có thể, không nhảy cóc.
    const backlog = ordered.filter(
      (t) => !scheduledDay.has(t.taskId) && dueIndexOf(t) <= day.index
    )
    for (const task of backlog) {
      if (day.items.length >= capacity) break
      scheduledDay.set(task.taskId, day.index)
      const due = new Date(task.dueAt)
      day.items.push({
        taskId: task.taskId,
        title: task.title,
        priority: task.priority,
        priorityLabel: PRIORITY_LABELS[task.priority] || task.priority,
        dueAt: due,
        overdue: due.getTime() < now.getTime(),
        daysLate: Math.max(0, Math.floor((now.getTime() - due.getTime()) / 86400000)),
        // Kế hoạch này xong muộn hơn hạn bao nhiêu ngày (0 = kịp hạn).
        // So với CUỐI ngày dự kiến làm: dự kiến làm trong ngày nhưng hạn rơi vào
        // 9 giờ sáng cùng ngày vẫn có thể trễ — nói 0 là nói dối.
        willBeLateDays: Math.max(
          0,
          Math.floor((endOfDay(dayStart).getTime() - due.getTime()) / 86400000)
        ),
        categoryName: task.categoryName || null,
        nagEveryMinutes: task.nagEveryMinutes ?? null,
        // Việc đầu tiên của ngày là việc quan trọng nhất → gợi ý đặt vào giờ vàng
        focus: day.items.length === 0,
      })
    }
    day.load = day.items.length
  }

  // Danh sách "sẽ trễ nếu giữ nhịp này": những việc mà CHÍNH KẾ HOẠCH này làm
  // chúng trễ hạn — gồm hai loại:
  //   1. việc xếp được nhưng muộn hơn hạn (hết chỗ ở những ngày sớm hơn)
  //   2. việc không còn chỗ nào trong cả tuần
  // Giấu loại 1 đi là tự lừa mình: kế hoạch trông "kín chỗ" mà vẫn trễ hạn.
  //
  // Việc ĐÃ quá hạn thì KHÔNG lặp lại ở đây — nó đã hiện rõ ở ngày đầu kèm số ngày
  // trễ, và ở thẻ "đang quá hạn" của báo cáo. Đưa việc cũ vào danh sách cảnh báo
  // chỉ làm khách quen mắt rồi bỏ qua cả những cảnh báo mới thật sự đáng đọc.
  const atRisk = []
  ordered.forEach((task) => {
    const due = new Date(task.dueAt)
    const isScheduled = scheduledDay.has(task.taskId)
    if (isScheduled && due.getTime() < now.getTime()) return

    // Việc không còn chỗ nào trong tuần coi như bị đẩy tới ngày cuối cửa sổ
    const dayIndex = isScheduled ? scheduledDay.get(task.taskId) : lastDayIndex
    const willBeLateDays = Math.max(
      0,
      Math.floor((endOfDay(addDays(todayStart, dayIndex)).getTime() - due.getTime()) / 86400000)
    )
    if (isScheduled && willBeLateDays <= 0) return
    atRisk.push({
      taskId: task.taskId,
      title: task.title,
      priority: task.priority,
      priorityLabel: PRIORITY_LABELS[task.priority] || task.priority,
      dueAt: due,
      overdue: due.getTime() < now.getTime(),
      willBeLateDays,
      // Ngày dự kiến làm theo kế hoạch (null = không còn chỗ trong tuần)
      plannedFor: isScheduled ? dayList[scheduledDay.get(task.taskId)].date : null,
      categoryName: task.categoryName || null,
    })
  })
  atRisk.sort((a, b) => b.willBeLateDays - a.willBeLateDays)

  const overdue = ordered.filter((t) => new Date(t.dueAt).getTime() < now.getTime())
  const dueToday = open.filter((t) => dayIndexFrom(now, new Date(t.dueAt)) === 0)
  const planned = scheduledDay.size
  const seats = capacity * PLAN_DAYS

  return {
    days: dayList,
    atRisk,
    laterCount: later.length,
    later: later.slice(0, 10).map((t) => ({
      taskId: t.taskId,
      title: t.title,
      dueAt: t.dueAt,
      priority: t.priority,
      priorityLabel: PRIORITY_LABELS[t.priority] || t.priority,
    })),
    summary: {
      capacity,
      seats,
      openCount: open.length,
      planned,
      seatsLeft: Math.max(0, seats - planned),
      overdueCount: overdue.length,
      dueTodayCount: dueToday.length,
      atRiskCount: atRisk.length,
      laterCount: later.length,
      overloaded: atRisk.length > 0,
    },
  }
}

/**
 * Giờ vàng: giờ trong ngày mà người dùng hay đánh dấu xong việc nhất (30 ngày gần
 * nhất). Lấy từ dữ liệu thật nên không phải lời khuyên chung chung.
 */
async function goldenHour(userId, now = new Date()) {
  const from = addDays(now, -30)
  const rows = await prisma.task.findMany({
    where: { userId, deletedAt: null, status: 'COMPLETED', completedAt: { gte: from, lte: now } },
    select: { completedAt: true },
    orderBy: { completedAt: 'desc' },
    take: 1000,
  })
  if (!rows.length) return { hour: null, count: 0 }
  const buckets = new Array(24).fill(0)
  rows.forEach((r) => {
    const h = Number(hourFormatter.format(new Date(r.completedAt))) % 24
    buckets[h] += 1
  })
  let best = 0
  buckets.forEach((count, hour) => {
    if (count > buckets[best]) best = hour
  })
  return { hour: best, count: buckets[best] }
}

/**
 * Kế hoạch tuần của một người dùng (đọc DB rồi gọi `planWeek`).
 *
 * @param {number} userId
 * @param {{ capacity?: number, now?: Date }} options
 */
export async function buildWeekPlan(userId, { capacity = DEFAULT_CAPACITY, now = new Date() } = {}) {
  const user = await prisma.user.findUnique({
    where: { userId },
    select: { userId: true, plan: true, planExpiresAt: true },
  })
  if (!user) throw ApiError.notFound('Không tìm thấy người dùng')
  const plan = isPlanExpired(user) ? 'FREE' : user.plan
  assertPlannerAllowed(plan)

  const [rows, golden] = await Promise.all([
    prisma.task.findMany({
      where: { userId, deletedAt: null, status: { in: ['TODO', 'IN_PROGRESS'] } },
      select: {
        taskId: true,
        title: true,
        dueAt: true,
        priority: true,
        nagEveryMinutes: true,
        category: { select: { categoryName: true } },
      },
      orderBy: { dueAt: 'asc' },
      take: MAX_TASKS,
    }),
    goldenHour(userId, now),
  ])

  const result = planWeek({
    tasks: rows.map((t) => ({ ...t, categoryName: t.category?.categoryName || null })),
    capacity,
    now,
  })

  return {
    plan,
    generatedAt: now,
    range: { from: result.days[0].date, to: result.days[PLAN_DAYS - 1].date, days: PLAN_DAYS },
    ...result,
    goldenHour: golden,
  }
}

export default {
  PLAN_DAYS,
  CAPACITY_OPTIONS,
  DEFAULT_CAPACITY,
  parseCapacity,
  assertPlannerAllowed,
  planWeek,
  buildWeekPlan,
}
