import { Link } from 'react-router-dom'
import {
  CalendarDots,
  WarningCircle,
  CheckCircle,
  ArrowRight,
  Plus,
  Sparkle,
  BellRinging,
  Flame,
  Gift,
  Brain,
  Mountains,
  UserCircle,
} from '@phosphor-icons/react'
import { getDashboard, completeTask } from '../../services/taskService'
import { getMyBilling } from '../../services/billingService'
import { useCachedQuery } from '../../lib/useCachedQuery'
import { SERVER_WAKE_HINT } from '../../lib/useSlowHint'
import { useToast } from '../../components/common/Toast'
import { RoomButton, RoomDots } from '../../components/common/RoomUI'
import TaskItem from '../../components/TaskItem'
import TodayBrief from '../../components/TodayBrief'
import RoomScene from '../../components/landing/RoomScene'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { app } from '../../i18n/app'
import { formatDate } from '../../lib/format'

// Vòng tròn tiến độ (SVG stroke-dasharray) — % hoàn thành chung bảng Thống kê
// nhanh. Da phòng: nét Acorn thuần thay dải 3 màu gradient (giữ đúng logic %).
function ProgressRing({ percent, label }) {
  const r = 54
  const c = 2 * Math.PI * r
  const filled = (Math.min(100, Math.max(0, percent)) / 100) * c
  return (
    <div className="relative h-32 w-32 shrink-0">
      <svg viewBox="0 0 128 128" className="h-full w-full">
        <circle cx="64" cy="64" r={r} fill="none" strokeWidth="10" className="stroke-room-acorn/15" />
        <circle
          cx="64"
          cy="64"
          r={r}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          transform="rotate(-90 64 64)"
          strokeDasharray={`${filled} ${c - filled}`}
          className="stroke-room-acorn"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-2xl font-bold text-room-ink">{percent}%</span>
        <span className="text-xs font-semibold text-room-ink/50">{label}</span>
      </div>
    </div>
  )
}

// Ô số trong tủ phải: cùng dữ liệu, cùng đích như 4 thẻ thống kê cũ —
// da phòng: số Baloo + nhãn trên thẻ giấy nhỏ, không gradient.
function OverviewCell({ icon: Icon, label, value, to }) {
  return (
    <Link
      to={to}
      className="group flex items-center justify-between gap-2 rounded-xl bg-room-paper px-3.5 py-3 ring-1 ring-room-acorn/20 transition-colors hover:ring-room-acorn/45"
    >
      <span className="min-w-0">
        {/* Tay nắm ngăn kéo: chi tiết đồ đạc, không phải icon trang trí */}
        <span aria-hidden="true" className="mb-1.5 block h-1 w-6 rounded-full bg-room-acorn/30" />
        <span className="block font-display text-2xl font-bold leading-none text-room-ink">{value}</span>
        <span className="mt-1 block truncate text-[11.5px] font-bold text-room-ink/55">{label}</span>
      </span>
      <Icon size={17} weight="bold" className="shrink-0 text-room-ink/30 transition group-hover:text-room-acorn" />
    </Link>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  const { lang } = useLanguage()
  const t = app[lang]
  const toast = useToast()
  // Hiện số liệu đã lưu NGAY khi mở, rồi làm mới ở chế độ ngầm: web service gói
  // free của Render có thể đang khởi động 30–60 giây, trước đây màn hình chỉ có
  // skeleton trong suốt thời gian đó, còn nếu request đầu thất bại thì `data`
  // null làm cả trang trắng (không có ErrorBoundary).
  const { data, loading, error, slow, reload } = useCachedQuery('dashboard', getDashboard)
  // Gói sắp hết hạn: chuyển khoản không tự gia hạn được nên phải nhắc ngay trên
  // màn hình chính, không để khách vô tình mất quyền lợi khi quên mua kỳ mới.
  const { data: billing } = useCachedQuery('billing-me', getMyBilling)

  const toggleComplete = async (task) => {
    const res = await completeTask(task.id)
    if (!res.success) {
      toast.error(res.message)
      return
    }
    toast.success(res.data.nextTask ? t.completedRepeat : t.completedTask)
    reload()
  }

  const today = formatDate(new Date(), { weekday: true })

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-14 animate-pulse rounded-2xl bg-room-oat/70" />
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-4">
            <div className="h-64 animate-pulse rounded-2xl bg-room-oat/70" />
          </div>
          <div className="space-y-4">
            <div className="h-40 animate-pulse rounded-2xl bg-room-oat/70" />
            <div className="h-64 animate-pulse rounded-2xl bg-room-oat/70" />
          </div>
        </div>
        {slow && (
          <p className="text-center text-xs font-semibold leading-relaxed text-room-ink/50">
            {SERVER_WAKE_HINT}
          </p>
        )}
      </div>
    )
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-room-rain/30 px-6 py-10 text-center ring-1 ring-room-rain">
          <WarningCircle size={40} weight="regular" className="text-room-ink/70" />
          <p className="font-display text-lg font-bold text-room-ink">Chưa tải được dữ liệu</p>
          <p className="max-w-sm text-sm font-semibold text-room-ink/70">
            {error || 'Không nhận được phản hồi từ máy chủ.'}
          </p>
          <RoomButton variant="secondary" size="sm" onClick={reload}>
            Thử lại
          </RoomButton>
        </div>
        <p className="text-center text-xs font-semibold leading-relaxed text-room-ink/50">
          {SERVER_WAKE_HINT}
        </p>
      </div>
    )
  }

  // ===== Số liệu cho bảng "Thống kê nhanh" =====
  const total = data.todayCount + data.overdueCount + data.upcomingCount + data.completedCount
  const percent = total > 0 ? Math.round((data.completedCount / total) * 100) : 0
  // Điểm chú giải đổi sang token phòng: series trạng thái của thế giới
  // (Sage = xong, Bell = hôm nay, Rain = quá hạn, Acorn = tổng) — vẫn đọc đúng.
  const legend = [
    { dot: 'bg-room-sage', label: t.legendCompleted, value: data.completedCount },
    { dot: 'bg-room-bell', label: t.legendToday, value: data.todayCount },
    { dot: 'bg-room-rain', label: t.legendOverdue, value: data.overdueCount },
    { dot: 'bg-room-acorn/50', label: t.legendTotal, value: total },
  ]
  const unreadReward = true // chưa nhấn Nhận thưởng hôm nay — API chưa có cờ riêng, luôn gợi ý

  // Bàn trái: việc quá hạn đi trước (món đồ đã sáng đèn), rồi việc có hạn hôm
  // nay. Giao nhau (việc hạn hôm nay giờ đã trôi) chỉ ghi một hàng — dedupe
  // theo id, thuần hiển thị, không đổi logic API.
  const deskRows = [...data.overdueTasks, ...data.todayTasks].filter(
    (task, i, arr) => arr.findIndex((x) => x.id === task.id) === i
  )

  const initials = String(user?.fullName || '')
    .split(' ')
    .map((w) => w[0])
    .slice(-2)
    .join('')
    .toUpperCase()

  return (
    <div className="animate-fade-in grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      {/* ─── MẶT BÀN (cánh trái) ──────────────────────────── */}
      <div className="space-y-4">
        {/* Dòng chào: một dòng chữ trên mặt bàn, không banner nền tối */}
        <section className="flex flex-wrap items-center justify-between gap-3 px-1">
          <div className="flex items-center gap-3">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="h-11 w-11 rounded-full object-cover" />
            ) : (
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-room-oat font-display text-sm font-bold text-room-ink ring-1 ring-room-acorn/25">
                {initials ? (
                  initials
                ) : (
                  <UserCircle size={24} weight="bold" />
                )}
              </span>
            )}
            <div className="min-w-0">
              {/* Mobile: cho phép xuống dòng chữ đủ nghĩa; sm+ vắn gọn một dòng */}
              <h1 className="font-display text-xl font-bold leading-snug text-room-ink">
                <span className="sm:truncate">{t.welcome}, {user?.fullName}!</span>
              </h1>
              <p className="mt-0.5 text-[13px] font-semibold text-room-ink/55">{today}</p>
            </div>
          </div>
          <p className="hidden max-w-xs text-right text-xs italic leading-relaxed text-room-ink/50 lg:block">
            “{t.dashQuote}”
          </p>
        </section>

        {/* Rail quá hạn: THỨ ĐẦU TIÊN chạm mắt bên bàn trái khi món đồ đã
            trôi hạn (contract brief — trước phòng, trước lịch). */}
        {data.overdueCount > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-room-rain/30 px-4 py-3 ring-1 ring-room-rain">
            <span className="flex items-center gap-2.5 text-sm font-bold text-room-ink">
              <WarningCircle size={19} weight="bold" className="text-room-acorn" />
              {t.overdueTasks}: {data.overdueCount} {t.overdueTasksCount}
            </span>
            <Link
              to="/app/tasks"
              className="flex items-center gap-1 text-xs font-bold text-room-ink transition hover:text-room-acorn"
            >
              {t.viewAll} <ArrowRight size={13} weight="bold" />
            </Link>
          </div>
        )}

        {/* Căn phòng của bạn: đúng cảnh ở landing (cửa sổ, kệ, bàn học, đồng hồ
            chạy giờ thật), giờ kèm số liệu thật của chính bạn trên bệ bàn. */}
        <section
          aria-label={t.roomWallLabel}
          className="relative overflow-hidden rounded-[1.8rem] bg-room-oat/30 ring-1 ring-room-acorn/25"
        >
          <div className="room-wallpaper px-1 pb-1 pt-3 sm:px-4 sm:pt-4">
            <RoomScene t={t} app />
          </div>
          {/* Bệ bàn: bảng tên + số của hôm nay, nằm ngay dưới mép bàn trong cảnh */}
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 bg-room-acorn/45 px-4 py-2 text-room-paper">
            <p className="flex items-center gap-2 font-display text-[13px] font-bold">
              <UserCircle size={16} weight="bold" />
              {t.roomYourRoom} {user?.fullName}
            </p>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] font-bold">
              <span>{data.todayCount} · {t.todayCount}</span>
              <span>{data.overdueCount} · {t.overdue}</span>
            </p>
          </div>
        </section>

        {error && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-room-rain/30 px-4 py-3 text-sm text-room-ink ring-1 ring-room-rain">
            <span className="font-semibold">Số liệu có thể chưa mới nhất — {error}</span>
            <button
              type="button"
              onClick={reload}
              className="cursor-pointer font-bold underline decoration-room-acorn decoration-2 underline-offset-4 transition hover:text-room-acorn"
            >
              Thử lại
            </button>
          </div>
        )}

        {/* Bản tin hôm nay: tiết học + việc đến hạn (thông báo trong web) */}
        <TodayBrief />

        {billing?.plan !== 'FREE' &&
          billing?.planExpiresAt &&
          typeof billing?.daysLeft === 'number' &&
          billing.daysLeft <= 7 && (
            <Link
              to="/app/billing"
              className="group flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-room-oat/50 px-4 py-3.5 ring-1 ring-room-acorn/20 transition hover:bg-room-oat/70"
            >
              <span className="flex items-center gap-3">
                <BellRinging size={20} weight="bold" className="text-room-acorn" />
                <span>
                  <p className="text-sm font-bold text-room-ink">
                    {billing.daysLeft > 0
                      ? `Gói ${billing.planName} còn ${billing.daysLeft} ngày nữa là hết hạn`
                      : `Gói ${billing.planName} hết hạn hôm nay`}
                  </p>
                  <p className="text-xs font-semibold text-room-ink/65">
                    Hạn {formatDate(billing.planExpiresAt)} — chuyển khoản không tự gia hạn nên bạn cần mua kỳ mới để giữ
                    nguyên quyền lợi.
                  </p>
                </span>
              </span>
              <span className="flex items-center gap-1.5 rounded-full bg-room-paper px-3.5 py-2 text-xs font-bold text-room-ink ring-1 ring-room-acorn/30 transition group-hover:bg-room-oat/60">
                Gia hạn ngay <ArrowRight size={14} weight="bold" />
              </span>
            </Link>
          )}

        {/* Panel Việc hôm nay (+ việc quá hạn đi trước): mặt bàn chính —
            hoàn thành ngay từ hàng, hàng trôi hạn tự nhiên là Blush */}
        {/* Mặt bàn chính: thẻ giấy phẳng — signature tape chỉ sống một lần
            trên sticker tủ phải (contract), không dán thứ hai */}
        <section className="relative rounded-2xl bg-room-paper px-4 py-4 shadow-[0_18px_34px_-22px_rgb(0_0_0/0.25)] ring-1 ring-room-acorn/25 sm:px-5 sm:py-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-baseline gap-2.5">
              <span className="font-display text-lg font-bold text-room-ink">{t.todaySchedule}</span>
              <span className="font-display text-lg font-bold leading-none text-room-acorn">{deskRows.length}</span>
            </h2>
            <Link
              to="/app/tasks"
              className="flex items-center gap-1 text-xs font-bold text-room-ink transition hover:text-room-acorn"
            >
              {t.viewAll} <ArrowRight size={13} weight="bold" />
            </Link>
          </div>
          <RoomDots className="mt-3" />
          <div className="mt-2 space-y-0.5">
            {deskRows.length === 0 ? (
              <div className="flex flex-col items-center gap-2.5 py-10 text-center">
                <CheckCircle size={44} weight="regular" className="text-room-sage" />
                <p className="font-display text-[15px] font-bold text-room-ink">{t.emptyToday}</p>
                <p className="max-w-xs text-[13px] font-semibold leading-relaxed text-room-ink/60">
                  {t.emptyTodayDesc}
                </p>
                <Link to="/app/tasks/new">
                  <RoomButton variant="secondary" size="sm" icon={Plus}>
                    {t.createNew}
                  </RoomButton>
                </Link>
              </div>
            ) : (
              deskRows.map((task, i) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onToggleComplete={toggleComplete}
                  skin="room"
                  glowing={data.overdueCount > 0 && i === 0}
                />
              ))
            )}
          </div>
        </section>
      </div>

      {/* ─── TỦ THÔNG TIN (cánh phải) ─────────────────────── */}
      <aside className="space-y-4">
        {/* Sticker dán tape "Nhật ký đúng hạn": signature duy nhất của phòng */}
        <div className="relative rounded-2xl bg-room-paper/85 px-5 pb-5 pt-6 shadow-[0_14px_30px_-18px_rgb(0_0_0/0.25)] ring-1 ring-room-acorn/25">
          <span
            aria-hidden="true"
            className="absolute -top-2.5 left-6 h-3 w-12 rotate-[-5deg] rounded-[3px] bg-room-oat/90 ring-1 ring-room-acorn/20"
          />
          <p className="text-[12px] font-bold text-room-ink/55">{t.loginReward}</p>
          <div className="mt-1.5 flex items-end gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center">
              <Flame size={27} weight="bold" className="text-room-bell" />
            </span>
            <span className="font-display text-[2rem] font-bold leading-none text-room-ink">
              {user?.loginStreak ?? 0}
            </span>
            <span className="pb-0.5 text-sm font-bold text-room-ink/60">{t.streakDays}</span>
          </div>
          <p className="mt-2.5 text-[13px] leading-relaxed text-room-ink/65">
            <span className="font-bold text-room-ink">{user?.points ?? 0} {t.pointsUnit}</span> ·{' '}
            {t.loginRewardDesc}
          </p>
          <Link
            to="/app/rewards"
            className="group mt-3.5 flex h-9 items-center justify-center gap-2 rounded-full text-[13px] font-bold text-room-ink ring-1 ring-room-acorn/40 transition hover:bg-room-oat/60"
          >
            <Gift size={16} weight="bold" /> {t.claimReward}
          </Link>
        </div>

        {/* Tổng quan ngày hôm nay: 4 ngăn kéo của tủ, cùng 4 số/4 đích như cũ */}
        <section>
          <div className="grid grid-cols-2 gap-2.5">
            <OverviewCell icon={CalendarDots} label={t.todayCount} value={data.todayCount} to="/app/tasks" />
            <OverviewCell icon={WarningCircle} label={t.overdue} value={data.overdueCount} to="/app/tasks" />
            <OverviewCell icon={CheckCircle} label={t.completed} value={data.completedCount} to="/app/tasks" />
            <OverviewCell icon={Sparkle} label={t.upcoming} value={data.upcomingCount} to="/app/calendar" />
          </div>
        </section>

        {/* Thống kê nhanh: vòng % nét Acorn + chú giải (giữ logic tính %) */}
        <section className="rounded-2xl bg-room-paper p-4 shadow-[0_18px_34px_-22px_rgb(0_0_0/0.25)] ring-1 ring-room-acorn/25 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-display text-[15px] font-bold text-room-ink">
              <CalendarDots size={17} weight="bold" className="text-room-acorn" />
              {t.quickStats}
            </h2>
            <span className="rounded-full bg-room-oat/70 px-2.5 py-1 text-[11px] font-bold text-room-ink/60">
              {t.range7}
            </span>
          </div>
          {/* Vòng % và chú giải đứng cạnh nhau từ sm: tủ phải vốn dài hơn bàn
              trái, xếp dọc thì cánh tủ cao thêm ~110px và bỏ trống cả cột trái. */}
          <div className="mt-3 flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:gap-4">
            <ProgressRing percent={percent} label={t.completed} />
            <ul className="w-full min-w-0 space-y-1.5 text-sm">
              {legend.map((row) => (
                <li key={row.label} className="flex items-center gap-2">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${row.dot}`} />
                  <span className="flex-1 font-semibold text-room-ink/70">{row.label}</span>
                  <span className="font-display font-bold tabular-nums text-room-ink">{row.value}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Trợ lý AI: hàng nhỏ trong tủ */}
        <Link
          to="/app/ai"
          className="group flex items-center gap-3.5 rounded-2xl bg-room-paper p-4 shadow-[0_18px_34px_-22px_rgb(0_0_0/0.25)] ring-1 ring-room-acorn/25 transition hover:ring-room-acorn/45"
        >
          <Brain size={22} weight="bold" className="shrink-0 text-room-acorn" />
          <span className="min-w-0 flex-1">
            <span className="block font-display text-[15px] font-bold text-room-ink">{t.aiAssistant}</span>
            <span className="mt-0.5 block truncate text-[12px] font-semibold text-room-ink/55">{t.aiQuickDesc}</span>
          </span>
          <ArrowRight size={16} weight="bold" className="shrink-0 text-room-ink/30 transition group-hover:translate-x-0.5 group-hover:text-room-acorn" />
        </Link>

        {/* Note Moss: gợi động lực + mời thử chuông (copy giữ nguyên vai) */}
        <div className="rounded-2xl bg-room-moss/60 px-4 py-3.5 ring-1 ring-room-acorn/20">
          <div className="flex items-start gap-3">
            <Mountains size={20} weight="bold" className="mt-0.5 shrink-0 text-room-acorn" />
            <div>
              <p className="font-display text-[15px] font-bold text-room-ink">{t.motivationTitle}</p>
              <p className="mt-0.5 text-[12.5px] font-semibold leading-relaxed text-room-ink/70">{t.motivationDesc}</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl bg-room-moss/60 px-4 py-3.5 ring-1 ring-room-acorn/20 group/try">
          <div className="flex items-start gap-3">
            <BellRinging size={20} weight="bold" className="mt-0.5 shrink-0 text-room-bell" />
            <div className="min-w-0 flex-1">
              <p className="font-display text-[15px] font-bold text-room-ink">{t.tryAlarm}</p>
              <p className="mt-0.5 text-[12.5px] font-semibold leading-relaxed text-room-ink/70">{t.tryAlarmDesc}</p>
              <Link
                to="/app/tasks"
                className="mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-room-ink ring-1 ring-room-acorn/40 transition hover:bg-room-oat/60"
              >
                {t.tryAlarmBtn} <ArrowRight size={12} weight="bold" />
              </Link>
            </div>
          </div>
        </div>

        {/* Thẻ nhận thưởng mỗi ngày: hàng nhỏ cuối tủ (🎁 → icon Gift) */}
        <Link
          to="/app/rewards"
          className="group flex items-center gap-3 rounded-2xl bg-room-paper p-4 shadow-[0_18px_34px_-22px_rgb(0_0_0/0.25)] ring-1 ring-room-acorn/25 transition hover:ring-room-acorn/45"
        >
          <Gift size={20} weight="bold" className="shrink-0 text-room-acorn" />
          <span className="min-w-0 flex-1">
            <span className="block font-display text-[15px] font-bold text-room-ink">{t.dailyReward}</span>
            <span className="mt-0.5 flex items-center gap-1.5 text-xs font-bold text-room-acorn">
              {t.claimNow} <ArrowRight size={12} weight="bold" />
              {unreadReward && <span className="ml-0.5 h-2 w-2 rounded-full bg-room-bell" />}
            </span>
          </span>
        </Link>
      </aside>
    </div>
  )
}
