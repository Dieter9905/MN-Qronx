import { useUnreadBadge } from '../../lib/useUnreadBadge'
import { getSupportUnread, getAdminSupportUnread } from '../../services/supportService'

/**
 * Huy hiệu số tin hỗ trợ chưa đọc, tự làm mới mỗi 60 giây.
 * Dùng trong Sidebar (người dùng) và AdminShell (admin) — đặt trong từng mục menu
 * nên không cần truyền state qua nhiều tầng.
 */
export default function SupportBadge({ admin = false, className = '' }) {
  const count = useUnreadBadge(admin ? getAdminSupportUnread : getSupportUnread)
  if (!count) return null

  return (
    <span
      className={`rounded-full bg-rose-500 px-1.5 py-px text-[10px] font-extrabold text-white ${className}`}
      aria-label={`${count} tin nhắn hỗ trợ chưa đọc`}
    >
      {count > 9 ? '9+' : count}
    </span>
  )
}
