import {
  House,
  ListChecks,
  CalendarBlank,
  FolderSimple,
  Bell,
  Gear,
  Brain,
  Gift,
} from '@phosphor-icons/react'

export const NAV_GROUPS = [
  {
    label: 'Chính',
    items: [
      { to: '/app', label: 'Dashboard', icon: House, end: true },
      { to: '/app/tasks', label: 'Công việc', icon: ListChecks },
      { to: '/app/calendar', label: 'Lịch', icon: CalendarBlank },
    ],
  },
  {
    label: 'AI',
    items: [{ to: '/app/ai', label: 'Trợ lý AI', icon: Brain, pro: true }],
  },
  {
    label: 'Quản lý',
    items: [
      { to: '/app/categories', label: 'Danh mục', icon: FolderSimple },
      { to: '/app/notifications', label: 'Lịch sử thông báo', icon: Bell },
      { to: '/app/rewards', label: 'Phần thưởng', icon: Gift },
    ],
  },
  {
    label: 'Khác',
    items: [{ to: '/app/settings', label: 'Cài đặt', icon: Gear }],
  },
]

export const BOTTOM_NAV = [
  { to: '/app', label: 'Dashboard', icon: House, end: true },
  { to: '/app/tasks', label: 'Công việc', icon: ListChecks },
  { to: '/app/calendar', label: 'Lịch', icon: CalendarBlank },
  { to: '/app/settings', label: 'Cài đặt', icon: Gear },
]
