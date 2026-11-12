import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, Check, Clock, ArrowsClockwise, Bell, ChatCircleText } from '@phosphor-icons/react'
import { getAssignedTasks, setAssignedDone } from '../../services/taskService'
import { useToast } from '../../components/common/Toast'
import Avatar from '../../components/common/Avatar'
import { PriorityBadge, CategoryBadge } from '../../components/common/Badge'
import { RoomButton, RoomCard, RoomEmpty, RoomSkeleton } from '../../components/common/RoomUI'
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

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-5 animate-fade-in">
        <div className="flex items-end justify-between gap-3">
          <div className="space-y-2">
            <RoomSkeleton className="h-8 w-64" />
            <RoomSkeleton className="h-5 w-80" />
          </div>
          <RoomSkeleton className="h-9 w-56 rounded-full" />
        </div>
        <RoomSkeleton className="h-40" />
        <RoomSkeleton className="h-40" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-room-ink">
            <Users size={26} weight="duotone" className="text-room-acorn" />
            Việc được giao
          </h1>
          <p className="mt-1 text-sm font-semibold text-room-ink/60">
            Việc người khác nhờ bạn làm. Bạn vẫn nhận chuông nhắc như việc của mình, và chỉ cần
            báo xong phần của bạn.
          </p>
        </div>
        {done.length > 0 && (
          <button
            type="button"
            onClick={() => setShowDone((s) => !s)}
            className="cursor-pointer rounded-full bg-room-paper px-3.5 py-1.5 text-xs font-bold text-room-ink/70 ring-1 ring-inset ring-room-acorn/30 transition hover:-translate-y-px hover:bg-room-oat/60 hover:text-room-ink"
          >
            {showDone ? `Chỉ hiện việc chưa xong (${open.length})` : `Hiện cả việc đã báo xong (${done.length})`}
          </button>
        )}
      </div>

      {visible.length === 0 ? (
        <RoomCard className="p-6">
          <RoomEmpty
            icon={Users}
            title={items.length === 0 ? 'Chưa ai nhờ bạn việc gì' : 'Bạn đã làm xong hết phần của mình'}
            description={
              items.length === 0
                ? 'Khi ai đó nhờ bạn làm việc, nó sẽ hiện ở đây kèm chuông nhắc — bạn không cần cài gì thêm.'
                : 'Hiện cả việc đã báo xong để xem lại nếu cần.'
            }
            className="py-10"
          />
        </RoomCard>
      ) : (
        <ul className="space-y-3">
          {visible.map((item) => {
            // timeUntil trả null khi đã qua hạn — nối thẳng vào chuỗi sẽ ra "còn null"
            const left = !item.isDone && !item.closed ? timeUntil(item.dueAt) : null
            return (
            <li key={item.shareId} className="rounded-2xl bg-room-paper p-4 ring-1 ring-room-acorn/25 transition hover:ring-room-acorn/50 sm:p-5">
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => onToggle(item)}
                  disabled={busyId === item.taskId || item.closed}
                  aria-label={item.isDone ? `Bỏ đánh dấu xong: ${item.title}` : `Báo xong: ${item.title}`}
                  className={`mt-0.5 flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 transition disabled:cursor-not-allowed disabled:opacity-40 ${
                    item.isDone
                      ? 'border-room-sage bg-room-sage text-room-paper'
                      : 'border-room-acorn/40 text-transparent hover:border-room-sage'
                  }`}
                >
                  <Check size={13} weight="bold" />
                </button>

                <div className="min-w-0 flex-1">
                  <p
                    className={`font-bold ${
                      item.isDone ? 'text-room-ink/55 line-through' : 'text-room-ink/90'
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
                      <span className="inline-flex items-center gap-1 rounded-full bg-room-bell/25 px-2 py-0.5 text-[11px] font-bold text-room-ink/80 ring-1 ring-inset ring-room-bell/40">
                        <ArrowsClockwise size={12} weight="bold" className="text-room-bell" /> Đến lượt bạn
                      </span>
                    )}
                    {item.closed && (
                      <span className="rounded-full bg-room-oat/60 px-2 py-0.5 text-[11px] font-bold text-room-ink/60">
                        Chủ việc đã kết thúc
                      </span>
                    )}
                  </div>

                  <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold text-room-ink/65">
                    <span className={`inline-flex items-center gap-1.5 ${item.dueOverdue && !item.isDone ? 'rounded-md bg-room-blush/45 px-1.5 py-0.5 font-bold text-room-ink/85 dark:bg-room-blush/30' : ''}`}>
                      <Clock size={14} weight="bold" />
                      {formatRelativeDay(item.dueAt)} · {formatDateTime(item.dueAt)}
                      {left ? ` · còn ${left}` : ''}
                    </span>
                    {item.nextReminderAt && (
                      <span className="inline-flex items-center gap-1.5 text-room-bell">
                        <Bell size={14} weight="bold" /> chuông gần nhất {formatDateTime(item.nextReminderAt)}
                      </span>
                    )}
                  </p>

                  {item.description && (
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-room-ink/65">
                      {item.description}
                    </p>
                  )}

                  {item.note && (
                    <p className="mt-2 flex items-start gap-1.5 rounded-xl bg-room-oat/35 p-2.5 text-xs font-semibold text-room-ink/70 ring-1 ring-inset ring-room-acorn/15">
                      <ChatCircleText size={14} weight="bold" className="mt-0.5 shrink-0 text-room-acorn" />
                      <span>“{item.note}”</span>
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs font-semibold text-room-ink/60">
                    <span className="inline-flex items-center gap-1.5">
                      <Avatar
                        name={item.assignedBy?.fullName || '?'}
                        src={item.assignedBy?.avatarUrl || ''}
                        size="sm"
                        skin="room"
                      />
                      {item.assignedBy?.fullName || 'Ai đó'} nhờ bạn
                    </span>
                    {item.isDone && item.doneAt && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-room-sage/45 px-2 py-0.5 font-bold text-room-ink/80 ring-1 ring-inset ring-room-acorn/20">
                        <Check size={14} weight="bold" /> Bạn đã báo xong {formatDateTime(item.doneAt)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {!item.closed && (
                <div className="mt-3 flex flex-wrap gap-2 border-t border-room-acorn/15 pt-3">
                  <RoomButton
                    variant={item.isDone ? 'secondary' : 'primary'}
                    size="sm"
                    icon={item.isDone ? ArrowsClockwise : Check}
                    onClick={() => onToggle(item)}
                    loading={busyId === item.taskId}
                  >
                    {item.isDone ? 'Bỏ đánh dấu xong' : 'Tôi đã làm xong phần của tôi'}
                  </RoomButton>
                </div>
              )}
            </li>
            )
          })}
        </ul>
      )}

      <p className="text-center text-xs font-semibold text-room-ink/60">
        Muốn nhờ người khác làm việc của bạn?{' '}
        <Link to="/app/billing" className="font-bold text-room-ink underline decoration-room-acorn/40 decoration-dotted decoration-2 underline-offset-4 transition hover:text-room-acorn">
          Mở khoá giao việc với gói Pro
        </Link>
      </p>
    </div>
  )
}
