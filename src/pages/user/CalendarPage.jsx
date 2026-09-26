import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CaretLeft,
  CaretRight,
  CalendarBlank,
  Plus,
  Clock,
  Bell,
  Repeat,
} from '@phosphor-icons/react'
import { getAllTasks } from '../../services/taskService'
import { repeatSummary } from '../../lib/constants'
import { Skeleton } from '../../components/common/Feedback'
import Button from '../../components/common/Button'
import { StatusBadge, PriorityBadge } from '../../components/common/Badge'
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

const VIEWS = [
  { value: 'month', label: 'Tháng' },
  { value: 'week', label: 'Tuần' },
  { value: 'day', label: 'Ngày' },
]

export default function CalendarPage() {
  const [view, setView] = useState('month')
  const [cursor, setCursor] = useState(new Date())
  const [selected, setSelected] = useState(new Date())
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)

  const range = useMemo(() => {
    if (view === 'month') {
      const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
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

  const selectedTasks = tasksByDay[formatDayKey(selected)] || []

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
          <h1 className="page-title dark:text-white">Lịch</h1>
          <p className="mt-1 text-sm font-medium text-navy-400 dark:text-slate-500">Xem công việc theo ngày, tuần hoặc tháng</p>
        </div>
        <Link to="/app/tasks/new">
          <Button variant="gradient" icon={Plus}>Tạo công việc</Button>
        </Link>
      </div>

      <div className="card p-4 sm:p-5">
        {/* Thanh điều khiển */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => move(-1)} aria-label="Trước đó" className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-navy-600 transition hover:bg-navy-50 dark:text-slate-300 dark:hover:bg-slate-700">
              <CaretLeft size={18} weight="bold" />
            </button>
            <button type="button" onClick={() => move(1)} aria-label="Tiếp theo" className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-navy-600 transition hover:bg-navy-50 dark:text-slate-300 dark:hover:bg-slate-700">
              <CaretRight size={18} weight="bold" />
            </button>
            <button
              type="button"
              onClick={goToday}
              className="ml-1 h-10 cursor-pointer rounded-xl bg-navy-50 px-4 text-sm font-bold text-navy-700 ring-1 ring-inset ring-navy-100 transition hover:bg-navy-100 dark:bg-slate-700 dark:text-slate-200 dark:ring-slate-600 dark:hover:bg-slate-600"
            >
              Hôm nay
            </button>
          </div>
          <h2 className="text-lg font-extrabold text-navy-900 dark:text-white">{headerLabel}</h2>
          <div className="flex rounded-xl bg-navy-100/80 p-1 dark:bg-slate-700/80" role="radiogroup" aria-label="Chế độ xem lịch">
            {VIEWS.map((v) => (
              <button
                key={v.value}
                type="button"
                role="radio"
                aria-checked={view === v.value}
                onClick={() => setView(v.value)}
                className={`cursor-pointer rounded-lg px-4 py-1.5 text-sm font-semibold transition ${
                  view === v.value ? 'bg-white text-navy-900 shadow-sm dark:bg-slate-600 dark:text-white' : 'text-navy-500 hover:text-navy-800 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>

        {/* Lưới */}
        {loading ? (
          <Skeleton className="mt-4 h-[420px]" />
        ) : view === 'month' ? (
          <MonthGrid
            year={cursor.getFullYear()}
            month={cursor.getMonth()}
            tasksByDay={tasksByDay}
            selected={selected}
            onSelect={(d) => {
              setSelected(d)
              setCursor(d)
            }}
          />
        ) : view === 'week' ? (
          <WeekGrid tasksByDay={tasksByDay} selected={selected} onSelect={setSelected} />
        ) : (
          <DayView tasks={selectedTasks} day={selected} onSelect={setSelected} />
        )}
      </div>

      {/* Panel chi tiết ngày */}
      <section className="card p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-bold text-navy-900 dark:text-white">
            <CalendarBlank size={18} weight="fill" className="text-blue-600 dark:text-blue-400" />
            Công việc · {formatDate(selected, { weekday: true })}
          </h2>
          <span className="rounded-full bg-navy-100 px-2.5 py-0.5 text-xs font-bold text-navy-500 dark:bg-slate-700 dark:text-slate-400">{selectedTasks.length} việc</span>
        </div>
        <div className="mt-4 space-y-2.5">
          {selectedTasks.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <p className="text-sm font-medium text-navy-400 dark:text-slate-500">Không có công việc nào trong ngày này</p>
              <Link to="/app/tasks/new" className="btn-link text-sm">
                Tạo công việc cho ngày này
              </Link>
            </div>
          ) : (
            selectedTasks.map((t) => (
              <Link
                key={t.id}
                to={`/app/tasks/${t.id}`}
                className="flex items-center gap-3 rounded-2xl bg-white p-3.5 shadow-card ring-1 ring-navy-100/80 transition hover:shadow-card-hover hover:ring-blue-200 dark:bg-slate-800 dark:ring-slate-700/80 dark:hover:ring-blue-500/50"
              >
                <span
                  className="flex h-11 w-14 shrink-0 flex-col items-center justify-center rounded-xl text-[10px] font-bold"
                  style={{
                    backgroundColor: t.category ? `${t.category.color}1a` : '#eef2f7',
                    color: t.category ? t.category.color : '#64748b',
                  }}
                >
                  <Clock size={12} weight="bold" />
                  {formatTime(t.dueAt)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm font-semibold ${t.status === 'COMPLETED' ? 'text-navy-300 line-through dark:text-slate-500' : 'text-navy-900 dark:text-white'}`}>
                    {t.title}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <StatusBadge status={effectiveStatus(t)} />
                    <PriorityBadge priority={t.priority} />
                    {t.reminders?.length > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-amber-500">
                        <Bell size={12} weight="fill" /> {t.reminders.length}
                      </span>
                    )}
                    {t.repeatType !== 'NONE' && (
                      <span
                        title={`Lặp lại: ${repeatSummary(t.repeatType, t.repeatDays)}`}
                        className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-purple-400"
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
      </section>
    </div>
  )
}

function MonthGrid({ year, month, tasksByDay, selected, onSelect }) {
  const cells = buildMonthGrid(year, month)
  const today = new Date()
  return (
    <div className="mt-4 overflow-x-auto">
      <div className="grid min-w-[640px] grid-cols-7 gap-1.5">
        {VI_DAYS.map((d) => (
          <div key={d} className="pb-1 text-center text-xs font-bold uppercase tracking-wider text-navy-400 dark:text-slate-500">
            {d}
          </div>
        ))}
        {cells.map((date) => {
          const key = formatDayKey(date)
          const dayTasks = tasksByDay[key] || []
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
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
                inMonth ? 'bg-navy-50/70 hover:bg-navy-100/80 dark:bg-slate-800/70 dark:hover:bg-slate-700/80' : 'bg-transparent opacity-40',
                isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : '',
              ].join(' ')}
            >
              <span className="flex items-center justify-between px-0.5">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${
                    isToday ? 'bg-brand-gradient text-white' : isSelected ? 'text-blue-700 dark:text-blue-400' : 'text-navy-700 dark:text-slate-300'
                  }`}
                >
                  {date.getDate()}
                </span>
                {dayTasks.length > 0 && (
                  <span className="rounded-full bg-white px-1.5 text-[10px] font-bold text-navy-500 ring-1 ring-navy-100 dark:bg-slate-700 dark:text-slate-400 dark:ring-slate-600">
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
                      style={{ backgroundColor: t.category?.color || '#94a3b8' }}
                      title={t.title}
                    />
                  ))}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function WeekGrid({ tasksByDay, selected, onSelect }) {
  const days = weekDays(selected)
  const today = new Date()
  return (
    <div className="mt-4 grid grid-cols-7 gap-1.5">
      {days.map((date) => {
        const key = formatDayKey(date)
        const dayTasks = tasksByDay[key] || []
        const isToday = isSameDay(date, today)
        const isSelected = isSameDay(date, selected)
        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(date)}
            className={[
              'flex cursor-pointer flex-col rounded-xl p-2 text-left transition',
              isSelected ? 'bg-blue-50 ring-2 ring-blue-500 dark:bg-blue-900/30' : 'bg-navy-50/70 hover:bg-navy-100/80 dark:bg-slate-800/70 dark:hover:bg-slate-700/80',
            ].join(' ')}
          >
            <span className="flex items-center justify-center gap-1">
              <span className="text-[10px] font-bold uppercase text-navy-400 dark:text-slate-500">{VI_DAYS_SHORT[date.getDay()]}</span>
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                  isToday ? 'bg-brand-gradient text-white' : 'text-navy-800 dark:text-slate-200'
                }`}
              >
                {date.getDate()}
              </span>
            </span>
            <span className="mt-1.5 space-y-1">
              {dayTasks.slice(0, 3).map((t) => (
                <span
                  key={t.id}
                  className="block truncate rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
                  style={{
                    backgroundColor: t.category ? `${t.category.color}1a` : '#e2e8f0',
                    color: t.category ? t.category.color : '#64748b',
                  }}
                >
                  {formatTime(t.dueAt)} {t.title}
                </span>
              ))}
              {dayTasks.length > 3 && (
                <span className="block px-1.5 text-[10px] font-bold text-navy-400">+{dayTasks.length - 3} việc nữa</span>
              )}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function DayView({ tasks, day }) {
  return (
    <div className="mt-4 space-y-2">
      {tasks.map((t) => (
        <Link
          key={t.id}
          to={`/app/tasks/${t.id}`}
          className="flex items-center gap-3 rounded-xl bg-navy-50/70 p-3 transition hover:bg-navy-100/80 dark:bg-slate-800/70 dark:hover:bg-slate-700/80"
        >
          <span
            className="h-3 w-3 shrink-0 rounded-full"
            style={{ backgroundColor: t.category?.color || '#94a3b8' }}
            aria-hidden="true"
          />
          <span className="text-sm font-bold text-navy-800 dark:text-slate-200">{formatTime(t.dueAt)}</span>
          <span className="flex-1 truncate text-sm font-medium text-navy-700 dark:text-slate-300">{t.title}</span>
          <StatusBadge status={effectiveStatus(t)} />
        </Link>
      ))}
      {tasks.length === 0 && (
        <p className="py-6 text-center text-sm text-navy-400 dark:text-slate-500">Không có công việc · {formatDate(day, { weekday: true })}</p>
      )}
    </div>
  )
}
