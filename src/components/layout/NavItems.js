import {
  House,
  ListChecks,
  CalendarBlank,
  CalendarCheck,
  ChartBar,
  FolderSimple,
  Bell,
  Gear,
  Brain,
  Gift,
  Headset,
  Users,
  UsersThree,
} from '@phosphor-icons/react'

// labelKey → tra trong i18n/app.js (app[lang][labelKey]) để đa ngôn ngữ
export const NAV_GROUPS = [
  {
    labelKey: 'mainGroup',
    items: [
      { to: '/app', labelKey: 'dashboard', icon: House, end: true },
      { to: '/app/tasks', labelKey: 'tasks', icon: ListChecks },
      { to: '/app/calendar', labelKey: 'calendar', icon: CalendarBlank },
      // Việc được giao: KHÔNG đánh dấu pro — người được nhờ không cần gói trả phí,
      // và mục menu này chính là chỗ để khách thấy tính năng giao việc đang chạy.
      { to: '/app/assigned', labelKey: 'assigned', icon: Users },
      // "Cả nhóm": bảng tiến độ là quyền lợi riêng của chủ gói Pro Doanh nghiệp, người
      // trong nhóm vào đây để bật/tắt chia sẻ, người chưa có gói thấy lời mời mua.
      { to: '/app/family', labelKey: 'family', icon: UsersThree, pro: true },
      // Kế hoạch tuần + Báo cáo năng suất: chỉ Pro (trang tự hiện khung nâng cấp cho gói khác)
      { to: '/app/planner', labelKey: 'planner', icon: CalendarCheck, pro: true },
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