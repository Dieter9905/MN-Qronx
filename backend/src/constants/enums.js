/**
 * Task status values (ERD-R-05).
 */
export const TASK_STATUS = Object.freeze({
  TODO: 'TODO',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
})

/**
 * Task priority values (ERD-R-06).
 */
export const PRIORITY = Object.freeze({
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
})

/**
 * Repeat type values (ERD-R-07).
 */
export const REPEAT_TYPE = Object.freeze({
  NONE: 'NONE',
  DAILY: 'DAILY',
  WEEKLY: 'WEEKLY',
  MONTHLY: 'MONTHLY',
})

/**
 * Reminder status values (ERD-R-11).
 */
export const REMINDER_STATUS = Object.freeze({
  SCHEDULED: 'SCHEDULED',
  TRIGGERED: 'TRIGGERED',
  SNOOZED: 'SNOOZED',
  DISMISSED: 'DISMISSED',
  CANCELLED: 'CANCELLED',
})

/**
 * Notification log action values (ERD-R-15).
 */
export const NOTIFICATION_ACTION = Object.freeze({
  SENT: 'SENT',
  SNOOZED: 'SNOOZED',
  DISMISSED: 'DISMISSED',
})

/**
 * Device platform values.
 */
export const PLATFORM = Object.freeze({
  WEB: 'WEB',
  ANDROID: 'ANDROID',
  IOS: 'IOS',
})

/**
 * User roles.
 */
export const ROLE = Object.freeze({
  USER: 'USER',
  ADMIN: 'ADMIN',
})
