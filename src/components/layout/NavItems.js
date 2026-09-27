import {
  House,
  ListChecks,
  CalendarBlank,
  ChartBar,
  FolderSimple,
  Bell,
  Gear,
  Brain,
  Gift,
  Headset,
} from '@phosphor-icons/react'

// labelKey → tra trong i18n/app.js (app[lang][labelKey]) để đa ngôn ngữ
export const NAV_GROUPS = [
  {
    labelKey: 'mainGroup',
    items: [
      { to: '/app', labelKey: 'dashboard', icon: House, end: true },
      { to: '/app/tasks', labelKey: 'tasks', icon: ListChecks },
      { to: '/app/calendar', labelKey: 'calendar', icon: CalendarBlank },
      // Báo cáo năng suất: chỉ Pro xem được (trang tự hiện khung nâng cấp cho gói khác)
      { to: '/app/reports', labelKey: 'reports', icon: ChartBar, pro: true },
    ],
  },
  {
    labelKey: 'aiGroup',
    items: [{ to: '/app/ai', labelKey: 'aiAssistant', icon: Brain, pro: true }],
  },
  {
    labelKey: 'manageGroup',
    items: [
      { to: '/app/categories', labelKey: 'categories', icon: FolderSimple },
      { to: '/app/notifications', labelKey: 'notifHistory', icon: Bell },
      { to: '/app/rewards', labelKey: 'rewards', icon: Gift },
    ],
  },
  {
    labelKey: 'otherGroup',
    items: [
      // CSKH: chat trực tiếp với admin, huy hiệu chưa đọc nằm ở Sidebar.jsx
      { to: '/app/support', labelKey: 'support', icon: Headset },
      { to: '/app/settings', labelKey: 'settings', icon: Gear },
    ],
  },
]

export const BOTTOM_NAV = [
  { to: '/app', labelKey: 'dashboard', icon: House, end: true },
  { to: '/app/tasks', labelKey: 'tasks', icon: ListChecks },
  { to: '/app/calendar', labelKey: 'calendar', icon: CalendarBlank },
  { to: '/app/settings', labelKey: 'settings', icon: Gear },
]