import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, Check, Clock, ArrowsClockwise, Bell, ChatCircleText } from '@phosphor-icons/react'
import { getAssignedTasks, setAssignedDone } from '../../services/taskService'
import { useToast } from '../../components/common/Toast'
import { PageLoader, EmptyState } from '../../components/common/Feedback'
import Button from '../../components/common/Button'
import { PriorityBadge, CategoryBadge } from '../../components/common/Badge'
import Avatar from '../../components/common/Avatar'
import { formatDateTime, formatRelativeDay, timeUntil } from '../../lib/format'

// ─── Việc được giao (mặt NGƯỜI NHẬN của tính năng giao việc) ──
//
// Người nhận KHÔNG cần gói trả phí: họ chỉ thấy đúng việc người khác nhờ mình, đọc
// lời nhắn kèm theo, và báo xong. Cố ý không có nút Sửa/Xoá — đó là việc của chủ
// việc, và cho người nhận sửa được thì "nhờ làm" biến thành "ai cũng đổi được".
//
// Trang này là lý do khách Free nên nâng cấp: họ thấy người khác giao việc cho mình
// chạy trơn tru, nên khi cần nhờ lại người khác, việc trả tiền là lẽ tự nhiên.

export default function AssignedPage() {
  const toast = useToast()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [showDone, setShowDone] = useState(false)

  const load = async () => {
    const res = await getAssignedTasks()
    if (!res.success) {
      toast.error(res.message)
      setLoading(false)
      return
    }
    setItems(res.data || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const open = useMemo(() => items.filter((i) => !i.isDone), [items])
  const done = useMemo(() => items.filter((i) => i.isDone), [items])
  const visible = showDone ? items : open

  const onToggle = async (item) => {
    setBusyId(item.taskId)
    const res = await setAssignedDone(item.taskId, !item.isDone)
    setBusyId(null)
    if (!res.success) {
      toast.error(res.message)
      return
    }
    toast.success(item.isDone ? 'Đã bỏ đánh dấu xong' : 'Đã báo xong — chủ việc được thông báo')
    // Cập nhật tại chỗ trước, rồi tải lại để khớp số liệu máy chủ
    setItems((prev) =>
      prev.map((i) => (i.taskId === item.taskId ? { ...i, isDone: !i.isDone, doneAt: res.data?.doneAt } : i))
    )
    load()
  }

  if (loading) return <PageLoader />

  return (
    <div className="mx-auto max-w-3xl space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-navy-900 dark:text-white">
            <Users size={24} weight="fill" className="text-violet-600 dark:text-violet-400" />
            Việc được giao
          </h1>
          <p className="mt-1 text-sm text-navy-500 dark:text-slate-400">
            Việc người khác nhờ bạn làm. Bạn vẫn nhận chuông nhắc như việc của mình, và chỉ cần
            báo xong phần của bạn.
          </p>
        </div>
        {done.length > 0 && (
          <button
            type="button"
            onClick={() => setShowDone((s) => !s)}
            className="cursor-pointer rounded-full bg-navy-50 px-3.5 py-1.5 text-xs font-bold text-navy-600 ring-1 ring-inset ring-navy-100 transition hover:bg-blue-50 hover:text-blue-700 dark:bg-slate-700 dark:text-slate-300 dark:ring-slate-600"
          >
            {showDone ? `Chỉ hiện việc chưa xong (${open.length})` : `Hiện cả việc đã báo xong (${done.length})`}
          </button>
        )}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={Users}
          title={items.length === 0 ? 'Chưa ai nhờ bạn việc gì' : 'Bạn đã làm xong hết phần của mình'}
          description={
            items.length === 0
              ? 'Khi ai đó nhờ bạn làm việc, nó sẽ hiện ở đây kèm chuông nhắc — bạn không cần cài gì thêm.'
              : 'Hiện cả việc đã báo xong để xem lại nếu cần.'
          }
          className="py-14"
        />
      ) : (
        <ul className="space-y-3">
          {visible.map((item) => {
            // timeUntil trả null khi đã qua hạn — nối thẳng vào chuỗi sẽ ra "còn null"
            const left = !item.isDone && !item.closed ? timeUntil(item.dueAt) : null
            return (
            <li key={item.shareId} className="card p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => onToggle(item)}
                  disabled={busyId === item.taskId || item.closed}
                  aria-label={item.isDone ? `Bỏ đánh dấu xong: ${item.title}` : `Báo xong: ${item.title}`}
                  className={`mt-0.5 flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 transition disabled:cursor-not-allowed disabled:opacity-40 ${
                    item.isDone
                      ? 'border-emerald-500 bg-emerald-500 text-white'
                      : 'border-navy-200 text-transparent hover:border-emerald-500'
                  }`}
                >
                  <Check size={13} weight="bold" />
                </button>

                <div className="min-w-0 flex-1">
                  <p
                    className={`font-bold ${
                      item.isDone ? 'text-navy-300 line-through dark:text-slate-500' : 'text-navy-900 dark:text-white'
                    }`}
                  >
                    {item.title}
                  </p>

                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <PriorityBadge priority={item.priority} />
                    {item.category && <CategoryBadge category={item.category} />}
                    {/* Việc luân phiên: nói thẳng kỳ này đến lượt ai. Không có nhãn
                        này thì mọi việc trông giống nhau và người đến lượt không
                        biết mình đang bị chờ. */}
                    {item.isMyTurn && !item.isDone && !item.closed && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800 ring-1 ring-inset ring-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:ring-amber-800">
                        <ArrowsClockwise size={12} weight="bold" /> Đến lượt bạn
                      </span>
                    )}
                    {item.closed && (
                      <span className="rounded-full bg-navy-100 px-2 py-0.5 text-[11px] font-bold text-navy-500 dark:bg-slate-700 dark:text-slate-400">
                        Chủ việc đã kết thúc
                      </span>
                    )}
                  </div>

                  <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium text-navy-500 dark:text-slate-400">
                    <span className={`inline-flex items-center gap-1.5 ${item.dueOverdue && !item.isDone ? 'font-bold text-rose-600 dark:text-rose-400' : ''}`}>
                      <Clock size={14} weight="bold" />
                      {formatRelativeDay(item.dueAt)} · {formatDateTime(item.dueAt)}
                      {left ? ` · còn ${left}` : ''}
                    </span>
                    {item.nextReminderAt && (
                      <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                        <Bell size={14} weight="bold" /> chuông gần nhất {formatDateTime(item.nextReminderAt)}
                      </span>
                    )}
                  </p>

                  {item.description && (
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-navy-600 dark:text-slate-300">
                      {item.description}
                    </p>
                  )}

                  {item.note && (
                    <p className="mt-2 flex items-start gap-1.5 rounded-xl bg-violet-50 p-2.5 text-xs font-medium text-violet-800 ring-1 ring-inset ring-violet-100 dark:bg-violet-900/20 dark:text-violet-200 dark:ring-violet-800">
                      <ChatCircleText size={14} weight="bold" className="mt-0.5 shrink-0" />
                      <span>“{item.note}”</span>
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-navy-400 dark:text-slate-500">
                    <span className="inline-flex items-center gap-1.5">
                      <Avatar
                        name={item.assignedBy?.fullName || '?'}
                        src={item.assignedBy?.avatarUrl || ''}
                        size="sm"
                      />
                      {item.assignedBy?.fullName || 'Ai đó'} nhờ bạn
                    </span>
                    {item.isDone && item.doneAt && (
                      <span className="inline-flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400">
                        <Check size={14} weight="bold" /> Bạn đã báo xong {formatDateTime(item.doneAt)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {!item.closed && (
                <div className="mt-3 flex flex-wrap gap-2 border-t border-navy-100 pt-3 dark:border-slate-700">
                  <Button
                    variant={item.isDone ? 'secondary' : 'gradient'}
                    size="sm"
                    icon={item.isDone ? ArrowsClockwise : Check}
                    onClick={() => onToggle(item)}
                    loading={busyId === item.taskId}
                  >
                    {item.isDone ? 'Bỏ đánh dấu xong' : 'Tôi đã làm xong phần của tôi'}
                  </Button>
                </div>
              )}
            </li>
            )
          })}
        </ul>
      )}

      <p className="text-center text-xs text-navy-400 dark:text-slate-500">
        Muốn nhờ người khác làm việc của bạn?{' '}
        <Link to="/app/billing" className="font-bold underline">
          Mở khoá giao việc với gói Pro
        </Link>
      </p>
    </div>
  )
}
