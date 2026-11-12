import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CaretLeft,
  CaretRight,
  CalendarBlank,
  Plus,
  Clock,
  Bell,
  Repeat,
  Globe,
  TrashSimple,
  ArrowsClockwise,
  CaretDown,
  GraduationCap,
  WarningCircle,
} from '@phosphor-icons/react'
import {
  listExternalCalendars,
  addExternalCalendar,
  removeExternalCalendar,
  syncExternalCalendar,
  getExternalEvents,
} from '../../services/externalCalendarService'
import {
  listMyWorkspaces,
  createClassWorkspace,
  getSchoolSchedule,
  saveSchoolSchedule,
  importTimetable,
  importTimetableCsv,
  listSchools,
  connectSchool,
  disconnectSchool,
  syncSchool,
  addScheduleSlot,
  removeScheduleSlot,
  clearScheduleSlots,
} from '../../services/schoolScheduleService'
import { useToast } from '../../components/common/Toast'
import { getAllTasks } from '../../services/taskService'
import { repeatSummary, PRIORITY } from '../../lib/constants'
import {
  buildMonthGrid,
  weekDays,
  formatDayKey,
  parseDayKey,
  isSameDay,
  isSameMonth,
  formatTime,
  formatDate,
  VI_DAYS,
  VI_DAYS_SHORT,
  VI_MONTHS,
  effectiveStatus,
} from '../../lib/format'
import {
  RoomButton,
  RoomCard,
  RoomSkeleton,
  RoomSegmented,
  ROOM_ARROW_URL,
} from '../../components/common/RoomUI'

const VIEWS = [
  { value: 'month', label: 'Tháng' },
  { value: 'week', label: 'Tuần' },
  { value: 'day', label: 'Ngày' },
]

// ---------------------------------------------------------------------
// Da phòng cho trang Lịch (mốc M4): các control/navy của trang này vẽ lại
// trên giấy phòng — logic/API giữ nguyên 100%.
// ---------------------------------------------------------------------

// Ô nhập/select trong các panel quản lý: khay giấy + ring Acorn (khớp mật độ
// py-2 của bản cũ; không dùng RoomInput vì ô nhỏ có width/height riêng như w-[84px]).
const roomFieldBase =
  'rounded-xl bg-room-paper text-room-ink ring-1 ring-inset ring-room-acorn/25 ' +
  'placeholder:text-room-ink/45 transition hover:ring-room-acorn/45 ' +
  'focus:ring-2 focus:ring-room-acorn focus:outline-none cursor-text'
const roomFieldCls = `${roomFieldBase} w-full px-3 py-2 text-sm`
const roomFieldSliceCls = `${roomFieldBase} w-[84px] px-2 py-2 text-sm`

// Select da phòng (mũi tên Acorn hằn kiểu RoomSelect, diện h-10/pl-2 cho khung nhỏ)
const roomSelectCls =
  'cursor-pointer appearance-none rounded-xl bg-room-oat/45 pl-3 pr-9 text-sm font-bold text-room-ink ' +
  'ring-1 ring-inset ring-room-acorn/20 transition hover:bg-room-oat/75 ' +
  'focus:ring-2 focus:ring-room-acorn focus:outline-none'
const roomSelectArrowStyle = {
  backgroundImage: `url("${ROOM_ARROW_URL}")`,
  backgroundPosition: 'right 0.6rem center',
  backgroundRepeat: 'no-repeat',
}
const roomSelectClsSmall = `${roomSelectCls} h-10 text-xs`

// Chip trạng thái/ưu tiên da phòng — dữ liệu gốc giữ nguyên, chỉ ep giấy:
// Blush CHỈ đến hạn, Sage CHỈ hoàn thành, còn lại trung tính Oat.
function RoomStatusChip({ task }) {
  const st = effectiveStatus(task)
  if (st === 'OVERDUE') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-room-blush/45 px-2.5 py-0.5 text-xs font-extrabold on-blush ring-1 ring-room-acorn/20 dark:bg-room-blush/30">
        Quá hạn
      </span>
    )
  }
  if (st === 'COMPLETED') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-room-sage/45 px-2.5 py-0.5 text-xs font-extrabold text-room-ink">
        Hoàn thành
      </span>
    )
  }
  const label = st === 'CANCELLED' ? 'Đã hủy' : st === 'IN_PROGRESS' ? 'Đang làm' : 'Chưa làm'
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-room-oat/60 px-2.5 py-0.5 text-xs font-extrabold text-room-ink/65">
      {label}
    </span>
  )
}

function RoomPriorityChip({ priority }) {
  const p = PRIORITY[priority]
  if (!p) return null
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-room-oat/60 px-2.5 py-0.5 text-xs font-bold text-room-ink/65">
      <span className={`h-1.5 w-1.5 rounded-full ${p.dot}`} aria-hidden="true" />
      {p.label}
    </span>
  )
}

export default function CalendarPage() {
  const [view, setView] = useState('month')
  const [cursor, setCursor] = useState(new Date())
  const [selected, setSelected] = useState(new Date())
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  // Lịch ngoài (Google/Outlook .ics): sự kiện đọc từ backend, tô màu theo lịch
  const [externalEvents, setExternalEvents] = useState([])
  const [calendars, setCalendars] = useState([])
  const [calPanelOpen, setCalPanelOpen] = useState(false)
  // ── Lịch học (Lớp học — SchoolLink + ScheduleSlot, Phase 2) ──
  const [schedules, setSchedules] = useState([]) // [{workspaceId, wsName, school}]
  const [schedBusy, setSchedBusy] = useState(false)
  const [showSchedule, setShowSchedule] = useState(true)
  const [schedPanelOpen, setSchedPanelOpen] = useState(false)
  const toast = useToast()

  const range = useMemo(() => {
    if (view === 'month') {
      const start = parseDayKey(formatDayKey(buildMonthGrid(cursor.getFullYear(), cursor.getMonth())[0]))
      const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 42)
      return { from: start, to: end }
    }
    if (view === 'week') {
      const days = weekDays(cursor)
      const end = new Date(days[6].getFullYear(), days[6].getMonth(), days[6].getDate() + 1)
      return { from: days[0], to: end }
    }
    const end = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1)
    return { from: new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate()), to: end }
  }, [view, cursor])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      // Duyệt nhiều trang: trần mỗi request của máy chủ là 200 việc.
      const res = await getAllTasks({
        dueFrom: range.from.toISOString(),
        dueTo: range.to.toISOString(),
      })
      if (!cancelled && res.success) {
        setTasks(res.data.items)
      }
      if (!cancelled) setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [range])

  // Sự kiện lịch ngoài: theo khoảng của chế độ xem đang mở (backend /events
  // mặc định -7d..+60d nên ép truyền from/to hết cho khớp lưới).
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await getExternalEvents({ from: range.from, to: range.to })
        if (!cancelled && res.success) setExternalEvents(res.data || [])
      } catch {
        // lỗi mạng thì giữ nguyên sự kiện cũ — lịch ngoài không phải điều kiện chặn
      }
    })()
    return () => {
      cancelled = true
    }
  }, [range])

  // Lịch học: tìm các Lớp học (STUDENT) rồi nạp SchoolLink + tiết từng lớp
  const loadSchedules = useCallback(async () => {
    try {
      const res = await listMyWorkspaces()
      if (!res.success) return
      const classes = (res.data || [])
        .filter((m) => m.workspace?.type === 'STUDENT')
        .map((m) => ({ workspaceId: m.workspace.workspaceId, wsName: m.workspace.name }))
      const loaded = await Promise.all(
        classes.map(async (c) => {
          const r = await getSchoolSchedule({ 'X-Workspace': String(c.workspaceId) })
          return { ...c, school: r.success ? r.data : null }
        }),
      )
      setSchedules(loaded)
    } catch {
      // Lịch học không phải điều kiện chặn trang Lịch — lỗi mạng thì giữ trống
    }
  }, [])

  useEffect(() => {
    loadSchedules()
  }, [loadSchedules])

  // Danh sách lịch ngoài cho khung quản lý (nạp khi mở panel)
  useEffect(() => {
    if (!calPanelOpen) return
    let cancelled = false
    ;(async () => {
      const res = await listExternalCalendars()
      if (!cancelled && res.success) setCalendars(res.data || [])
    })()
    return () => {
      cancelled = true
    }
  }, [calPanelOpen])

  const handleAddCalendar = async (url, name) => {
    const res = await addExternalCalendar(url, name)
    if (res.success) {
      toast.success(res.message || 'Đã thêm lịch ngoài')
      const listRes = await listExternalCalendars()
      if (listRes.success) setCalendars(listRes.data || [])
    } else {
      toast.error(res.message || 'Không thêm được lịch — kiểm tra URL lại nhé')
    }
  }

  const handleRemoveCalendar = async (calendarId) => {
    const res = await removeExternalCalendar(calendarId)
    if (res.success) {
      toast.success(res.message || 'Đã xoá lịch ngoài')
      setCalendars((list) => list.filter((c) => c.externalCalendarId !== calendarId))
      // nạp lại sự kiện theo khoảng đang mở để bỏ sự kiện của lịch vừa xoá
      const evRes = await getExternalEvents({ from: range.from, to: range.to })
      if (evRes.success) setExternalEvents(evRes.data || [])
    } else {
      toast.error(res.message || 'Không xoá được lịch')
    }
  }

  const handleSyncCalendar = async (calendarId) => {
    const res = await syncExternalCalendar(calendarId)
    if (res.success) {
      toast.success(res.message || 'Đã đồng bộ')
      const listRes = await listExternalCalendars()
      if (listRes.success) setCalendars(listRes.data || [])
    } else {
      toast.error(res.message || 'Không đồng bộ được — kiểm tra URL lại nhé')
    }
  }

  // ── Lịch học: thao tác quản lý (import URL trường, thêm/xoá tiết) ──
  const hasAnySchedule = schedules.some((s) => s.school?.slots?.length > 0)
  // Tạo không gian Lớp học nhanh ngay trong panel (không cần chuyển trang)
  const onCreateClass = async (name) => {
    setSchedBusy(true)
    const res = await createClassWorkspace(name)
    setSchedBusy(false)
    if (res.success) {
      toast.success(res.message || 'Đã tạo Lớp học')
      await loadSchedules()
    } else {
      toast.error(res.message || 'Không tạo được Lớp học')
    }
    return res
  }
  // ── Kết nối tài khoản trường (OneUni-style) ──
  const handleConnectSchool = async ({ schoolCode, username, password }) => {
    setSchedBusy(true)
    const wsId = schedules[0]?.workspaceId
    const res = await connectSchool({ schoolCode, username, password }, { 'X-Workspace': String(wsId) })
    setSchedBusy(false)
    if (res.success) {
      toast.success(res.message || `Đã kết nối và cập nhật ${res.data?.imported ?? 0} tiết`)
      await loadSchedules()
    } else {
      toast.error(res.message || 'Không kết nối được tài khoản trường')
    }
    return res
  }
  const handleDisconnectSchool = async () => {
    setSchedBusy(true)
    const wsId = schedules[0]?.workspaceId
    const res = await disconnectSchool({ 'X-Workspace': String(wsId) })
    setSchedBusy(false)
    if (res.success) {
      toast.success(res.message || 'Đã ngắt kết nối tài khoản trường')
      await loadSchedules()
    } else {
      toast.error(res.message || 'Chưa ngắt được kết nối')
    }
  }
  const handleSyncSchool = async () => {
    setSchedBusy(true)
    const wsId = schedules[0]?.workspaceId
    const res = await syncSchool({ 'X-Workspace': String(wsId) })
    setSchedBusy(false)
    if (res.success) {
      toast.success(res.message || `Đã đồng bộ ${res.data?.imported ?? 0} tiết`)
    } else {
      toast.error(res.message || 'Đồng bộ thất bại — kiểm tra lại kết nối trường')
    }
    // Nạp lại cả khi lỗi: backend ghi lastError vào tài khoản trường, và UI
    // phải hiện đúng lý do (sai mật khẩu, trường chặn…) thay vì im lặng.
    await loadSchedules()
  }
  const handleImportTimetable = async (url) => {
    setSchedBusy(true)
    const wsId = schedules[0]?.workspaceId
    const res = await importTimetable(url, { 'X-Workspace': String(wsId) })
    setSchedBusy(false)
    if (res.success) {
      toast.success(res.message || `Đã nhập ${res.data?.imported ?? 0} tiết học`)
      await loadSchedules()
    } else {
      toast.error(res.message || 'Không nhập được TKB — kiểm tra URL lại nhé')
    }
  }
  const handleImportCsv = async ({ csv, csvUrl }) => {
    setSchedBusy(true)
    const wsId = schedules[0]?.workspaceId
    const res = await importTimetableCsv({ csv, csvUrl }, { 'X-Workspace': String(wsId) })
    setSchedBusy(false)
    if (res.success) {
      toast.success(res.message || `Đã nhập ${res.data?.imported ?? 0} tiết từ CSV`)
      await loadSchedules()
    } else {
      toast.error(res.message || 'Không đọc được CSV — kiểm tra lại cột Thứ/Giờ')
    }
    return res
  }
  const handleSaveSchool = async ({ name, icsUrl }) => {
    setSchedBusy(true)
    const wsId = schedules[0]?.workspaceId
    const res = await saveSchoolSchedule({ name, icsUrl }, { 'X-Workspace': String(wsId) })
    setSchedBusy(false)
    if (res.success) {
      toast.success(res.message || 'Đã lưu trường')
      await loadSchedules()
    } else {
      toast.error(res.message || 'Chưa lưu được')
    }
    return res
  }
  const handleAddSlot = async (data) => {
    const wsId = schedules[0]?.workspaceId
    const res = await addScheduleSlot(data, { 'X-Workspace': String(wsId) })
    if (res.success) {
      toast.success(res.message || 'Đã thêm tiết học')
      await loadSchedules()
    } else {
      toast.error(res.message || 'Chưa thêm được tiết học')
    }
    return res
  }
  const handleRemoveSlot = async (slotId) => {
    const wsId = schedules[0]?.workspaceId
    const res = await removeScheduleSlot(slotId, { 'X-Workspace': String(wsId) })
    if (res.success) {
      toast.success('Đã xoá tiết học')
      await loadSchedules()
    } else {
      toast.error(res.message || 'Không xoá được tiết học')
    }
  }
  const handleClearSlots = async (headers) => {
    setSchedBusy(true)
    const wsId = schedules[0]?.workspaceId
    const res = await clearScheduleSlots({ 'X-Workspace': String(wsId) })
    setSchedBusy(false)
    if (res.success) {
      toast.success(res.message || 'Đã xoá toàn bộ lịch học')
      await loadSchedules()
    } else {
      toast.error(res.message || 'Không xoá được')
    }
  }

  const tasksByDay = useMemo(() => {
    const map = {}
    tasks.forEach((t) => {
      const key = formatDayKey(t.dueAt)
      if (!map[key]) map[key] = []
      map[key].push(t)
    })
    Object.values(map).forEach((list) => list.sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt)))
    return map
  }, [tasks])

  // Sự kiện lịch ngoài xếp theo ngày — hiển thị cạnh công việc, styling riêng
  const eventsByDay = useMemo(() => {
    const map = {}
    externalEvents.forEach((e) => {
      const key = formatDayKey(e.startsAt)
      if (!map[key]) map[key] = []
      map[key].push(e)
    })
    return map
  }, [externalEvents])

  // Tiết học xếp theo ngày trong khoảng đang xem (weekDay lặp hằng tuần +
  // ngoại lệ dateOverride xuất hiện đúng ngày đó chứ không lặp)
  const scheduleSlotsByDay = useMemo(() => {
    if (!showSchedule || schedules.length === 0) return {}
    const all = schedules.flatMap((s) => s.school?.slots || [])
    if (all.length === 0) return {}
    const map = {}
    const d = new Date(range.from.getFullYear(), range.from.getMonth(), range.from.getDate())
    while (d <= range.to) {
      const key = formatDayKey(d)
      const wd = d.getDay() === 0 ? 7 : d.getDay()
      map[key] = all.filter((slot) => (slot.dateOverride ? slot.dateOverride === key : slot.weekDay === wd))
      d.setDate(d.getDate() + 1)
    }
    return map
  }, [schedules, range, showSchedule])

  const selectedTasks = tasksByDay[formatDayKey(selected)] || []
  const selectedEvents = eventsByDay[formatDayKey(selected)] || []

  const move = (dir) => {
    setCursor((c) => {
      const d = new Date(c)
      if (view === 'month') d.setMonth(d.getMonth() + dir)
      else if (view === 'week') d.setDate(d.getDate() + 7 * dir)
      else d.setDate(d.getDate() + dir)
      return d
    })
  }

  const goToday = () => {
    const now = new Date()
    setCursor(now)
    setSelected(now)
  }

  const headerLabel = useMemo(() => {
    if (view === 'month') return `${VI_MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`
    if (view === 'week') {
      const days = weekDays(cursor)
      return `${days[0].getDate()} – ${days[6].getDate()} ${VI_MONTHS[days[0].getMonth()]} ${days[0].getFullYear()}`
    }
    return formatDate(cursor, { weekday: true })
  }, [view, cursor])

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-room-ink">Lịch</h1>
          <p className="mt-1 text-sm font-semibold text-room-ink/65">Xem công việc theo ngày, tuần hoặc tháng</p>
        </div>
        <Link to="/app/tasks/new">
          <RoomButton icon={Plus}>Tạo công việc</RoomButton>
        </Link>
      </div>

      <RoomCard className="p-4 sm:p-5">
        {/* Thanh điều khiển */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => move(-1)} aria-label="Trước đó" className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-room-ink/60 transition hover:bg-room-oat/75">
              <CaretLeft size={18} weight="bold" />
            </button>
            <button type="button" onClick={() => move(1)} aria-label="Tiếp theo" className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-room-ink/60 transition hover:bg-room-oat/75">
              <CaretRight size={18} weight="bold" />
            </button>
            <button
              type="button"
              onClick={goToday}
              className="ml-1 h-10 cursor-pointer rounded-xl bg-room-oat/45 px-4 text-sm font-bold text-room-ink ring-1 ring-inset ring-room-acorn/20 transition hover:bg-room-oat/75"
            >
              Hôm nay
            </button>
          </div>
          <h2 className="font-display text-lg font-extrabold text-room-ink">{headerLabel}</h2>
          <div className="flex items-center gap-2">
            {hasAnySchedule && (
              <button
                type="button"
                onClick={() => setShowSchedule((v) => !v)}
                aria-pressed={showSchedule}
                className={`flex h-10 cursor-pointer items-center gap-1.5 rounded-xl px-3 text-sm font-bold transition ${
                  showSchedule
                    ? 'bg-room-moss/60 text-room-ink ring-1 ring-room-acorn/25'
                    : 'bg-room-oat/45 text-room-ink/65 hover:bg-room-oat/75'
                }`}
              >
                <GraduationCap size={15} weight="fill" />
                Lịch học
              </button>
            )}
            <RoomSegmented options={VIEWS} value={view} onChange={setView} size="sm" />
          </div>
        </div>

        {/* Lưới */}
        {loading ? (
          <RoomSkeleton className="mt-4 h-[420px]" />
        ) : view === 'month' ? (
          <MonthGrid
            year={cursor.getFullYear()}
            month={cursor.getMonth()}
            tasksByDay={tasksByDay}
            eventsByDay={eventsByDay}
            selected={selected}
            onSelect={(d) => {
              setSelected(d)
              setCursor(d)
            }}
          />
        ) : view === 'week' ? (
          <>
            <WeekGrid tasksByDay={tasksByDay} eventsByDay={eventsByDay} selected={selected} onSelect={setSelected} />
            {showSchedule && hasAnySchedule && (
              <TimeScheduleGrid days={weekDays(selected)} slotsByDay={scheduleSlotsByDay} tasksByDay={tasksByDay} />
            )}
          </>
        ) : (
          <DayView tasks={selectedTasks} events={selectedEvents} day={selected} onSelect={setSelected} />
        )}
      </RoomCard>

      {/* Quản lý lịch ngoài (Google/Outlook .ics) */}
      <ExternalCalendarPanel
        open={calPanelOpen}
        onToggle={() => setCalPanelOpen((v) => !v)}
        calendars={calendars}
        onAdd={handleAddCalendar}
        onRemove={handleRemoveCalendar}
        onSync={handleSyncCalendar}
      />

      {/* Quản lý lịch học (Lớp học — import TKB trường hoặc nhập tay) */}
      <SchedulePanel
        open={schedPanelOpen}
        onToggle={() => setSchedPanelOpen((v) => !v)}
        schedules={schedules}
        busy={schedBusy}
        onImport={handleImportTimetable}
        onImportCsv={handleImportCsv}
        onSaveSchool={handleSaveSchool}
        onConnectSchool={handleConnectSchool}
        onDisconnectSchool={handleDisconnectSchool}
        onSyncSchool={handleSyncSchool}
        onAddSlot={handleAddSlot}
        onRemoveSlot={handleRemoveSlot}
        onClearSlots={handleClearSlots}
        onReload={loadSchedules}
        onCreateClass={onCreateClass}
      />

      {/* Panel chi tiết ngày */}
      <RoomCard className="p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display font-bold text-room-ink">
            <CalendarBlank size={18} weight="fill" className="text-room-acorn" />
            {selectedEvents.length > 0 ? 'Công việc & sự kiện · ' : 'Công việc · '}{formatDate(selected, { weekday: true })}
          </h2>
          <span className="rounded-full bg-room-oat/70 px-2.5 py-0.5 text-xs font-bold text-room-ink/60">{selectedTasks.length} việc{selectedEvents.length > 0 ? ` · ${selectedEvents.length} sự kiện` : ''}</span>
        </div>
        {/* Sự kiện từ lịch ngoài — chỉ xem, không sửa ở đây */}
        {selectedEvents.map((e) => (
          <div key={`evt-${e.externalEventId}`} className="mt-3 flex items-center gap-3 rounded-2xl bg-room-oat/40 p-3">
            <span
              className="flex h-11 w-14 shrink-0 flex-col items-center justify-center rounded-xl text-[10px] font-bold italic"
              style={{
                backgroundColor: e.calendar?.color ? `${e.calendar.color}1a` : '#eaddc7',
                color: e.calendar?.color || '#8b6f4e',
              }}
            >
              <Globe size={12} weight="bold" />
              {e.allDay ? 'Cả ngày' : formatTime(e.startsAt)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-room-ink/85">{e.title}</p>
              <p className="text-[11px] font-semibold text-room-ink/60">Sự kiện lịch ngoài · {e.calendar?.name}</p>
            </div>
          </div>
        ))}
        <div className="mt-4 space-y-2.5">
          {selectedTasks.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <p className="text-sm font-semibold text-room-ink/60">Không có công việc nào trong ngày này</p>
              <Link to="/app/tasks/new" className="btn-link text-sm">
                Tạo công việc cho ngày này
              </Link>
            </div>
          ) : (
            selectedTasks.map((t) => (
              <Link
                key={t.id}
                to={`/app/tasks/${t.id}`}
                className="flex items-center gap-3 rounded-2xl bg-room-paper p-3.5 ring-1 ring-room-acorn/20 transition hover:ring-room-acorn/45"
              >
                <span
                  className="flex h-11 w-14 shrink-0 flex-col items-center justify-center rounded-xl text-[10px] font-bold"
                  style={{
                    backgroundColor: t.category ? `${t.category.color}1a` : '#eaddc7',
                    color: t.category ? t.category.color : '#8b6f4e',
                  }}
                >
                  <Clock size={12} weight="bold" />
                  {formatTime(t.dueAt)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm font-semibold ${t.status === 'COMPLETED' ? 'text-room-ink/55 line-through' : 'text-room-ink'}`}>
                    {t.title}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <RoomStatusChip task={t} />
                    <RoomPriorityChip priority={t.priority} />
                    {t.reminders?.length > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-room-bell">
                        <Bell size={12} weight="fill" /> {t.reminders.length}
                      </span>
                    )}
                    {t.repeatType !== 'NONE' && (
                      <span
                        title={`Lặp lại: ${repeatSummary(t.repeatType, t.repeatDays)}`}
                        className="inline-flex items-center gap-0.5 text-[11px] font-bold text-room-acorn/80"
                      >
                        <Repeat size={12} weight="bold" />
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </RoomCard>
    </div>
  )
}

function MonthGrid({ year, month, tasksByDay, eventsByDay = {}, selected, onSelect }) {
  const cells = buildMonthGrid(year, month)
  const today = new Date()
  return (
    <div className="mt-4 overflow-x-auto">
      <div className="grid min-w-[640px] grid-cols-7 gap-1.5">
        {VI_DAYS.map((d) => (
          <div key={d} className="pb-1 text-center text-xs font-bold uppercase tracking-wider text-room-ink/65">
            {d}
          </div>
        ))}
        {cells.map((date) => {
          const key = formatDayKey(date)
          const dayTasks = tasksByDay[key] || []
          const dayEvents = eventsByDay[key] || []
          const isSelected = isSameDay(date, selected)
          const isToday = isSameDay(date, today)
          const inMonth = isSameMonth(date, new Date(year, month))
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(date)}
              aria-label={`${formatDate(date, { weekday: true })} – ${dayTasks.length} công việc`}
              className={[
                'flex min-h-[84px] cursor-pointer flex-col items-stretch rounded-xl p-1.5 text-left transition-all duration-150',
                'focus-visible:outline-none',
                inMonth ? 'bg-room-oat/35 hover:bg-room-oat/65' : 'bg-transparent opacity-40',
                isSelected ? 'ring-2 ring-room-acorn bg-room-oat/70' : '',
              ].join(' ')}
            >
              <span className="flex items-center justify-between px-0.5">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${
                    isToday ? 'bg-room-acorn text-room-paper' : isSelected ? 'text-room-acorn' : 'text-room-ink/80'
                  }`}
                >
                  {date.getDate()}
                </span>
                {dayTasks.length > 0 && (
                  <span className="rounded-full bg-room-paper px-1.5 text-[10px] font-bold text-room-ink/60 ring-1 ring-room-acorn/20">
                    {dayTasks.length}
                  </span>
                )}
              </span>
              {dayTasks.length > 0 && (
                <span className="mt-1 flex flex-wrap gap-0.5 px-0.5" aria-hidden="true">
                  {dayTasks.slice(0, 4).map((t) => (
                    <span
                      key={t.id}
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: t.category?.color || '#8b6f4e' }}
                      title={t.title}
                    />
                  ))}
                </span>
              )}
              {/* Sự kiện lịch ngoài: chữ nghiêng mảnh, tô màu lịch — nhìn ra khác việc */}
              {dayEvents.length > 0 && (
                <span className="mt-0.5 flex flex-col gap-px px-0.5">
                  {dayEvents.slice(0, 2).map((e) => (
                    <span
                      key={`ev-${e.externalEventId}`}
                      className="truncate text-[10px] font-semibold italic leading-tight"
                      style={{ color: e.calendar?.color || '#8b6f4e' }}
                      title={`Sự kiện lịch ngoài · ${e.title}`}
                    >
                      {e.allDay ? '' : `${formatTime(e.startsAt)} `}{e.title}
                    </span>
                  ))}
                  {dayEvents.length > 2 && (
                    <span className="text-[9px] font-bold text-room-ink/60">+{dayEvents.length - 2} sự kiện</span>
                  )}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function WeekGrid({ tasksByDay, eventsByDay = {}, selected, onSelect }) {
  const days = weekDays(selected)
  const today = new Date()
  return (
    <div className="mt-4 grid grid-cols-7 gap-1.5">
      {days.map((date) => {
        const key = formatDayKey(date)
        const dayTasks = tasksByDay[key] || []
        const dayEvents = eventsByDay[key] || []
        const isToday = isSameDay(date, today)
        const isSelected = isSameDay(date, selected)
        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(date)}
            className={[
              'flex cursor-pointer flex-col rounded-xl p-2 text-left transition focus-visible:outline-none',
              isSelected ? 'bg-room-oat/70 ring-2 ring-room-acorn' : 'bg-room-oat/35 hover:bg-room-oat/65',
            ].join(' ')}
          >
            <span className="flex items-center justify-center gap-1">
              <span className="text-[10px] font-bold uppercase text-room-ink/65">{VI_DAYS_SHORT[date.getDay()]}</span>
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                  isToday ? 'bg-room-acorn text-room-paper' : 'text-room-ink/85'
                }`}
              >
                {date.getDate()}
              </span>
            </span>
            <span className="mt-1.5 space-y-1">
              {dayEvents.slice(0, 2).map((e) => (
                <span
                  key={`ev-${e.externalEventId}`}
                  className="block truncate rounded-md px-1.5 py-0.5 text-[10px] font-semibold italic"
                  style={{
                    backgroundColor: e.calendar?.color ? `${e.calendar.color}1a` : '#eaddc7',
                    color: e.calendar?.color || '#8b6f4e',
                  }}
                >
                  {e.allDay ? 'Ngày' : formatTime(e.startsAt)} {e.title}
                </span>
              ))}
              {dayTasks.slice(0, 3).map((t) => (
                <span
                  key={t.id}
                  className="block truncate rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
                  style={{
                    backgroundColor: t.category ? `${t.category.color}1a` : '#eaddc7',
                    color: t.category ? t.category.color : '#8b6f4e',
                  }}
                >
                  {formatTime(t.dueAt)} {t.title}
                </span>
              ))}
              {dayTasks.length > 3 && (
                <span className="block px-1.5 text-[10px] font-bold text-room-ink/60">+{dayTasks.length - 3} việc nữa</span>
              )}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function DayView({ tasks, events = [], day }) {
  return (
    <div className="mt-4 space-y-2">
      {events.map((e) => (
        <div
          key={`ev-${e.externalEventId}`}
          className="flex items-center gap-3 rounded-xl bg-room-oat/40 p-3"
        >
          <Globe
            size={14}
            weight="fill"
            className="shrink-0"
            style={{ color: e.calendar?.color || '#8b6f4e' }}
            aria-hidden="true"
          />
          <span className="text-sm font-bold italic text-room-ink/85">
            {e.allDay ? 'Cả ngày' : formatTime(e.startsAt)}
          </span>
          <span className="flex-1 truncate text-sm font-semibold text-room-ink/60">{e.title}</span>
        </div>
      ))}
      {tasks.map((t) => (
        <Link
          key={t.id}
          to={`/app/tasks/${t.id}`}
          className="flex items-center gap-3 rounded-xl bg-room-oat/40 p-3 transition hover:bg-room-oat/70"
        >
          <span
            className="h-3 w-3 shrink-0 rounded-full"
            style={{ backgroundColor: t.category?.color || '#8b6f4e' }}
            aria-hidden="true"
          />
          <span className="text-sm font-bold text-room-ink/85">{formatTime(t.dueAt)}</span>
          <span className="flex-1 truncate text-sm font-semibold text-room-ink/75">{t.title}</span>
          <RoomStatusChip task={t} />
        </Link>
      ))}
      {tasks.length === 0 && events.length === 0 && (
        <p className="py-6 text-center text-sm font-semibold text-room-ink/60">Không có công việc · {formatDate(day, { weekday: true })}</p>
      )}
    </div>
  )
}

// ─── Lưới TKB thời gian (Week view + toggle "Lịch học") ───────────
// Vẽ tiết học dạng khối màu theo giờ (kiểu TKB trường); việc cá nhân rơi
// vào đúng khung giờ của tiết nào được tô khung đỏ cản tạo cảnh báo xung đột,
// kèm danh sách gộp bên dưới lưới.
const HOUR_PX = 44
const GRID_MIN_HOUR = 6
const GRID_MAX_HOUR = 22

function timeToMinutes(t) {
  const [h, m] = String(t).split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

function TimeScheduleGrid({ days, slotsByDay, tasksByDay }) {
  const visible = days.flatMap((d) =>
    (slotsByDay[formatDayKey(d)] || []).map((slot) => ({ ...slot, day: d })),
  )
  if (visible.length === 0) return null

  const startHour = Math.min(
    GRID_MIN_HOUR,
    ...visible.map((s) => Math.floor(timeToMinutes(s.startTime) / 60)),
  )
  const endHour = Math.max(
    GRID_MIN_HOUR + 1,
    ...visible.map((s) => Math.min(GRID_MAX_HOUR, Math.ceil(timeToMinutes(s.endTime) / 60))),
  )
  const hours = []
  for (let h = startHour; h < endHour; h += 1) hours.push(h)
  const gridH = (endHour - startHour) * HOUR_PX
  const today = new Date()

  // Xung đột: việc cá nhân có dueAt rơi vào đúng khung tiết học của ngày đó
  const conflicts = []
  days.forEach((d) => {
    const key = formatDayKey(d)
    const dayTasks = tasksByDay[key] || []
    ;(slotsByDay[key] || []).forEach((slot) => {
      const sMin = timeToMinutes(slot.startTime)
      const eMin = timeToMinutes(slot.endTime)
      dayTasks.forEach((t) => {
        const at = new Date(t.dueAt)
        const m = at.getHours() * 60 + at.getMinutes()
        if (m >= sMin && m < eMin) {
          conflicts.push({ slot, task: t, day: d })
        }
      })
    })
  })

  return (
    <div className="mt-5 overflow-x-auto">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-room-ink/65">
        <GraduationCap size={14} weight="fill" className="text-room-acorn" />
        Lịch học bách khoa (Tiết lặp hằng tuần)
        {conflicts.length > 0 && (
          <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-room-bell/25 px-2 py-0.5 text-[11px] font-bold text-room-ink ring-1 ring-room-bell/50 dark:bg-room-bell/20">
            <WarningCircle size={12} weight="fill" /> {conflicts.length} xung đột với việc cá nhân
          </span>
        )}
      </p>
      <div className="grid min-w-[760px] grid-cols-[48px_repeat(7,1fr)]">
        {/* Header */}
        <div />
        {VI_DAYS.map((d, i) => {
          const dayDate = days[i]
          const isToday = isSameDay(dayDate, today)
          return (
            <div key={d} className="pb-1 text-center text-[11px] font-bold uppercase tracking-wide text-room-ink/65">
              {d.replace('Th ', 'T')}
              <span className={`ml-1 ${isToday ? 'text-room-acorn' : 'text-room-ink/60'}`}>
                {dayDate.getDate()}
              </span>
            </div>
          )
        })}
        {/* Body */}
        <div className="relative" style={{ height: gridH }}>
          {hours.map((h) => (
            <span key={h} className="absolute right-1 -translate-y-1/2 text-[9px] font-semibold text-room-ink/60" style={{ top: (h - startHour) * HOUR_PX }}>
              {String(h).padStart(2, '0')}
            </span>
          ))}
        </div>
        {days.map((day) => {
          const key = formatDayKey(day)
          return (
            <div key={key} className="relative border-l border-dashed border-room-acorn/20" style={{ height: gridH }}>
              {hours.map((h) => (
                <span key={h} className="absolute inset-x-0 border-t border-dashed border-room-acorn/15" style={{ top: (h - startHour) * HOUR_PX, height: 0 }} />
              ))}
              {(slotsByDay[key] || []).map((slot) => {
                const sMin = timeToMinutes(slot.startTime)
                const eMin = timeToMinutes(slot.endTime)
                const top = ((sMin - startHour * 60) / 60) * HOUR_PX
                const h = Math.max(22, ((eMin - sMin) / 60) * HOUR_PX - 2)
                const conflicted = conflicts.some((c) => c.slot.scheduleSlotId === slot.scheduleSlotId)
                const color = slot.colorCode || '#8b6f4e'
                return (
                  <div
                    key={slot.scheduleSlotId}
                    className={`absolute overflow-hidden rounded-md px-1 py-0.5 text-[10px] font-semibold leading-tight ${
                      conflicted ? 'ring-2 ring-room-bell' : ''
                    }`}
                    style={{
                      top,
                      height: h,
                      backgroundColor: `${color}22`,
                      color,
                      borderLeft: `3px solid ${color}`,
                    }}
                    title={`${slot.title} · ${slot.startTime}–${slot.endTime}${slot.room ? ` · ${slot.room}` : ''}${conflicted ? ' · XUNG ĐỘT với việc cá nhân' : ''}`}
                  >
                    <span className="block truncate font-bold">{slot.title}</span>
                    <span className="block truncate text-[9px] opacity-80">
                      {slot.startTime}–{slot.endTime}{slot.room ? ` · ${slot.room}` : ''}
                    </span>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
      {/* Danh sách cảnh báo xung đột */}
      {conflicts.length > 0 && (
        <div className="mt-3 space-y-1.5 rounded-xl bg-room-bell/20 p-3 ring-1 ring-room-bell/40 dark:bg-room-bell/15">
          {conflicts.map((c) => (
            <div key={`${c.task.id}-${c.slot.scheduleSlotId}`} className="flex items-start gap-2 text-[12px] font-semibold text-room-ink/85">
              <WarningCircle size={14} weight="fill" className="mt-0.5 shrink-0 text-room-bell" />
              <span>
                <Link to={`/app/tasks/${c.task.id}`} className="underline decoration-room-bell decoration-2 underline-offset-2">{c.task.title}</Link>
                {' '}rơi vào giờ lớp <strong>{c.slot.title}</strong> ({c.slot.startTime}–{c.slot.endTime} ngày {formatDayKey(c.day).split('-').reverse().join('/')})
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Panel quản lý lịch học (Lớp học) ────────────────────
// Tạo Lớp học → đặt tên trường + URL .ics TKB → import lưới tiết (XÓA tiết
// cũ) hoặc nhập tay từng tiết. Cũ nhất của trang Lịch — cùng section với
// panel lịch ngoài để mọi nguồn lịch quản lý ở một chỗ.
function SchedulePanel({ open, onToggle, schedules, busy, onImport, onImportCsv, onSaveSchool, onConnectSchool, onDisconnectSchool, onSyncSchool, onAddSlot, onRemoveSlot, onClearSlots, onReload, onCreateClass }) {
  const [createName, setCreateName] = useState('')
  const [schoolName, setSchoolName] = useState('')
  const [url, setUrl] = useState('')
  // ── Kết nối tài khoản trường (kiểu OneUni): chọn trường → nhập tài khoản
  // + mật khẩu trường → hệ thống tự đồng bộ TKB mỗi ngày.
  const [schools, setSchools] = useState([])
  const [connect, setConnect] = useState({ schoolCode: '', username: '', password: '', show: false })
  const [manualOpen, setManualOpen] = useState(false)

  useEffect(() => {
    if (!open || schools.length) return
    let cancelled = false
    ;(async () => {
      const res = await listSchools()
      if (!cancelled && res.success) setSchools(res.data || [])
    })()
    return () => {
      cancelled = true
    }
  }, [open, schools.length])
  // Nhập CSV: dán trực tiếp nội dung file trường xuất ra, hoặc dán link tải
  const [csvOpen, setCsvOpen] = useState(false)
  const [csvText, setCsvText] = useState('')
  const [csvUrl, setCsvUrl] = useState('')
  const [slotFormOpen, setSlotFormOpen] = useState(false)
  const [slot, setSlot] = useState({ title: '', weekDay: 2, startTime: '07:30', endTime: '09:15', room: '' })

  const current = schedules[0]
  const school = current?.school
  // Trường chưa có connector riêng: đăng nhập trên trang trường rồi để
  // extension gửi phiên về (không nhập mật khẩu trong app).
  const selectedSchool = schools.find((s) => s.code === connect.schoolCode)
  const sessionSchool = !!selectedSchool?.requiresSession

  const submitCreate = async (ev) => {
    ev.preventDefault()
    if (createName.trim()) {
      const ok = await onCreateClass(createName.trim())
      if (ok?.success) setCreateName('')
    }
  }

  const submitConnect = async (ev) => {
    ev.preventDefault()
    if (!connect.schoolCode || !connect.username.trim() || !connect.password) return
    const res = await onConnectSchool({
      schoolCode: connect.schoolCode,
      username: connect.username.trim(),
      password: connect.password,
    })
    // Xoá mật khẩu khỏi state ngay sau khi gửi — không giữ trong bộ nhớ UI
    if (res?.success) setConnect((c) => ({ ...c, password: '' }))
  }

  const submitImport = async (ev) => {
    ev.preventDefault()
    // Lưu tên trường + URL rồi kéo ngay — hai bước một nhịp cho lần đầu thiết lập
    if (schoolName.trim() || url.trim()) {
      if (!school) await onSaveSchool({ name: schoolName.trim() || 'Trường của lớp', icsUrl: url.trim() || undefined })
    }
    if (url.trim()) {
      await onImport(url.trim())
      setUrl('')
    } else if (school?.icsUrl) {
      await onImport(undefined)
    } else if (!schoolName.trim()) {
      // cả 3 trường trống thì thôi
    }
  }

  const submitCsv = async (ev) => {
    ev.preventDefault()
    if (!csvText.trim() && !csvUrl.trim()) return
    const res = await onImportCsv({ csv: csvText.trim() || undefined, csvUrl: csvUrl.trim() || undefined })
    if (res?.success) {
      setCsvText('')
      setCsvUrl('')
      setCsvOpen(false)
    }
  }

  const submitSlot = async (ev) => {
    ev.preventDefault()
    if (!slot.title.trim()) return
    const res = await onAddSlot({
      title: slot.title.trim(),
      weekDay: Number(slot.weekDay),
      startTime: slot.startTime,
      endTime: slot.endTime,
      room: slot.room.trim() || undefined,
    })
    if (res?.success) {
      setSlot({ title: '', weekDay: 2, startTime: '07:30', endTime: '09:15', room: '' })
      setSlotFormOpen(false)
    }
  }

  return (
    <RoomCard className="p-4 sm:p-5">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full cursor-pointer items-center justify-between gap-3 text-left">
        <span className="flex items-center gap-2 font-display font-bold text-room-ink">
          <GraduationCap size={18} weight="fill" className="text-room-acorn" />
          Lịch học (Lớp học)
          {schedules.length > 0 && school?.slots?.length > 0 && (
            <span className="rounded-full bg-room-oat/70 px-2.5 py-0.5 text-xs font-bold text-room-ink/70">
              {school.slots.length} tiết
            </span>
          )}
        </span>
        <CaretDown size={16} weight="bold" className={`text-room-ink/60 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="mt-4 space-y-3">
          {schedules.length === 0 ? (
            <form onSubmit={submitCreate} className="flex flex-wrap items-end gap-2 rounded-xl bg-room-oat/35 p-3 ring-1 ring-room-acorn/15">
              <div className="min-w-[220px] flex-1">
                <label htmlFor="ws-class-name" className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-room-ink/65">Tên lớp học</label>
                <input id="ws-class-name" value={createName} onChange={(e) => setCreateName(e.target.value)}
                  placeholder="VD: Lớp CNTT K19 · Nhóm đồ án 3"
                  className={roomFieldCls} />
              </div>
              <RoomButton type="submit" size="sm" disabled={busy}>Tạo Lớp học</RoomButton>
              <p className="w-full text-[11px] font-semibold leading-relaxed text-room-ink/60">
                Gói miễn phí: 1 lớp. Tạo xong đi tên trường + dán URL .ics TKB phía dưới.
              </p>
            </form>
          ) : (
            <>
              {/* Kết nối tài khoản trường — luồng chính (giống OneUni) */}
              {school?.connection ? (
                <div className="rounded-xl bg-room-sage/25 p-3 ring-1 ring-room-acorn/20">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-room-ink">
                        Đã kết nối {school.name}
                        {school.connection.mssv ? ` · MSSV ${school.connection.mssv}` : ''}
                      </p>
                      <p className="mt-0.5 text-[11.5px] font-semibold text-room-ink/60">
                        Tài khoản {school.connection.username} ·{' '}
                        {school.connection.lastSyncedAt
                          ? `đồng bộ ${new Date(school.connection.lastSyncedAt).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`
                          : 'chưa đồng bộ lần nào'}
                        {school.connection.status === 'ERROR' ? ' · đang lỗi' : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <RoomButton size="sm" loading={busy} onClick={onSyncSchool}>
                        Đồng bộ ngay
                      </RoomButton>
                      <RoomButton variant="danger" size="sm" disabled={busy}
                        onClick={() => {
                          if (window.confirm('Ngắt kết nối tài khoản trường? Mật khẩu đã lưu sẽ bị xoá, tiết đã đồng bộ vẫn giữ.')) onDisconnectSchool()
                        }}>
                        Ngắt kết nối
                      </RoomButton>
                    </div>
                  </div>
                  {school.connection.lastError && (
                    <p className="mt-2 rounded-lg bg-room-rain/35 px-2 py-1.5 text-[11.5px] font-semibold text-room-ink/80 ring-1 ring-room-rain">
                      {school.connection.lastError}
                    </p>
                  )}
                </div>
              ) : (
                <form onSubmit={submitConnect} className="space-y-2 rounded-xl bg-room-oat/35 p-3 ring-1 ring-room-acorn/15">
                  <p className="text-[12px] font-bold text-room-ink/70">Đăng nhập tài khoản trường</p>
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="min-w-[190px] flex-1">
                      <label htmlFor="school-code" className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-room-ink/65">Trường</label>
                      <select id="school-code" value={connect.schoolCode}
                        onChange={(e) => setConnect({ ...connect, schoolCode: e.target.value })}
                        className={`${roomSelectCls} h-10 w-full text-sm`}
                        style={roomSelectArrowStyle}>
                        <option value="">— Chọn trường —</option>
                        {schools.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
                      </select>
                    </div>
                    {sessionSchool ? (
                      <div className="min-w-[280px] flex-[2] rounded-lg bg-room-rain/25 px-3 py-2 text-[11.5px] font-semibold leading-relaxed text-room-ink/85 ring-1 ring-room-rain">
                        <strong>Đăng nhập trên trang trường, không nhập ở đây.</strong> Mở cổng trường, đăng nhập, vào trang thời khoá biểu,
                        rồi bấm <strong>“Kết nối trường này”</strong> trên extension MN-Qronx. App chỉ giữ phiên đã mã hoá, không lưu mật khẩu.
                      </div>
                    ) : (
                      <>
                        <div className="min-w-[160px] flex-1">
                          <label htmlFor="school-user" className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-room-ink/65">
                            {selectedSchool?.usernameLabel || 'Tài khoản trường'}
                          </label>
                          <input id="school-user" autoComplete="username" value={connect.username}
                            onChange={(e) => setConnect({ ...connect, username: e.target.value })}
                            placeholder={selectedSchool?.usernamePlaceholder || ''}
                            className={roomFieldCls} />
                        </div>
                        <div className="min-w-[160px] flex-1">
                          <label htmlFor="school-pass" className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-room-ink/65">Mật khẩu trường</label>
                          <input id="school-pass" type={connect.show ? 'text' : 'password'} autoComplete="current-password"
                            value={connect.password} onChange={(e) => setConnect({ ...connect, password: e.target.value })}
                            className={roomFieldCls} />
                        </div>
                        <RoomButton type="submit" size="sm" disabled={busy || !connect.schoolCode || !connect.username.trim() || !connect.password}>
                          {busy ? 'Đang đăng nhập…' : 'Đăng nhập & đồng bộ'}
                        </RoomButton>
                      </>
                    )}
                  </div>
                  {!sessionSchool && (
                    <>
                      <label className="flex w-fit cursor-pointer items-center gap-1.5 text-[11px] font-semibold text-room-ink/60">
                        <input type="checkbox" checked={connect.show} onChange={(e) => setConnect({ ...connect, show: e.target.checked })} />
                        Hiện mật khẩu
                      </label>
                      <p className="text-[11px] font-semibold leading-relaxed text-room-ink/60">
                        Hệ thống dùng tài khoản này để <strong>chỉ đọc thời khoá biểu</strong>, không đăng ký môn hay sửa gì trên cổng trường.
                        Mật khẩu được mã hoá khi lưu và chỉ dùng để tự đồng bộ mỗi ngày; bạn có thể ngắt kết nối bất cứ lúc nào.
                      </p>
                    </>
                  )}
                  {!schools.length && (
                    <p className="text-[11px] font-semibold text-room-ink/60">Đang tải danh mục trường… nếu trường bạn chưa có, dùng mục nhập thủ công bên dưới.</p>
                  )}
                </form>
              )}

              <details open={manualOpen} onToggle={(e) => setManualOpen(e.target.open)}
                className="rounded-xl bg-room-oat/35 p-3 ring-1 ring-room-acorn/15">
                <summary className="cursor-pointer text-[12px] font-bold text-room-ink/60">
                  Nhập thủ công (.ics / CSV) — cho trường chưa hỗ trợ đăng nhập
                </summary>
              <form onSubmit={submitImport} className="mt-2 flex flex-wrap items-end gap-2">
                <div className="min-w-[180px] flex-1">
                  <label htmlFor="sched-school" className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-room-ink/65">Trường của lớp</label>
                  <input id="sched-school" value={schoolName || school?.name || ''} onChange={(e) => setSchoolName(e.target.value)}
                    placeholder="VD: ĐH Bách Khoa TP.HCM"
                    className={roomFieldCls} />
                </div>
                <div className="min-w-[260px] flex-[2]">
                  <label htmlFor="sched-url" className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-room-ink/65">URL .ics TKB (tùy chọn)</label>
                  <input id="sched-url" type="url" value={url} onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://.../thoi-khoa-bieu.ics"
                    className={roomFieldCls} />
                </div>
                <RoomButton type="submit" size="sm" loading={busy}>{busy ? 'Đang nhập…' : 'Đồng bộ TKB'}</RoomButton>
                {school?.slots?.length > 0 && (
                  <button type="button" disabled={busy}
                    onClick={() => {
                      if (window.confirm('Xoá sạch toàn bộ tiết học của lớp?')) onClearSlots()
                    }}
                    className="h-10 cursor-pointer rounded-xl px-3 text-sm font-bold text-room-ink/60 ring-1 ring-inset ring-room-acorn/20 transition hover:bg-room-oat/75 disabled:opacity-60">
                    Xoá lịch
                  </button>
                )}
              </form>
              {school?.lastError && (
                <p className="rounded-lg bg-room-rain/35 p-2 text-[12px] font-semibold text-room-ink/80 ring-1 ring-room-rain">{school.lastError}</p>
              )}

              {/* Nguồn thứ hai: cổng trường chỉ cho tải Excel/CSV. Dán nội dung
                  hoặc link tải — cùng đích ScheduleSlot với TKB .ics. */}
              {csvOpen ? (
                <form onSubmit={submitCsv} className="space-y-2 rounded-xl bg-room-oat/35 p-3 ring-1 ring-room-acorn/15">
                  <label htmlFor="sched-csv" className="block text-[11px] font-bold uppercase tracking-wide text-room-ink/65">
                    Dán nội dung CSV (cột: Môn học, Thứ, Bắt đầu, Kết thúc, Phòng)
                  </label>
                  <textarea id="sched-csv" rows={4} value={csvText} onChange={(e) => setCsvText(e.target.value)}
                    placeholder={'Môn học,Thứ,Bắt đầu,Kết thúc,Phòng\nCông nghệ phần mềm,Thứ 2,07:30,09:15,A101'}
                    className={`${roomFieldCls} font-mono text-[12px]`} />
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="min-w-[240px] flex-1">
                      <label htmlFor="sched-csv-url" className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-room-ink/65">hoặc link CSV công khai (tùy chọn)</label>
                      <input id="sched-csv-url" type="url" value={csvUrl} onChange={(e) => setCsvUrl(e.target.value)}
                        placeholder="https://.../thoi-khoa-bieu.csv"
                        className={roomFieldCls} />
                    </div>
                    <RoomButton type="submit" size="sm" loading={busy}>{busy ? 'Đang nhập…' : 'Nhập CSV'}</RoomButton>
                    <button type="button" onClick={() => setCsvOpen(false)}
                      className="h-10 cursor-pointer rounded-xl px-3 text-sm font-bold text-room-ink/60 transition hover:bg-room-oat/75">Hủy</button>
                  </div>
                  <p className="text-[11px] font-semibold leading-relaxed text-room-ink/60">
                    Nhập CSV sẽ thay toàn bộ tiết hiện có của lớp. Cột Thứ nhận "Thứ 2"/"T2"/"Monday", giờ nhận "07:30" hoặc "7h30".
                  </p>
                </form>
              ) : (
                <button type="button" onClick={() => setCsvOpen(true)} className="btn-link cursor-pointer text-sm font-bold">
                  + Nhập TKB từ CSV
                </button>
              )}
              </details>

              <div className="space-y-1.5">
                {(school?.slots || []).map((s) => (
                  <div key={s.scheduleSlotId} className="flex items-center gap-2 rounded-lg bg-room-paper p-2 ring-1 ring-room-acorn/15">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.colorCode || '#8b6f4e' }} aria-hidden="true" />
                    <span className="text-xs font-bold text-room-ink/75">{VI_DAYS_SHORT[s.weekDay === 7 ? 0 : s.weekDay]}</span>
                    <span className="text-xs font-semibold text-room-ink/60">{s.startTime}–{s.endTime}</span>
                    <span className="min-w-0 flex-1 truncate text-sm font-bold text-room-ink/85">{s.title}</span>
                    {s.room && <span className="truncate text-[11px] font-semibold text-room-ink/60">{s.room}</span>}
                    <button type="button" onClick={() => onRemoveSlot(s.scheduleSlotId)} title="Xoá tiết học"
                      className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-room-ink/60 transition hover:bg-room-oat/70 hover:text-room-acorn">
                      <TrashSimple size={15} weight="bold" />
                    </button>
                  </div>
                ))}
                {school?.slots?.length === 0 && (
                  <p className="py-2 text-center text-xs font-semibold text-room-ink/65">Chưa có tiết nào — đồng bộ TKB hoặc thêm thủ công bên dưới.</p>
                )}
              </div>

              {slotFormOpen ? (
                <form onSubmit={submitSlot} className="flex flex-wrap items-end gap-2 rounded-xl bg-room-oat/35 p-3 ring-1 ring-room-acorn/15">
                  <div className="min-w-[160px] flex-[2]">
                    <label htmlFor="slot-title" className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-room-ink/65">Tên môn</label>
                    <input id="slot-title" value={slot.title} onChange={(e) => setSlot({ ...slot, title: e.target.value })}
                      placeholder="VD: Công nghệ phần mềm"
                      className={roomFieldCls} />
                  </div>
                  <select id="slot-day" value={slot.weekDay} onChange={(e) => setSlot({ ...slot, weekDay: e.target.value })}
                    className={roomSelectClsSmall}
                    style={roomSelectArrowStyle}>
                    {[1,2,3,4,5,6,7].map((wd) => <option key={wd} value={wd}>{VI_DAYS_SHORT[wd === 7 ? 0 : wd]}</option>)}
                  </select>
                  <input aria-label="Bắt đầu" value={slot.startTime} onChange={(e) => setSlot({ ...slot, startTime: e.target.value })}
                    className={roomFieldSliceCls} />
                  <input aria-label="Kết thúc" value={slot.endTime} onChange={(e) => setSlot({ ...slot, endTime: e.target.value })}
                    className={roomFieldSliceCls} />
                  <RoomButton type="submit" size="sm">Thêm</RoomButton>
                  <button type="button" onClick={() => setSlotFormOpen(false)} className="h-10 cursor-pointer rounded-xl px-3 text-sm font-bold text-room-ink/60 transition hover:bg-room-oat/75">Hủy</button>
                </form>
              ) : (
                <button type="button" onClick={() => setSlotFormOpen(true)} className="btn-link cursor-pointer text-sm font-bold">
                  + Thêm tiết thủ công
                </button>
              )}
            </>
          )}
        </div>
      )}
    </RoomCard>
  )
}
// Khách dán "Secret address in iCal format" của Google (hoặc link xuất .ics
// của Outlook/iCloud) trong Google Calendar → Settings → "Settings for my
// calendars" → "Integrate calendar". Backend tự kéo mỗi giờ, không cần khác.
function ExternalCalendarPanel({ open, onToggle, calendars, onAdd, onRemove, onSync }) {
  const [formOpen, setFormOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (ev) => {
    ev.preventDefault()
    if (!url.trim() || busy) return
    setBusy(true)
    await onAdd(url.trim(), name.trim())
    setBusy(false)
    setUrl('')
    setName('')
    setFormOpen(false)
  }

  return (
    <RoomCard className="p-4 sm:p-5">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center justify-between gap-3 text-left"
      >
        <span className="flex items-center gap-2 font-display font-bold text-room-ink">
          <Globe size={18} weight="fill" className="text-room-rain" />
          Lịch ngoài (Google Calendar / Outlook)
          {calendars.length > 0 && (
            <span className="rounded-full bg-room-rain/35 px-2.5 py-0.5 text-xs font-bold text-room-ink/75">
              {calendars.length}
            </span>
          )}
        </span>
        <CaretDown
          size={16}
          weight="bold"
          className={`text-room-ink/60 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="mt-4 space-y-3">
          <p className="text-xs font-semibold leading-relaxed text-room-ink/60">
            Dán <strong>“Secret address in iCal format”</strong> của lịch Google (Settings → Integrate calendar)
            hoặc link xuất .ics của Outlook/iCloud — sự kiện sẽ hiện trên lịch MN-Qronx, tự cập nhật mỗi giờ.
          </p>

          {calendars.map((cal) => (
            <div
              key={cal.externalCalendarId}
              className="flex flex-wrap items-center gap-3 rounded-xl bg-room-oat/40 p-3"
            >
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: cal.color }}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-room-ink/85">{cal.name}</p>
                <p className="truncate text-[11px] font-semibold text-room-ink/60">
                  {cal._count?.events ?? 0} sự kiện
                  {cal.lastSyncedAt ? ` · đồng bộ ${formatDate(cal.lastSyncedAt, { time: true })}` : ' · chưa đồng bộ'}
                  {cal.lastError ? ` · ${cal.lastError}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onSync(cal.externalCalendarId)}
                title="Kéo sự kiện ngay"
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-room-ink/60 transition hover:bg-room-oat/70 hover:text-room-acorn"
              >
                <ArrowsClockwise size={16} weight="bold" />
              </button>
              <button
                type="button"
                onClick={() => onRemove(cal.externalCalendarId)}
                title="Xoá lịch ngoài"
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-room-ink/60 transition hover:bg-room-oat/70 hover:text-room-acorn"
              >
                <TrashSimple size={16} weight="bold" />
              </button>
            </div>
          ))}

          {formOpen ? (
            <form onSubmit={submit} className="flex flex-wrap items-end gap-2 rounded-xl bg-room-oat/35 p-3 ring-1 ring-room-acorn/15">
              <div className="min-w-[220px] flex-1">
                <label htmlFor="ext-cal-name" className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-room-ink/65">Tên lịch</label>
                <input
                  id="ext-cal-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="VD: Lịch học"
                  className={roomFieldCls}
                />
              </div>
              <div className="min-w-[280px] flex-[2]">
                <label htmlFor="ext-cal-url" className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-room-ink/65">URL .ics</label>
                <input
                  id="ext-cal-url"
                  type="url"
                  required
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://calendar.google.com/calendar/ical/.../basic.ics"
                  className={roomFieldCls}
                />
              </div>
              <div className="flex gap-2">
                <RoomButton type="submit" size="sm" loading={busy}>{busy ? 'Đang kéo sự kiện…' : 'Thêm'}</RoomButton>
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="h-10 cursor-pointer rounded-xl px-3 text-sm font-bold text-room-ink/60 transition hover:bg-room-oat/75"
                >
                  Hủy
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className="btn-link cursor-pointer text-sm font-bold"
            >
              + Thêm lịch ngoài
            </button>
          )}
        </div>
      )}
    </RoomCard>
  )
}
