import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ChartBar,
  ChartLineUp,
  DownloadSimple,
  Printer,
  CheckCircle,
  WarningCircle,
  Flame,
  Clock,
  Alarm,
  LockSimple,
  ArrowRight,
  Sparkle,
  TrendUp,
  TrendDown,
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
import { getReport, exportReport, downloadCsv } from '../../services/reportService'
import { PRIORITY, isProPlan } from '../../lib/constants'
import { formatDate } from '../../lib/format'

// ─── Báo cáo năng suất (gói Pro) ────────────────────────────
//
// Vì sao trang này tồn tại: gói Pro trước đây chỉ "nới trần" (không giới hạn việc,
// nhiều thiết bị) — thứ người dùng chưa chắc đã chạm tới nên không thấy đáng tiền.
// Báo cáo là thứ họ nhìn thấy giá trị mỗi tuần: mình xong bao nhiêu việc, có đúng
// hạn không, làm tốt nhất vào giờ nào, việc nào đang bị bỏ quên — và mang ra ngoài
// được (Excel/PDF) để báo cáo với cấp trên hoặc tự nhìn lại.
//
// Lưu ý khi sửa: mọi con số đều do backend tính (reportService.js) và đã tính theo
// giờ Việt Nam. Giao diện KHÔNG tự đếm lại từ danh sách công việc — hai nơi tính
// hai kiểu là cách chắc chắn nhất để khách nhìn thấy hai con số khác nhau.

const RANGES = [
  { days: 7, label: '7 ngày' },
  { days: 30, label: '30 ngày' },
  { days: 90, label: '90 ngày' },
]

function nf(value) {
  return new Intl.NumberFormat('vi-VN').format(value ?? 0)
}

// Khối lỗi da phòng — Rain trung tính (dùng chung khuôn với PlannerPage)
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

// Đĩa chỉ số: mỗi con số một màu theo nghĩa của nó — hoàn thành Sage, chuỗi ngày
// Bell, quá hạn Blush, còn lại trung tính Oat/Rain. Không gradient, không navy.
const STAT_TONES = {
  sage: 'bg-room-sage/45 ring-room-acorn/20',
  bell: 'bg-room-bell/25 ring-room-bell/40',
  blush: 'bg-room-blush/45 ring-room-acorn/20 dark:bg-room-blush/30',
  oat: 'bg-room-oat/60 ring-room-acorn/15',
}

function StatCard({ icon: Icon, label, value, sub, tone = 'oat', delay = 0 }) {
  return (
    <RoomCard
      className="p-4 transition hover:ring-room-acorn/50 sm:p-5"
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className={`flex h-10 w-10 items-center justify-center rounded-xl ring-1 ring-inset ${STAT_TONES[tone]} text-room-ink`}>
        <Icon size={20} weight="duotone" />
      </span>
      <p className="mt-3 font-display text-3xl font-bold tracking-tight text-room-ink">{value}</p>
      <p className="text-sm font-semibold text-room-ink/65">{label}</p>
      {sub && <p className="mt-0.5 text-xs font-semibold text-room-ink/65">{sub}</p>}
    </RoomCard>
  )
}

/** Biểu đồ cột thuần CSS — không cần thêm thư viện biểu đồ vào bundle. */
function DailyChart({ daily }) {
  const max = Math.max(1, ...daily.map((d) => d.completed))
  // Nhãn ngày chỉ hiện thưa ra để không chồng chữ khi xem 90 ngày
  const step = daily.length > 45 ? 15 : daily.length > 14 ? 5 : 1

  return (
    <div className="mt-4">
      <div className="flex h-40 items-end gap-[3px]">
        {daily.map((d, i) => {
          const height = d.completed ? Math.max(6, (d.completed / max) * 100) : 2
          return (
            <div key={d.date} className="group relative flex h-full flex-1 items-end">
              <div
                className={`w-full rounded-t-md transition-all duration-300 ${
                  d.completed ? 'bg-room-acorn hover:brightness-95' : 'bg-room-oat/50'
                }`}
                style={{ height: `${height}%` }}
              />
              <span className="pointer-events-none absolute -top-8 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-room-ink px-2 py-1 text-[11px] font-bold text-room-paper group-hover:block">
                {d.label}: {d.completed} việc
              </span>
            </div>
          )
        })}
      </div>
      <div className="mt-1.5 flex gap-[3px]">
        {daily.map((d, i) => (
          <span key={d.date} className="flex-1 text-center text-[9px] font-semibold text-room-ink/60">
            {i % step === 0 || i === daily.length - 1 ? d.label : ''}
          </span>
        ))}
      </div>
    </div>
  )
}

/** Bảng theo thứ trong tuần: cho thấy "thứ 2 của bạn" có bị dồn việc không. */
function WeekdayChart({ weekday }) {
  const max = Math.max(1, ...weekday.map((d) => d.completed))
  return (
    <ul className="mt-3 space-y-2">
      {weekday.map((d) => (
        <li key={d.weekday} className="flex items-center gap-3">
          <span className="w-16 shrink-0 text-xs font-semibold text-room-ink/65">{d.label}</span>
          <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-room-oat/60">
            <span
              className="block h-full rounded-full bg-room-acorn transition-all duration-500"
              style={{ width: `${(d.completed / max) * 100}%` }}
            />
          </span>
          <span className="w-6 text-right text-xs font-bold text-room-ink/80">{d.completed}</span>
        </li>
      ))}
    </ul>
  )
}

/** Dải 24 giờ: ô càng đậm là càng nhiều việc được đánh dấu xong vào giờ đó. */
function HourStrip({ hours, goldenHour }) {
  const max = Math.max(1, ...hours.map((h) => h.completed))
  return (
    <div className="mt-4 flex gap-1">
      {hours.map((h) => {
        const ratio = h.completed / max
        return (
          <div key={h.hour} className="group relative flex-1">
            <div
              className={`h-8 rounded-md ring-1 ring-inset transition ${
                h.completed ? 'bg-room-acorn' : 'bg-room-oat/45 ring-room-acorn/15'
              } ${h.hour === goldenHour ? 'ring-2 ring-room-bell' : ''}`}
              style={h.completed ? { opacity: 0.35 + ratio * 0.65 } : undefined}
            />
            <span className="pointer-events-none absolute -top-8 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-room-ink px-2 py-1 text-[11px] font-bold text-room-paper group-hover:block">
              {h.hour}h: {h.completed} việc
            </span>
          </div>
        )
      })}
    </div>
  )
}

function LockedPanel() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex flex-wrap items-center gap-2 font-display text-2xl font-bold text-room-ink">
          Báo cáo năng suất
          <span className="rounded-full bg-room-oat/70 px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-room-ink/60 ring-1 ring-inset ring-room-acorn/25">
            Pro
          </span>
        </h1>
        <p className="mt-1 text-sm font-semibold text-room-ink/65">
          Biết mình đang làm tốt ở đâu, và đang bỏ quên việc gì.
        </p>
      </div>

      <RoomCard className="p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-room-oat/45 text-room-acorn ring-1 ring-inset ring-room-acorn/25">
            <LockSimple size={22} weight="duotone" />
          </span>
          <div>
            <h2 className="font-display font-bold text-room-ink">Báo cáo là tính năng của gói Pro</h2>
            <p className="mt-1 text-sm font-semibold text-room-ink/65">
              Nâng cấp Pro để mở khoá toàn bộ số liệu bên dưới — kèm xuất file Excel để gửi báo cáo.
            </p>
          </div>
        </div>

        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {[
            { icon: ChartBar, text: 'Việc đã xong theo từng ngày, từng thứ, từng giờ trong 7/30/90 ngày' },
            { icon: CheckCircle, text: 'Tỉ lệ hoàn thành đúng hạn — biết mình đang trễ ở đâu' },
            { icon: WarningCircle, text: 'Danh sách việc tồn đọng lâu nhất, xếp theo số ngày quá hạn' },
            { icon: Alarm, text: 'Nhắc dai đã kéo bạn quay lại bao nhiêu việc' },
            { icon: ChartLineUp, text: 'So sánh với kỳ trước: tuần này có khá hơn tuần trước không' },
            { icon: DownloadSimple, text: 'Xuất Excel (.csv) và in/lưu PDF để lưu lại hoặc gửi cho người khác' },
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

export default function ReportsPage() {
  const { user } = useAuth()
  const toast = useToast()
  const [days, setDays] = useState(30)
  const [exporting, setExporting] = useState(false)

  const isPro = isProPlan(user?.plan)

  // Với gói chưa có quyền thì không gọi API (server cũng sẽ từ chối) — tránh vừa
  // hiện khung khoá vừa hiện thông báo lỗi đỏ.
  const fetcher = () =>
    isPro ? getReport({ days }) : Promise.resolve({ success: true, data: null })
  const { data, loading, error, slow, reload } = useCachedQuery(`report-${days}`, fetcher)

  const totals = data?.totals
  const daily = useMemo(() => data?.daily ?? [], [data])

  const onExport = async () => {
    setExporting(true)
    try {
      const res = await exportReport({ days })
      if (!res.success) {
        toast.error(res.message)
        return
      }
      downloadCsv(res.data)
      toast.success(`Đã tải ${res.data.filename}`)
    } catch {
      toast.error('Không kết nối được máy chủ. Thử lại sau ít phút.')
    } finally {
      setExporting(false)
    }
  }

  if (!isPro) return <LockedPanel />

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <RoomSkeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <RoomSkeleton key={i} className="h-32" />
          ))}
        </div>
        <RoomSkeleton className="h-64" />
      </div>
    )
  }

  if (error && !data) {
    return <RoomErrorNotice message={error} onRetry={reload} />
  }

  const rangeLabel = RANGES.find((r) => r.days === days)?.label || `${days} ngày`
  const delta = totals?.completedDelta ?? 0

  return (
    <div className="space-y-6">
      {/* ── Đầu trang + hành động ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex flex-wrap items-center gap-2 font-display text-2xl font-bold text-room-ink">
            <ChartBar size={26} weight="duotone" className="text-room-acorn" />
            Báo cáo năng suất
            <span className="rounded-full bg-room-oat/70 px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-room-ink/60 ring-1 ring-inset ring-room-acorn/25">
              Pro
            </span>
          </h1>
          <p className="mt-1 text-sm font-semibold text-room-ink/60">
            {data?.range?.from?.split('-').reverse().join('/')} → {data?.range?.to?.split('-').reverse().join('/')}
            {slow && ' · máy chủ đang khởi động…'}
          </p>
        </div>

        <div className="no-print flex flex-wrap items-center gap-2">
          <RoomSegmented options={RANGES.map((r) => ({ value: r.days, label: r.label }))} value={days} onChange={setDays} size="sm" />
          <RoomButton variant="secondary" size="sm" icon={Printer} onClick={() => window.print()}>
            Lưu PDF
          </RoomButton>
          <RoomButton size="sm" icon={DownloadSimple} loading={exporting} onClick={onExport}>
            Xuất Excel
          </RoomButton>
        </div>
      </div>

      {error && data && (
        <RoomErrorNotice message={`${error} — đang hiện số liệu lần trước.`} onRetry={reload} />
      )}

      {/* ── Câu nhận xét: thứ người dùng thật sự đọc ── */}
      <RoomCard className="overflow-hidden bg-room-oat/45 p-5 sm:p-6">
        <p className="flex items-start gap-3 text-sm font-semibold leading-relaxed text-room-ink sm:text-base">
          <Sparkle size={20} weight="fill" className="mt-0.5 shrink-0 text-room-bell" />
          <span>{data?.insight}</span>
        </p>
      </RoomCard>

      {/* ── Bốn con số chính ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={CheckCircle}
          tone="sage"
          label="Việc đã hoàn thành"
          value={nf(totals?.completed)}
          sub={
            delta > 0
              ? `Nhiều hơn kỳ trước ${nf(delta)} việc`
              : delta < 0
                ? `Ít hơn kỳ trước ${nf(Math.abs(delta))} việc`
                : 'Ngang bằng kỳ trước'
          }
          delay={0}
        />
        <StatCard
          icon={TrendUp}
          tone="oat"
          label="Xong đúng hạn"
          value={`${nf(totals?.onTimeRate)}%`}
          sub={`${nf(totals?.onTime)} đúng hạn · ${nf(totals?.late)} muộn`}
          delay={60}
        />
        <StatCard
          icon={Flame}
          tone="bell"
          label="Chuỗi ngày có việc xong"
          value={`${nf(totals?.streakCurrent)} ngày`}
          sub={`Dài nhất trong ${rangeLabel}: ${nf(totals?.streakBest)} ngày`}
          delay={120}
        />
        <StatCard
          icon={WarningCircle}
          tone={totals?.overdueOpen ? 'blush' : 'oat'}
          label="Đang quá hạn"
          value={nf(totals?.overdueOpen)}
          sub={`${nf(totals?.openNow)} việc còn đang mở`}
          delay={180}
        />
      </div>

      {/* ── Biểu đồ theo ngày ── */}
      <RoomCard className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-display font-bold text-room-ink">
            <ChartLineUp size={19} weight="fill" className="text-room-acorn" />
            Việc hoàn thành mỗi ngày
          </h2>
          <p className="text-xs font-semibold text-room-ink/65">
            Tạo mới trong kỳ: {nf(totals?.created)} việc · đến hạn: {nf(totals?.dueInRange)} việc
          </p>
        </div>
        {daily.every((d) => !d.completed) ? (
          <RoomEmpty
            icon={ChartLineUp}
            title="Chưa có việc nào được đánh dấu xong"
            description="Đánh dấu Xong vài việc nhỏ hôm nay là biểu đồ bắt đầu có dữ liệu."
          />
        ) : (
          <DailyChart daily={daily} />
        )}
      </RoomCard>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Giờ vàng ── */}
        <RoomCard className="p-5 sm:p-6">
          <h2 className="flex items-center gap-2 font-display font-bold text-room-ink">
            <Clock size={19} weight="fill" className="text-room-bell" />
            Bạn làm việc tốt nhất vào lúc nào
          </h2>
          {totals?.goldenHour == null || totals?.goldenCount === 0 ? (
            <p className="mt-3 text-sm font-semibold text-room-ink/65">
              Chưa đủ dữ liệu để tìm ra giờ vàng của bạn.
            </p>
          ) : (
            <>
              <p className="mt-2 text-sm font-semibold text-room-ink/65">
                Nhiều việc được đánh dấu xong nhất vào khoảng{' '}
                <strong className="font-extrabold text-room-ink">{totals.goldenHour}h</strong> (
                {nf(totals.goldenCount)} việc). Hãy dành giờ đó cho việc khó nhất.
              </p>
              <HourStrip hours={data.hours} goldenHour={totals.goldenHour} />
              <div className="mt-1 flex justify-between text-[10px] font-semibold text-room-ink/60">
                <span>0h</span>
                <span>6h</span>
                <span>12h</span>
                <span>18h</span>
                <span>23h</span>
              </div>
            </>
          )}
        </RoomCard>

        {/* ── Theo thứ trong tuần ── */}
        <RoomCard className="p-5 sm:p-6">
          <h2 className="flex items-center gap-2 font-display font-bold text-room-ink">
            <ChartBar size={19} weight="fill" className="text-room-acorn" />
            Theo thứ trong tuần
          </h2>
          <WeekdayChart weekday={data?.weekday ?? []} />
        </RoomCard>

        {/* ── Danh mục ── */}
        <RoomCard className="p-5 sm:p-6">
          <h2 className="flex items-center gap-2 font-display font-bold text-room-ink">
            <ChartBar size={19} weight="fill" className="text-room-acorn" />
            Danh mục bạn làm nhiều nhất
          </h2>
          {data?.categories?.length ? (
            <ul className="mt-3 space-y-3">
              {data.categories.map((c) => (
                <li key={c.categoryId}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 font-semibold text-room-ink/75">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: c.color || '#8b6f4e' }}
                        aria-hidden="true"
                      />
                      {c.name}
                    </span>
                    <span className="text-xs font-bold text-room-ink/65">
                      {nf(c.completed)} việc · {nf(c.share)}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-room-oat/60">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${c.share}%`, backgroundColor: c.color || '#8b6f4e' }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm font-semibold text-room-ink/65">
              Chưa có việc nào gắn danh mục được hoàn thành trong kỳ này.
            </p>
          )}
        </RoomCard>

        {/* ── Ưu tiên + nhắc dai ── */}
        <RoomCard className="p-5 sm:p-6">
          <h2 className="flex items-center gap-2 font-display font-bold text-room-ink">
            <Alarm size={19} weight="fill" className="text-room-bell" />
            Mức ưu tiên &amp; nhắc dai
          </h2>
          {data?.priorities?.length ? (
            <ul className="mt-3 flex flex-wrap gap-2">
              {data.priorities.map((p) => (
                <li
                  key={p.priority}
                  className="flex items-center gap-1.5 rounded-xl bg-room-oat/60 px-3 py-2 text-xs font-bold text-room-ink/70"
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${PRIORITY[p.priority]?.dot || 'bg-room-ink/40'}`} aria-hidden="true" />
                  {p.label}: {nf(p.completed)} việc
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm font-semibold text-room-ink/65">Chưa có việc nào hoàn thành trong kỳ.</p>
          )}

          <div className="mt-4 rounded-xl bg-room-bell/20 p-3 ring-1 ring-inset ring-room-bell/40">
            <p className="text-xs font-semibold leading-relaxed text-room-ink/85">
              {totals?.nagSaved > 0 ? (
                <>
                  <strong className="font-extrabold">Nhắc dai đã kéo bạn quay lại {nf(totals.nagSaved)} việc</strong> —
                  những việc bạn đã bỏ qua ít nhất một lần nhắc. Tổng cộng chuông phải kêu lại {nf(totals.nagRepeats)}{' '}
                  lần.
                </>
              ) : (
                <>
                  Chưa có việc nào phải nhắc lại trong kỳ này. Muốn chắc hơn với việc không được quên, hãy bật “Nhắc
                  dai tới khi xong” khi tạo công việc.
                </>
              )}
            </p>
          </div>

          {totals?.avgHoursBeforeDue !== null && totals?.avgHoursBeforeDue !== undefined && (
            <p className="mt-3 flex items-center gap-2 text-xs font-semibold text-room-ink/65">
              {totals.avgHoursBeforeDue >= 0 ? (
                <>
                  <TrendUp size={15} className="text-room-acorn" />
                  Trung bình xong trước hạn {nf(Math.round(totals.avgHoursBeforeDue))} giờ
                </>
              ) : (
                <>
                  <TrendDown size={15} className="text-room-bell" />
                  Trung bình xong muộn {nf(Math.abs(Math.round(totals.avgHoursBeforeDue)))} giờ
                </>
              )}
            </p>
          )}
        </RoomCard>
      </div>

      {/* ── Việc đang bị bỏ quên: danh sách hành động được ── */}
      <RoomCard className="p-5 sm:p-6">
        <h2 className="flex items-center gap-2 font-display font-bold text-room-ink">
          <WarningCircle size={19} weight="fill" className="text-room-bell" />
          Việc đang bị bỏ quên
        </h2>
        {data?.worstOverdue?.length ? (
          <ul className="mt-3 divide-y divide-room-acorn/15">
            {data.worstOverdue.map((w) => (
              <li key={w.taskId} className="flex flex-wrap items-center gap-2 py-3">
                <Link
                  to={`/app/tasks/${w.taskId}`}
                  className="flex-1 font-semibold text-room-ink/85 transition hover:text-room-acorn"
                >
                  {w.title}
                </Link>
                {w.categoryName && (
                  <span className="rounded-full bg-room-oat/60 px-2 py-0.5 text-[11px] font-semibold text-room-ink/65">
                    {w.categoryName}
                  </span>
                )}
                {w.nagEveryMinutes && (
                  <span className="flex items-center gap-1 rounded-full bg-room-bell/20 px-2 py-0.5 text-[11px] font-bold text-room-bell">
                    <Alarm size={11} weight="fill" />
                    {w.nagEveryMinutes} phút
                  </span>
                )}
                <span className="flex items-center gap-1.5 rounded-full bg-room-oat/60 px-2.5 py-0.5 text-[11px] font-bold text-room-ink/60">
                  <span className={`h-1.5 w-1.5 rounded-full ${PRIORITY[w.priority]?.dot || 'bg-room-ink/40'}`} aria-hidden="true" />
                  {PRIORITY[w.priority]?.label || w.priority}
                </span>
                <span className="rounded-full bg-room-blush/45 px-2.5 py-0.5 text-[11px] font-extrabold on-blush ring-1 ring-room-acorn/20 dark:bg-room-blush/30">
                  Quá hạn {nf(w.daysLate)} ngày
                </span>
                <span className="text-[11px] font-semibold text-room-ink/65">Hạn {formatDate(w.dueAt)}</span>
                <ArrowRight size={14} className="text-room-ink/25" />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm font-semibold text-room-ink/65">
            Không có việc nào quá hạn. Đây là trạng thái đáng giữ.
          </p>
        )}
      </RoomCard>

      <p className="text-center text-[11px] font-semibold text-room-ink/60">
        Số liệu tính theo giờ Việt Nam, chỉ gồm công việc đang có trong app (không tính việc trong thùng rác). Xuất
        Excel để lưu lại hoặc gửi cho người khác.
      </p>
    </div>
  )
}
