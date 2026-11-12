import { useEffect, useState } from 'react'
import { Bell, ArrowLeft, ArrowRight, ClockCounterClockwise } from '@phosphor-icons/react'
import { getNotificationLogs } from '../../services/notificationService'
import { NOTIFICATION_ACTION } from '../../lib/constants'
import { formatDateTime, relativeTime } from '../../lib/format'
import { RoomButton, RoomCard, RoomEmpty, RoomSegmented, RoomSkeleton } from '../../components/common/RoomUI'

const PAGE_SIZE = 10

// Chip trạng thái báo thức trên da phòng: "Đã gửi" là cú chuông — Bell; "Đã hoãn"
// là chờ và "Đã hủy" là hủy — Rain; "Đã tắt" là kết thúc trung tính — Oat. Nhãn
// đọc từ NOTIFICATION_ACTION nên chuỗi giữ nguyên, chỉ thay màu.
const ACTION_TONES = {
  SENT: 'bg-room-bell/25 text-room-ink/75 ring-room-bell/40',
  SNOOZED: 'bg-room-rain/40 text-room-ink/70 ring-room-rain',
  DISMISSED: 'bg-room-oat/60 text-room-ink/65 ring-room-acorn/20',
  CANCELLED: 'bg-room-rain/60 text-room-ink/75 ring-room-rain',
}

function RoomActionChip({ action }) {
  const a = NOTIFICATION_ACTION[action]
  if (!a) return null
  const tone = ACTION_TONES[action] || ACTION_TONES.DISMISSED
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ring-1 ring-inset ${tone}`}>
      {a.label}
    </span>
  )
}

export default function NotificationHistoryPage() {
  const [page, setPage] = useState(1)
  const [range, setRange] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const now = new Date()
      let from
      if (range === 'today') from = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      else if (range === '7d') from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)
      else if (range === '30d') from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29)
      const res = await getNotificationLogs({ from: from?.toISOString(), page, pageSize: PAGE_SIZE })
      if (!cancelled && res.success) setData(res.data)
      if (!cancelled) setLoading(false)
    })()
    return () => {
      cancelled = true
    }
     
  }, [page, range])

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-room-ink">Lịch sử thông báo</h1>
          <p className="mt-1 text-sm font-semibold text-room-ink/60">
            Mọi báo thức đã gửi, đã hoãn hay đã tắt đều được ghi lại
          </p>
        </div>
        <RoomSegmented
          size="sm"
          options={[
            { value: '', label: 'Tất cả' },
            { value: 'today', label: 'Hôm nay' },
            { value: '7d', label: '7 ngày' },
            { value: '30d', label: '30 ngày' },
          ]}
          value={range}
          onChange={(v) => {
            setRange(v)
            setPage(1)
          }}
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <RoomSkeleton key={i} className="h-16" />
          ))}
        </div>
      ) : data && data.items.length === 0 ? (
        <RoomCard className="p-6">
          <RoomEmpty
            icon={ClockCounterClockwise}
            title="Chưa có thông báo nào được gửi"
            description="Khi bạn thiết lập nhắc nhở và đến giờ, lịch sử gửi sẽ xuất hiện tại đây."
          />
        </RoomCard>
      ) : (
        <>
          <div className="space-y-2.5">
            {data?.items.map((log) => (
              <RoomCard
                as="article"
                key={log.id}
                className="flex items-center gap-4 p-4"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-room-bell/25 ring-1 ring-inset ring-room-bell/40">
                  <Bell size={20} weight="duotone" className="text-room-bell" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-room-ink/85">{log.taskTitle}</p>
                  <p className="mt-0.5 text-xs font-semibold text-room-ink/65">
                    {formatDateTime(log.sentAt)} · {log.deviceName} · {relativeTime(log.sentAt)}
                  </p>
                </div>
                <RoomActionChip action={log.action} />
              </RoomCard>
            ))}
          </div>
          {totalPages > 1 && (
            <nav className="mt-6 flex items-center justify-center gap-3" aria-label="Phân trang">
              <RoomButton variant="secondary" size="sm" icon={ArrowLeft} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Trước
              </RoomButton>
              <span className="text-sm font-bold text-room-ink/60">Trang {page} / {totalPages}</span>
              <RoomButton variant="secondary" size="sm" icon={ArrowRight} disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Sau
              </RoomButton>
            </nav>
          )}
        </>
      )}
    </div>
  )
}
