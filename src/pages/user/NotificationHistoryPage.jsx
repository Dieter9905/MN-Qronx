import { useEffect, useState } from 'react'
import { Bell, ArrowLeft, ArrowRight, ClockCounterClockwise } from '@phosphor-icons/react'
import { getNotificationLogs } from '../../services/notificationService'
import { useToast } from '../../components/common/Toast'
import { Skeleton, EmptyState } from '../../components/common/Feedback'
import Button from '../../components/common/Button'
import { ActionBadge } from '../../components/common/Badge'
import { formatDateTime, relativeTime } from '../../lib/format'

const PAGE_SIZE = 10

export default function NotificationHistoryPage() {
  const toast = useToast()
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, range])

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title dark:text-white">Lịch sử thông báo</h1>
          <p className="mt-1 text-sm font-medium text-navy-400 dark:text-slate-500">
            Mọi báo thức đã gửi, đã hoãn hay đã tắt đều được ghi lại
          </p>
        </div>
        <div className="flex rounded-xl bg-white p-1 shadow-card ring-1 ring-navy-100 dark:bg-slate-800 dark:ring-slate-700">
          {[
            { value: '', label: 'Tất cả' },
            { value: 'today', label: 'Hôm nay' },
            { value: '7d', label: '7 ngày' },
            { value: '30d', label: '30 ngày' },
          ].map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                setRange(o.value)
                setPage(1)
              }}
              className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                range === o.value ? 'bg-navy-900 text-white dark:bg-blue-600' : 'text-navy-500 hover:text-navy-800 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : data && data.items.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={ClockCounterClockwise}
            title="Chưa có thông báo nào được gửi"
            description="Khi bạn thiết lập nhắc nhở và đến giờ, lịch sử gửi sẽ xuất hiện tại đây."
          />
        </div>
      ) : (
        <>
          <div className="space-y-2.5">
            {data?.items.map((log) => (
              <article key={log.id} className="card flex items-center gap-4 p-4 dark:bg-slate-800 dark:ring-slate-700">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-gradient-soft ring-1 ring-blue-100 dark:ring-blue-900/50">
                  <Bell size={20} weight="duotone" className="text-blue-600" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-navy-900 dark:text-white">{log.taskTitle}</p>
                  <p className="mt-0.5 text-xs text-navy-400 dark:text-slate-500">
                    {formatDateTime(log.sentAt)} · {log.deviceName} · {relativeTime(log.sentAt)}
                  </p>
                </div>
                <ActionBadge action={log.action} />
              </article>
            ))}
          </div>
          {totalPages > 1 && (
            <nav className="mt-6 flex items-center justify-center gap-3" aria-label="Phân trang">
              <Button variant="secondary" size="sm" icon={ArrowLeft} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Trước
              </Button>
              <span className="text-sm font-bold text-navy-500">Trang {page} / {totalPages}</span>
              <Button variant="secondary" size="sm" icon={ArrowRight} disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Sau
              </Button>
            </nav>
          )}
        </>
      )}
    </div>
  )
}
