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
  Kanban,
} from '@phosphor-icons/react'

// labelKey → tra trong i18n/app.js (app[lang][labelKey]) để đa ngôn ngữ
export const NAV_GROUPS = [
  {
    labelKey: 'mainGroup',
    items: [
      { to: '/app', labelKey: 'dashboard', icon: House, end: true },
      { to: '/app/tasks', labelKey: 'tasks', icon: ListChecks },
      { to: '/app/calendar', labelKey: 'calendar', icon: CalendarBlank },
      // Bảng kéo-thả kiểu Jira: chỉ có trong Nhóm làm việc (TEAM)
      { to: '/app/board', labelKey: 'board', icon: Kanban, onlyTypes: ['TEAM'] },
      // Việc được giao + Cả nhóm CHỈ thuộc chế độ Nhóm làm việc (TEAM):
      // người dùng Cá nhân/Lớp học không thấy hai mục này nữa — nhờ vậy sidebar
      // đúng nghĩa "mỗi chế độ một bộ menu" thay vì hiện hết rồi người dùng phải
      // tự đoán mục nào dùng được. `onlyTypes` được Sidebar/menu mobile lọc theo
      // không gian đang chọn (xem NavGroup filtering).
      { to: '/app/assigned', labelKey: 'assigned', icon: Users, onlyTypes: ['TEAM'] },
      { to: '/app/family', labelKey: 'family', icon: UsersThree, pro: true, onlyTypes: ['TEAM'] },
      // Bảng điều khiển nhóm: thành viên, mã mời, giao việc — cũng chỉ có ở TEAM
      { to: '/app/team', labelKey: 'team', icon: UsersThree, onlyTypes: ['TEAM'] },
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

/**
 * Lọc nhóm menu theo chế độ đang chọn (type của không gian: PERSONAL/STUDENT/TEAM).
 * Mục có `onlyTypes` chỉ hiện khi không gian hiện tại thuộc danh sách đó — nhờ vậy
 * "Việc được giao"/"Cả nhóm"/"Nhóm làm việc" không lẫn sang chế độ Cá nhân hay
 * Lớp học. Nhóm nào không còn mục nào thì bỏ luôn (không để tiêu đề trống).
 */
export function filterNavByWorkspace(groups, workspaceType) {
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => !item.onlyTypes || (workspaceType && item.onlyTypes.includes(workspaceType)),
      ),
    }))
    .filter((group) => group.items.length > 0)
}

export const BOTTOM_NAV = [
  { to: '/app', labelKey: 'dashboard', icon: House, end: true },
  { to: '/app/tasks', labelKey: 'tasks', icon: ListChecks },
  { to: '/app/calendar', labelKey: 'calendar', icon: CalendarBlank },
  { to: '/app/settings', labelKey: 'settings', icon: Gear },
]