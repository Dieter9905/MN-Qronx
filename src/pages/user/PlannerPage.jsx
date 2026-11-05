import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarCheck,
  CheckCircle,
  WarningCircle,
  LockSimple,
  ArrowRight,
  ArrowClockwise,
  Alarm,
  Clock,
  Sparkle,
  ListChecks,
  CalendarBlank,
} from '@phosphor-icons/react'
import {
  RoomButton,
  RoomCard,
  RoomEmpty,
  RoomSegmented,
  RoomSkeleton,
} from '../../components/common/RoomUI'
import { useToast } from '../../components/common/Toast'
import { useAuth } from '../../context/AuthContext'
import { useCachedQuery } from '../../lib/useCachedQuery'
import { getWeekPlan } from '../../services/plannerService'
import { completeTask, rescheduleTask } from '../../services/taskService'
import { PRIORITY, isProPlan } from '../../lib/constants'
import { addDays, setTime } from '../../lib/format'

// ─── Kế hoạch tuần (gói Pro) ────────────────────────────────
//
// Danh sách công việc trả lời "có những việc gì"; trang này trả lời "HÔM NAY làm
// gì". Toàn bộ việc xếp do backend làm (plannerService.js) — giao diện chỉ vẽ ra,
// không tự sắp xếp lại, để hai nơi không bao giờ ra hai kế hoạch khác nhau.
//
// Nguyên tắc quan trọng nhất của trang: KHÔNG giấu việc sẽ trễ. Khách trả tiền để
// biết trước rằng tuần này quá tải, chứ không phải để xem một kế hoạch trông đẹp
// rồi vỡ. Vì vậy khung cảnh báo quá tải là phần nổi bật nhất trang.

const CAPACITIES = [
  { value: 3, label: '3 việc' },
  { value: 5, label: '5 việc' },
  { value: 8, label: '8 việc' },
  { value: 10, label: '10 việc' },
]

function PriorityChip({ item }) {
  const p = PRIORITY[item.priority]
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-room-oat/60 px-2.5 py-0.5 text-[11px] font-bold text-room-ink/55">
      <span className={`h-1.5 w-1.5 rounded-full ${p?.dot || 'bg-room-ink/40'}`} aria-hidden="true" />
      {item.priorityLabel}
    </span>
  )
}

// Khối lỗi da phòng — Rain trung tính thay ErrorNotice rose của Feedback
// (thế giới phòng không có màu đỏ; Rain nói "chờ/xem lại từ bên ngoài")
function RoomErrorNotice({ message, onRetry, className = '' }) {
  return (
    <div className={`flex flex-wrap items-center justify-between gap-2 rounded-xl bg-room-rain/30 p-4 ring-1 ring-room-rain ${className}`}>
      <p className="text-sm font-semibold text-room-ink/85">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="cursor-pointer rounded-xl bg-room-paper px-3 py-2 text-sm font-bold text-room-ink ring-1 ring-inset ring-room-acorn/25 transition hover:bg-room-oat/75"
        >
          Thử lại
        </button>
      )}
    </div>
  )
}

function LockedPanel() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex flex-wrap items-center gap-2 font-display text-2xl font-bold text-room-ink">
          Kế hoạch tuần
          <span className="rounded-full bg-room-oat/70 px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-room-ink/60 ring-1 ring-inset ring-room-acorn/25">
            Pro
          </span>
        </h1>
        <p className="mt-1 text-sm font-semibold text-room-ink/55">
          Mỗi ngày nên làm việc nào — và biết trước khi tuần bị quá tải.
        </p>
      </div>

      <RoomCard className="p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-room-oat/45 text-room-acorn ring-1 ring-inset ring-room-acorn/25">
            <LockSimple size={22} weight="duotone" />
          </span>
          <div>
            <h2 className="font-display font-bold text-room-ink">Kế hoạch tuần là tính năng của gói Pro</h2>
            <p className="mt-1 text-sm font-semibold text-room-ink/55">
              Nâng cấp Pro để app tự xếp việc vào từng ngày và cảnh báo khi bạn nhận nhiều hơn sức mình.
            </p>
          </div>
        </div>

        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {[
            { icon: CalendarCheck, text: 'Xếp 7 ngày tới: việc quá hạn lên trước, rồi theo hạn và mức ưu tiên' },
            { icon: WarningCircle, text: 'Nói thật khi tuần quá tải: việc nào sẽ trễ nếu giữ nhịp này' },
            { icon: ListChecks, text: 'Chọn sức mình mỗi ngày: 3, 5, 8 hay 10 việc' },
            { icon: Clock, text: 'Gợi ý đặt việc khó nhất vào giờ vàng của chính bạn' },
            { icon: CheckCircle, text: 'Đánh dấu xong hoặc dời hạn ngay trên kế hoạch, không phải mở từng việc' },
            { icon: CalendarBlank, text: 'Thấy luôn việc của tuần sau để không bị dồn vào phút cuối' },
          ].map((f) => (
            <li
              key={f.text}
              className="flex items-start gap-2.5 rounded-xl bg-room-oat/35 p-3 ring-1 ring-inset ring-room-acorn/15"
            >
              <f.icon size={18} weight="duotone" className="mt-0.5 shrink-0 text-room-acorn" />
              <span className="text-xs font-semibold leading-relaxed text-room-ink/60">{f.text}</span>
            </li>
          ))}
        </ul>

        <Link to="/app/billing" className="mt-5 inline-block">
          <RoomButton icon={Sparkle}>
            Nâng cấp Pro
          </RoomButton>
        </Link>
      </RoomCard>
    </div>
  )
}

/**
 * Hạn mới khi khách bấm "dời hạn": lùi 3 ngày, nhưng không bao giờ rơi vào quá khứ
 * (API từ chối hạn trong quá khứ — và dời sang một mốc đã qua thì vô nghĩa).
 */
function nextDeadline(dueAt) {
  const pushed = setTime(addDays(new Date(dueAt), 3), 9)
  const tomorrow = setTime(addDays(new Date(), 1), 9)
  return (pushed > tomorrow ? pushed : tomorrow).toISOString()
}

/** "Dời sang mai" luôn là mốc 9 giờ sáng mai (giờ địa phương của máy khách). */
function tomorrowMorning() {
  return setTime(addDays(new Date(), 1), 9).toISOString()
}

export default function PlannerPage() {
  const { user } = useAuth()
  const toast = useToast()
  const [capacity, setCapacity] = useState(5)
  const [busyId, setBusyId] = useState(null)

  const isPro = isProPlan(user?.plan)

  // Gói chưa có quyền thì không gọi API (server cũng từ chối) — tránh vừa hiện
  // khung khoá vừa hiện thông báo lỗi đỏ.
  const fetcher = () => (isPro ? getWeekPlan({ capacity }) : Promise.resolve({ success: true, data: null }))
  const { data, loading, error, slow, reload } = useCachedQuery(`planner-${capacity}`, fetcher)

  const summary = data?.summary
  const days = useMemo(() => data?.days ?? [], [data])

  const markDone = async (item) => {
    setBusyId(item.taskId)
    try {
      const res = await completeTask(item.taskId)
      if (!res.success) {
        toast.error(res.message)
        return
      }
      toast.success(`Đã xong: ${item.title}`)
      reload()
    } finally {
      setBusyId(null)
    }
  }

  const move = async (item, dueAt, note) => {
    setBusyId(item.taskId)
    try {
      const res = await rescheduleTask(item.taskId, dueAt)
      if (!res.success) {
        toast.error(res.message)
        return
      }
      toast.success(note)
      reload()
    } finally {
      setBusyId(null)
    }
  }

  if (!isPro) return <LockedPanel />

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <RoomSkeleton className="h-8 w-64" />
        <RoomSkeleton className="h-28" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <RoomSkeleton key={i} className="h-44" />
          ))}
        </div>
      </div>
    )
  }

  if (error && !data) return <RoomErrorNotice message={error} onRetry={reload} />

  return (
    <div className="space-y-6">
      {/* ── Đầu trang + chọn sức mình ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex flex-wrap items-center gap-2 font-display text-2xl font-bold text-room-ink">
            <CalendarCheck size={26} weight="duotone" className="text-room-acorn" />
            Kế hoạch tuần
            <span className="rounded-full bg-room-oat/70 px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-room-ink/60 ring-1 ring-inset ring-room-acorn/25">
              Pro
            </span>
          </h1>
          <p className="mt-1 text-sm font-semibold text-room-ink/50">
            {data?.range?.from?.split('-').reverse().join('/')} → {data?.range?.to?.split('-').reverse().join('/')}
            {slow && ' · máy chủ đang khởi động…'}
          </p>
        </div>

        <div className="no-print flex flex-wrap items-center gap-2">
          <RoomSegmented options={CAPACITIES} value={capacity} onChange={setCapacity} size="sm" />
          <RoomButton variant="secondary" size="sm" icon={ArrowClockwise} onClick={reload}>
            Xếp lại
          </RoomButton>
        </div>
      </div>

      {error && data && <RoomErrorNotice message={`${error} — đang hiện kế hoạch lần trước.`} onRetry={reload} />}

      {/* ── Quá tải hay không: phần quan trọng nhất của trang ── */}
      {summary && (
        <section
          className={`overflow-hidden rounded-2xl p-5 ring-1 sm:p-6 ${
            summary.overloaded
              ? 'bg-room-bell/25 ring-room-bell/40'
              : 'bg-room-sage/25 ring-room-acorn/20'
          }`}
        >
          <p className="flex items-start gap-3 text-sm font-semibold leading-relaxed text-room-ink sm:text-base">
            {summary.overloaded ? (
              <WarningCircle size={22} weight="fill" className="mt-0.5 shrink-0 text-room-bell" />
            ) : (
              <CheckCircle size={22} weight="fill" className="mt-0.5 shrink-0 text-room-acorn" />
            )}
            <span>
              {summary.overloaded ? (
                <>
                  Tuần này bạn có <strong>{summary.openCount} việc</strong> cần làm nhưng kế hoạch chỉ đủ chỗ cho{' '}
                  <strong>{summary.seats} việc</strong>. Giữ nhịp này thì{' '}
                  <strong>{summary.atRiskCount} việc sẽ trễ hạn</strong> — hãy dồn sớm, dời hạn, hoặc bỏ bớt việc
                  không thật sự cần làm.
                </>
              ) : (
                <>
                  Tuần này vừa sức: <strong>{summary.openCount} việc</strong> cần làm, kế hoạch còn{' '}
                  <strong>{summary.seatsLeft} chỗ trống</strong>. Mỗi việc nằm đúng ngày đến hạn, nên ngày nào trống là
                  ngày đó bạn thật sự rảnh.
                </>
              )}
            </span>
          </p>

          <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold">
            <span className="rounded-full bg-room-paper px-3 py-1 text-room-ink/70">Quá hạn: {summary.overdueCount}</span>
            <span className="rounded-full bg-room-paper px-3 py-1 text-room-ink/70">Đến hạn hôm nay: {summary.dueTodayCount}</span>
            <span className="rounded-full bg-room-paper px-3 py-1 text-room-ink/70">Đã xếp: {summary.planned}/{summary.seats}</span>
            {summary.laterCount > 0 && (
              <span className="rounded-full bg-room-paper px-3 py-1 text-room-ink/70">Tuần sau: {summary.laterCount} việc</span>
            )}
          </div>
        </section>
      )}

      {/* ── Việc sẽ trễ nếu giữ nhịp này ── */}
      {data?.atRisk?.length > 0 && (
        <section className="rounded-2xl bg-room-paper p-5 ring-1 ring-room-bell/40 sm:p-6">
          <h2 className="flex items-center gap-2 font-display font-bold text-room-ink">
            <WarningCircle size={19} weight="fill" className="text-room-bell" />
            Sẽ trễ hạn nếu giữ kế hoạch này ({data.atRisk.length} việc)
          </h2>
          <p className="mt-1 text-xs font-semibold text-room-ink/55">
            Dời hạn chỉ nên bấm khi hạn thật sự linh động — nếu là việc phải xong đúng hạn thì hãy dồn vào hôm nay.
          </p>
          <ul className="mt-3 divide-y divide-room-acorn/15">
            {data.atRisk.slice(0, 10).map((r) => (
              <li key={r.taskId} className="flex flex-wrap items-center gap-2 py-3">
                <Link
                  to={`/app/tasks/${r.taskId}`}
                  className="flex-1 font-semibold text-room-ink/85 transition hover:text-room-acorn"
                >
                  {r.title}
                </Link>
                <PriorityChip item={r} />
                <span className="rounded-full bg-room-bell/25 px-2.5 py-0.5 text-[11px] font-extrabold text-room-ink ring-1 ring-inset ring-room-bell/50">
                  Trễ {r.willBeLateDays} ngày
                </span>
                <span className="text-[11px] font-semibold text-room-ink/45">
                  {r.plannedFor ? `dự kiến ${r.plannedFor.split('-').reverse().join('/')}` : 'không còn chỗ trong tuần'}
                </span>
                <RoomButton
                  variant="secondary"
                  size="sm"
                  loading={busyId === r.taskId}
                  onClick={() => move(r, nextDeadline(r.dueAt), `Đã dời hạn: ${r.title}`)}
                >
                  Dời hạn 3 ngày
                </RoomButton>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Giờ vàng ── */}
      {data?.goldenHour?.hour != null && (
        <RoomCard className="flex flex-wrap items-center gap-3 p-4 sm:p-5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-room-bell/25 ring-1 ring-inset ring-room-bell/40">
            <Clock size={20} weight="duotone" className="text-room-bell" />
          </span>
          <p className="text-sm font-semibold text-room-ink/70">
            Giờ vàng của bạn là{' '}
            <strong className="font-extrabold text-room-ink">{data.goldenHour.hour}h</strong> — hãy đặt
            việc trọng tâm của mỗi ngày (việc đầu tiên) vào khoảng đó.
          </p>
        </RoomCard>
      )}

      {/* ── 7 ngày ── */}
      {summary?.openCount === 0 && data?.laterCount === 0 ? (
        <RoomEmpty
          icon={CalendarBlank}
          title="Chưa có việc nào cần làm trong tuần này"
          description="Tạo vài công việc có hạn trong tuần là app tự xếp lịch cho bạn."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {days.map((day) => (
            <section
              key={day.date}
              className={`rounded-2xl bg-room-paper p-4 ${
                day.isToday ? 'ring-2 ring-room-acorn' : 'ring-1 ring-room-acorn/25'
              }`}
            >
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-display font-bold text-room-ink">
                  {day.isToday ? 'Hôm nay' : day.weekday}
                  <span className="text-xs font-semibold text-room-ink/45">
                    {day.dayNumber}/{day.month}
                  </span>
                </h2>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-extrabold ${
                    day.load >= day.capacity
                      ? 'bg-room-bell/25 text-room-ink ring-1 ring-inset ring-room-acorn/20'
                      : 'bg-room-oat/70 text-room-ink/60'
                  }`}
                >
                  {day.load}/{day.capacity}
                </span>
              </div>

              {day.items.length === 0 ? (
                <p className="mt-3 text-xs font-semibold text-room-ink/45">Ngày này trống.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {day.items.map((item) => (
                    <li
                      key={item.taskId}
                      className="rounded-xl bg-room-oat/40 p-3 ring-1 ring-inset ring-room-acorn/15"
                    >
                      <div className="flex items-start gap-2">
                        <button
                          type="button"
                          onClick={() => markDone(item)}
                          disabled={busyId === item.taskId}
                          title="Đánh dấu đã xong"
                          className="mt-0.5 shrink-0 cursor-pointer text-room-ink/30 transition hover:text-room-sage disabled:opacity-50"
                        >
                          <CheckCircle size={18} weight="bold" />
                        </button>
                        <div className="min-w-0 flex-1">
                          <Link
                            to={`/app/tasks/${item.taskId}`}
                            className={`block truncate text-sm font-semibold transition hover:text-room-acorn ${
                              item.focus ? 'text-room-ink' : 'text-room-ink/75'
                            }`}
                            title={item.title}
                          >
                            {item.focus && <Sparkle size={11} weight="fill" className="mr-1 inline text-room-bell" />}
                            {item.title}
                          </Link>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <PriorityChip item={item} />
                            {item.overdue && (
                              <span className="rounded-full bg-room-blush/45 px-2 py-0.5 text-[10px] font-extrabold on-blush ring-1 ring-room-acorn/20 dark:bg-room-blush/30">
                                {/* Việc hết hạn trong ngày hôm nay: "Quá hạn 0 ngày" đọc rất vô nghĩa */}
                                {item.daysLate > 0 ? `Quá hạn ${item.daysLate} ngày` : 'Quá hạn hôm nay'}
                              </span>
                            )}
                            {!item.overdue && item.willBeLateDays > 0 && (
                              <span className="rounded-full bg-room-bell/25 px-2 py-0.5 text-[10px] font-extrabold text-room-ink ring-1 ring-inset ring-room-bell/50">
                                Trễ {item.willBeLateDays} ngày
                              </span>
                            )}
                            {item.nagEveryMinutes && (
                              <span className="flex items-center gap-1 rounded-full bg-room-bell/20 px-2 py-0.5 text-[10px] font-bold text-room-bell">
                                <Alarm size={10} weight="fill" />
                                {item.nagEveryMinutes} phút
                              </span>
                            )}
                            {item.categoryName && (
                              <span className="rounded-full bg-room-oat/60 px-2 py-0.5 text-[10px] font-semibold text-room-ink/55">
                                {item.categoryName}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {item.overdue && (
                        <div className="mt-2 flex justify-end">
                          <button
                            type="button"
                            disabled={busyId === item.taskId}
                            onClick={() => move(item, tomorrowMorning(), `Đã dời sang mai: ${item.title}`)}
                            className="cursor-pointer rounded-xl px-2.5 py-1 text-[11px] font-bold text-room-ink/60 ring-1 ring-inset ring-room-acorn/25 transition hover:bg-room-oat/75 hover:text-room-ink disabled:opacity-50"
                          >
                            Dời sang mai
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}

      {/* ── Tuần sau ── */}
      {data?.later?.length > 0 && (
        <RoomCard className="p-5 sm:p-6">
          <h2 className="flex items-center gap-2 font-display font-bold text-room-ink">
            <CalendarBlank size={19} weight="fill" className="text-room-rain" />
            Tuần sau chưa đưa vào kế hoạch ({data.laterCount} việc)
          </h2>
          <ul className="mt-3 divide-y divide-room-acorn/15">
            {data.later.map((t) => (
              <li key={t.taskId} className="flex flex-wrap items-center gap-2 py-2.5">
                <Link
                  to={`/app/tasks/${t.taskId}`}
                  className="flex-1 text-sm font-semibold text-room-ink/75 transition hover:text-room-acorn"
                >
                  {t.title}
                </Link>
                <PriorityChip item={t} />
                <span className="text-[11px] font-semibold text-room-ink/45">
                  Hạn {new Date(t.dueAt).toLocaleDateString('vi-VN')}
                </span>
                <ArrowRight size={14} className="text-room-ink/25" />
              </li>
            ))}
          </ul>
        </RoomCard>
      )}

      <p className="text-center text-[11px] font-semibold text-room-ink/40">
        Cách xếp: việc quá hạn lên ngày đầu, mỗi việc còn lại nằm đúng ngày đến hạn — ngày nào hết chỗ thì việc dồn
        sang ngày sau và được cảnh báo là sẽ trễ (app không tự đẩy việc chưa tới hạn lên trước). Chỉ tính công việc
        đang mở, theo giờ Việt Nam; số việc mỗi ngày lưu trên thiết bị này.
      </p>
    </div>
  )
}
