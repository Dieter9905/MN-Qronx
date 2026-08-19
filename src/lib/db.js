// Mock database tầng localStorage – mô phỏng REST API của backend (Node.js + Express)
// Cấu trúc theo ERD/BA: users, categories, tasks, subtasks, reminders,
// devices, notification_settings, notification_logs

import { addDays, addMinutes, setTime } from './format'

const PREFIX = 'mnq:'
const KEYS = {
  users: 'users',
  categories: 'categories',
  tasks: 'tasks',
  devices: 'devices',
  settings: 'notificationSettings',
  logs: 'notificationLogs',
  session: 'session',
}

const DB_VERSION = 'v1'

let dbCache = null

function load() {
  if (dbCache) return dbCache
  try {
    const raw = localStorage.getItem(PREFIX + 'db')
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed?.version === DB_VERSION) {
        dbCache = parsed
        return dbCache
      }
    }
  } catch {
    /* corrupted storage – reseed */
  }
  dbCache = seed()
  persist()
  return dbCache
}

function persist() {
  localStorage.setItem(PREFIX + 'db', JSON.stringify(dbCache))
}

export function getDb() {
  return load()
}

export function resetDb() {
  dbCache = null
  localStorage.removeItem(PREFIX + 'db')
  load()
}

function nextId(collection) {
  return collection.reduce((m, x) => Math.max(m, Number(x.id) || 0), 0) + 1
}

function nowIso() {
  return new Date().toISOString()
}

// ---------- Seed data ----------

function seed() {
  const today = new Date()
  const at = (dayOffset, hour, minute = 0) => setTime(addDays(today, dayOffset), hour, minute).toISOString()

  const users = [
    {
      id: 1,
      fullName: 'Nguyễn Văn Minh',
      email: 'minh@mn-qronx.com',
      password: '123456',
      phoneNumber: '0901 234 567',
      role: 'USER',
      isActive: true,
      createdAt: at(-120, 9, 0),
    },
    {
      id: 2,
      fullName: 'Quản trị viên',
      email: 'admin@mn-qronx.com',
      password: 'Admin@123',
      phoneNumber: '',
      role: 'ADMIN',
      isActive: true,
      createdAt: at(-160, 8, 0),
    },
    {
      id: 3,
      fullName: 'Lan Trần',
      email: 'lan.tran@example.com',
      password: '123456',
      phoneNumber: '0918 555 121',
      role: 'USER',
      isActive: true,
      createdAt: at(-90, 14, 20),
    },
    {
      id: 4,
      fullName: 'Hùng Lê',
      email: 'hung.le@example.com',
      password: '123456',
      phoneNumber: '0977 222 333',
      role: 'USER',
      isActive: false,
      createdAt: at(-60, 10, 5),
    },
    {
      id: 5,
      fullName: 'Trang Phạm',
      email: 'trang.pham@example.com',
      password: '123456',
      phoneNumber: '0933 888 999',
      role: 'USER',
      isActive: true,
      createdAt: at(-30, 16, 45),
    },
  ]

  const categories = [
    { id: 1, userId: 1, name: 'Học tập', color: '#2563EB', isActive: true, createdAt: at(-100, 8) },
    { id: 2, userId: 1, name: 'Công việc', color: '#8B5CF6', isActive: true, createdAt: at(-100, 8, 5) },
    { id: 3, userId: 1, name: 'Cá nhân', color: '#06B6D4', isActive: true, createdAt: at(-100, 8, 10) },
    { id: 4, userId: 1, name: 'Sức khỏe', color: '#10B981', isActive: false, createdAt: at(-50, 7) },
  ]

  const tasks = [
    {
      id: 1,
      userId: 1,
      categoryId: 1,
      title: 'Ôn tập môn Toán – Chương 3',
      description: 'Đạo hàm và ứng dụng. Làm hết bài tập cuối chương trước buổi học nhóm.',
      priority: 'HIGH',
      status: 'TODO',
      dueAt: at(0, 19, 0),
      repeatType: 'NONE',
      parentTaskId: null,
      createdAt: at(-2, 20),
    },
    {
      id: 2,
      userId: 1,
      categoryId: 2,
      title: 'Nộp báo cáo tuần cho nhóm',
      description: 'Tổng hợp tiến độ sprint và gửi qua email cho trưởng nhóm.',
      priority: 'URGENT',
      status: 'IN_PROGRESS',
      dueAt: at(0, 17, 30),
      repeatType: 'WEEKLY',
      parentTaskId: null,
      createdAt: at(-3, 9),
    },
    {
      id: 3,
      userId: 1,
      categoryId: 3,
      title: 'Đặt lịch khám răng',
      description: 'Gọi phòng khám Nha Khoa Việt để hẹn giờ cuối tuần.',
      priority: 'MEDIUM',
      status: 'TODO',
      dueAt: at(1, 10, 0),
      repeatType: 'NONE',
      parentTaskId: null,
      createdAt: at(-1, 18),
    },
    {
      id: 4,
      userId: 1,
      categoryId: 1,
      title: 'Học tiếng Anh 30 phút',
      description: 'Duolingo + luyện nghe Podcast 6 phút.',
      priority: 'LOW',
      status: 'TODO',
      dueAt: at(0, 21, 0),
      repeatType: 'DAILY',
      parentTaskId: null,
      createdAt: at(-5, 21),
    },
    {
      id: 5,
      userId: 1,
      categoryId: 2,
      title: 'Trả lời email khách hàng',
      description: '3 email đang chờ phản hồi từ ngày hôm qua.',
      priority: 'HIGH',
      status: 'COMPLETED',
      dueAt: at(0, 9, 30),
      repeatType: 'NONE',
      parentTaskId: null,
      completedAt: at(0, 9, 15),
      createdAt: at(-1, 8),
    },
    {
      id: 6,
      userId: 1,
      categoryId: 3,
      title: 'Tập thể dục buổi sáng',
      description: 'Chạy bộ 20 phút quanh công viên.',
      priority: 'MEDIUM',
      status: 'COMPLETED',
      dueAt: at(0, 6, 30),
      repeatType: 'DAILY',
      parentTaskId: null,
      completedAt: at(0, 6, 25),
      createdAt: at(-10, 6),
    },
    {
      id: 7,
      userId: 1,
      categoryId: 1,
      title: 'Làm bài tập nhóm môn CNPM',
      description: 'Hoàn thành phần phân tích use case.',
      priority: 'HIGH',
      status: 'COMPLETED',
      dueAt: at(0, 12, 0),
      repeatType: 'NONE',
      parentTaskId: null,
      completedAt: at(0, 11, 40),
      createdAt: at(-4, 19),
    },
    {
      id: 8,
      userId: 1,
      categoryId: 2,
      title: 'Chuẩn bị slide thuyết trình',
      description: 'Slide demo tính năng nhắc nhở kiểu báo thức.',
      priority: 'HIGH',
      status: 'TODO',
      dueAt: at(2, 15, 0),
      repeatType: 'NONE',
      parentTaskId: null,
      createdAt: at(0, 13),
    },
    {
      id: 9,
      userId: 1,
      categoryId: 3,
      title: 'Mua quà sinh nhật mẹ',
      description: 'Chọn áo dài ở cửa hàng trên đường Nguyễn Huệ.',
      priority: 'MEDIUM',
      status: 'CANCELLED',
      dueAt: at(3, 18, 0),
      repeatType: 'NONE',
      parentTaskId: null,
      createdAt: at(-6, 15),
    },
    {
      id: 10,
      userId: 1,
      categoryId: 1,
      title: 'Ôn tập môn Toán – Chương 2',
      description: 'Giới hạn và hàm số liên tục (lần lặp tuần trước).',
      priority: 'HIGH',
      status: 'COMPLETED',
      dueAt: at(-7, 19, 0),
      repeatType: 'NONE',
      parentTaskId: null,
      completedAt: at(-7, 18, 50),
      createdAt: at(-9, 20),
    },
    {
      id: 11,
      userId: 1,
      categoryId: 2,
      title: 'Họp review sprint',
      description: 'Họp online qua Google Meet, chuẩn bị demo 2 tính năng.',
      priority: 'URGENT',
      status: 'TODO',
      dueAt: at(1, 9, 0),
      repeatType: 'WEEKLY',
      parentTaskId: null,
      createdAt: at(-3, 10),
    },
  ]

  const subtasks = [
    { id: 1, taskId: 1, content: 'Xem lại lý thuyết đạo hàm', isCompleted: true, createdAt: at(-1, 20, 10) },
    { id: 2, taskId: 1, content: 'Làm 10 bài tập phần ứng dụng', isCompleted: false, createdAt: at(-1, 20, 12) },
    { id: 3, taskId: 1, content: 'Xem lại bài giảng video tuần này', isCompleted: false, createdAt: at(-1, 20, 14) },
    { id: 4, taskId: 2, content: 'Cập nhật bảng tiến độ', isCompleted: true, createdAt: at(-1, 9, 5) },
    { id: 5, taskId: 2, content: 'Viết phần tổng kết rủi ro', isCompleted: false, createdAt: at(-1, 9, 7) },
    { id: 6, taskId: 8, content: 'Tạo bản nháp outline', isCompleted: true, createdAt: at(0, 13, 5) },
    { id: 7, taskId: 8, content: 'Thiết kế slide phần báo thức', isCompleted: false, createdAt: at(0, 13, 8) },
  ]

  const reminders = [
    { id: 1, taskId: 1, remindAt: at(0, 18, 30), status: 'SCHEDULED', snoozeCount: 0, createdAt: at(-2, 20, 5) },
    { id: 2, taskId: 2, remindAt: at(0, 16, 30), status: 'SCHEDULED', snoozeCount: 0, createdAt: at(-3, 9, 5) },
    { id: 3, taskId: 2, remindAt: at(0, 17, 15), status: 'SCHEDULED', snoozeCount: 0, createdAt: at(-3, 9, 6) },
    { id: 4, taskId: 4, remindAt: at(0, 20, 45), status: 'SCHEDULED', snoozeCount: 0, createdAt: at(-5, 21, 5) },
    { id: 5, taskId: 3, remindAt: at(1, 9, 30), status: 'SCHEDULED', snoozeCount: 0, createdAt: at(-1, 18, 5) },
    { id: 6, taskId: 8, remindAt: at(2, 14, 0), status: 'SCHEDULED', snoozeCount: 0, createdAt: at(0, 13, 10) },
    { id: 7, taskId: 11, remindAt: at(1, 8, 30), status: 'SCHEDULED', snoozeCount: 0, createdAt: at(-3, 10, 5) },
  ]

  const devices = [
    { id: 1, userId: 1, name: 'Chrome – Windows 11', platform: 'WEB', isActive: true, lastSeenAt: nowIso(), createdAt: at(-20, 10) },
    { id: 2, userId: 1, name: 'iPhone 15 – iOS 17', platform: 'IOS', isActive: true, lastSeenAt: nowIso(), createdAt: at(-14, 19) },
    { id: 3, userId: 1, name: 'Samsung Galaxy S23', platform: 'ANDROID', isActive: false, lastSeenAt: at(-30, 12), createdAt: at(-45, 9) },
  ]

  const notificationSettings = [
    {
      userId: 1,
      alarmSound: 'classic',
      defaultSnoozeMinutes: 10,
      vibrationEnabled: true,
      updatedAt: at(-5, 20),
    },
  ]

  const notificationLogs = [
    { id: 1, userId: 1, taskId: 5, taskTitle: 'Trả lời email khách hàng', deviceName: 'Chrome – Windows 11', action: 'SENT', sentAt: at(0, 9, 0) },
    { id: 2, userId: 1, taskId: 7, taskTitle: 'Làm bài tập nhóm môn CNPM', deviceName: 'iPhone 15 – iOS 17', action: 'SENT', sentAt: at(0, 11, 30) },
    { id: 3, userId: 1, taskId: 7, taskTitle: 'Làm bài tập nhóm môn CNPM', deviceName: 'iPhone 15 – iOS 17', action: 'DISMISSED', sentAt: at(0, 11, 41) },
    { id: 4, userId: 1, taskId: 6, taskTitle: 'Tập thể dục buổi sáng', deviceName: 'Chrome – Windows 11', action: 'SENT', sentAt: at(0, 6, 30) },
    { id: 5, userId: 1, taskId: 10, taskTitle: 'Ôn tập môn Toán – Chương 2', deviceName: 'Chrome – Windows 11', action: 'SENT', sentAt: at(-7, 18, 30) },
    { id: 6, userId: 1, taskId: 10, taskTitle: 'Ôn tập môn Toán – Chương 2', deviceName: 'Chrome – Windows 11', action: 'SNOOZED', sentAt: at(-7, 18, 35) },
  ]

  return {
    version: DB_VERSION,
    users,
    categories,
    tasks,
    subtasks,
    reminders,
    devices,
    notificationSettings,
    notificationLogs,
  }
}

// ---------- CRUD primitives (services gọi qua đây) ----------

export const db = {
  get users() {
    return load().users
  },
  get categories() {
    return load().categories
  },
  get tasks() {
    return load().tasks
  },
  get subtasks() {
    return load().subtasks
  },
  get reminders() {
    return load().reminders
  },
  get devices() {
    return load().devices
  },
  get notificationSettings() {
    return load().notificationSettings
  },
  getSettingsForUser(userId) {
    return load().notificationSettings.find((s) => s.userId === userId)
  },
  get notificationLogs() {
    return load().notificationLogs
  },

  saveUsers(list) {
    load().users = list
    persist()
  },
  saveCategories(list) {
    load().categories = list
    persist()
  },
  saveTasks(list) {
    load().tasks = list
    persist()
  },
  saveSubtasks(list) {
    load().subtasks = list
    persist()
  },
  saveReminders(list) {
    load().reminders = list
    persist()
  },
  saveDevices(list) {
    load().devices = list
    persist()
  },
  saveSettings(settings) {
    load().notificationSettings = settings
    persist()
  },
  saveLogs(list) {
    load().notificationLogs = list
    persist()
  },
  nextId,
  nowIso,
  addMinutes,
}

// ---------- Session ----------

export function getSession() {
  try {
    return JSON.parse(localStorage.getItem(PREFIX + KEYS.session))
  } catch {
    return null
  }
}

export function setSession(session) {
  if (session) localStorage.setItem(PREFIX + KEYS.session, JSON.stringify(session))
  else localStorage.removeItem(PREFIX + KEYS.session)
}
