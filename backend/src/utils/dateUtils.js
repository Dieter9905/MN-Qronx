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
 * Calculate the next dueAt date for a repeating task.
 *
 * @param {Date}   dueAt      Current dueAt
 * @param {string} repeatType One of 'DAILY', 'WEEKLY', 'MONTHLY'
 * @returns {Date}
 */
export function calculateNextDueDate(dueAt, repeatType) {
  switch (repeatType) {
    case 'DAILY':
      return addDays(dueAt, 1)
    case 'WEEKLY':
      return addDays(dueAt, 7)
    case 'MONTHLY': {
      const next = new Date(dueAt)
      next.setMonth(next.getMonth() + 1)
      return next
    }
    default:
      return dueAt
  }
}
