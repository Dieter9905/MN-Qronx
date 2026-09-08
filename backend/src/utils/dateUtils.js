/**
 * Add a number of days to a Date.
 * @param {Date}   date
 * @param {number} days
 * @returns {Date}
 */
export function addDays(date, days) {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

/**
 * Add a number of minutes to a Date.
 * @param {Date}   date
 * @param {number} minutes
 * @returns {Date}
 */
export function addMinutes(date, minutes) {
  const result = new Date(date)
  result.setMinutes(result.getMinutes() + minutes)
  return result
}

/**
 * Ngày trong tuần theo ISO 8601 của một Date (1 = Thứ 2 … 7 = Chủ nhật).
 * @param {Date} date
 * @returns {number}
 */
export function isoWeekday(date) {
  const day = date.getDay()
  return day === 0 ? 7 : day
}

/**
 * Chuyển giá trị repeatDays (mảng hoặc chuỗi "1,3,5") thành mảng số nguyên 1..7.
 * @param {string|number[]|null} value
 * @returns {number[]}
 */
export function parseRepeatDays(value) {
  let items = []
  if (Array.isArray(value)) items = value
  else if (typeof value === 'string' && value.trim()) items = value.split(',')
  return items
    .map((n) => Number(n))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 7)
}

/**
 * Chuẩn hoá repeatDays để lưu DB: chuỗi "1,3,5" (đã sắp xếp, loại trùng).
 * Trả về null khi không có ngày nào hợp lệ.
 * @param {string|number[]|null} value
 * @returns {string|null}
 */
export function serializeRepeatDays(value) {
  const days = [...new Set(parseRepeatDays(value))].sort((a, b) => a - b)
  return days.length ? days.join(',') : null
}

/**
 * Calculate the next dueAt date for a repeating task.
 *
 * Với repeatType = 'WEEKLY' và có danh sách repeatDays (ISO 8601, 1=Thứ 2 … 7=CN),
 * lần lặp kế tiếp rơi vào ngày gần nhất trong danh sách sau dueAt.
 * Khi WEEKLY không có repeatDays → lặp đúng thứ trong tuần hiện tại (7 ngày/lần).
 *
 * @param {Date}   dueAt      Current dueAt
 * @param {string} repeatType One of 'DAILY', 'WEEKLY', 'MONTHLY'
 * @param {string|number[]} [repeatDays] Danh sách ngày trong tuần (chỉ áp dụng WEEKLY)
 * @returns {Date}
 */
export function calculateNextDueDate(dueAt, repeatType, repeatDays) {
  switch (repeatType) {
    case 'DAILY':
      return addDays(dueAt, 1)
    case 'WEEKLY': {
      const days = parseRepeatDays(repeatDays)
      // Có chọn ngày cụ thể → tìm ngày gần nhất trong danh sách sau dueAt
      if (days.length) {
        for (let offset = 1; offset <= 7; offset += 1) {
          const next = addDays(dueAt, offset)
          if (days.includes(isoWeekday(next))) return next
        }
      }
      // Không chọn ngày → giữ hành vi cũ: lặp 7 ngày/lần (đúng thứ trong tuần)
      return addDays(dueAt, 7)
    }
    case 'MONTHLY': {
      const next = new Date(dueAt)
      next.setMonth(next.getMonth() + 1)
      return next
    }
    default:
      return dueAt
  }
}

// ─── Múi giờ mặc định của ứng dụng: Việt Nam (UTC+7) ──────
// Server production (Render) chạy theo giờ UTC: setHours(0,0,0,0)
// sẽ lấy mốc ngày sai lệch 7 giờ so với người dùng VN
// (VD: 00:02 ngày 9/9 giờ VN = 8/9 17:02 UTC → vẫn bị tính là 8/9).
// Vì vậy startOfDay/endOfDay luôn quy về mốc 00:00/23:59 theo giờ VN.
const APP_TIMEZONE_OFFSET_MINUTES = Number(process.env.APP_TZ_OFFSET_MINUTES ?? 7 * 60)

function toAppTime(date) {
  return new Date(date.getTime() + APP_TIMEZONE_OFFSET_MINUTES * 60000)
}

function fromAppTime(date) {
  return new Date(date.getTime() - APP_TIMEZONE_OFFSET_MINUTES * 60000)
}

/**
 * Get the start of day (00:00:00) of a Date, tính theo giờ Việt Nam (UTC+7).
 * @param {Date} date
 * @returns {Date}
 */
export function startOfDay(date) {
  const shifted = toAppTime(new Date(date))
  shifted.setUTCHours(0, 0, 0, 0)
  return fromAppTime(shifted)
}

/**
 * Get the end of day (23:59:59.999) of a Date, tính theo giờ Việt Nam (UTC+7).
 * @param {Date} date
 * @returns {Date}
 */
export function endOfDay(date) {
  const shifted = toAppTime(new Date(date))
  shifted.setUTCHours(23, 59, 59, 999)
  return fromAppTime(shifted)
}
