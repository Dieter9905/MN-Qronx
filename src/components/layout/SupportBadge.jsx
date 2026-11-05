import { useUnreadBadge } from '../../lib/useUnreadBadge'
import { getSupportUnread, getAdminSupportUnread } from '../../services/supportService'

/**
 * Huy hiệu số tin hỗ trợ chưa đọc, tự làm mới mỗi 60 giây.
 * Dùng trong Sidebar (người dùng) và AdminShell (admin) — đặt trong từng mục menu
 * nên không cần truyền state qua nhiều tầng.
 * tone="room": da phòng (Blush + chữ on-blush, không rose) — chỉ shell app dùng;
 * mặc định giữ da rose cũ cho AdminShell.
 */
export default function SupportBadge({ admin = false, tone = 'navy', className = '' }) {
  const count = useUnreadBadge(admin ? getAdminSupportUnread : getSupportUnread)
  if (!count) return null

  return (
    <span
      className={`rounded-full px-1.5 py-px text-[10px] font-extrabold ${
        tone === 'room'
          ? 'bg-room-blush on-blush ring-1 ring-room-acorn/30'
          : 'bg-rose-500 text-white'
      } ${className}`}
      aria-label={`${count} tin nhắn hỗ trợ chưa đọc`}
    >
      {count > 9 ? '9+' : count}
    </span>
  )
}
