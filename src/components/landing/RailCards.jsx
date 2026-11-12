import {
  CalendarBlank,
  BellRinging,
  CheckCircle,
  Clock,
  ListChecks,
} from '@phosphor-icons/react'

/**
 * RAIL 3 THẺ — cột phải khung đầu của phòng mini-hompy:
 *  Hôm nay (ngày THẬT) · Chuông đổ đúng hạn (mẫu) · Nhật ký đúng hạn (mẫu).
 * Mọi số liệu mẫu đều dán nhãn "(mẫu)" — minh bạch là luật của thế giới này.
 */

function Chip({ children }) {
  return (
    <span className="on-blush rounded-full bg-room-blush px-2 py-0.5 text-[11px] font-black leading-[1.35] tracking-[0.1em]">
      {children}
    </span>
  )
}

function CardHead({ icon: Icon, title }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-room-moss text-room-ink ring-1 ring-room-acorn/25">
        <Icon size={15} weight="bold" />
      </span>
      <h2 className="font-display text-[15px] font-bold text-room-ink">{title}</h2>
    </div>
  )
}

export default function RailCards({ t, lang }) {
  const locale = lang === 'vi' ? 'vi-VN' : 'en-US'
  const today = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date())

  const ledger = [
    { name: t.alarmTask, done: true },
    { name: t.heroTask2, done: true },
    { name: t.heroTask3, done: false, time: '18:00' },
  ]

  return (
    <aside aria-label={t.r1Title} className="flex flex-col gap-3">
      {/* Hôm nay — ngày thật của hôm nay */}
      <div className="relative rounded-2xl bg-room-paper/80 p-4 ring-1 ring-room-acorn/25">
        <span aria-hidden="true" className="absolute -top-2 left-7 h-3 w-14 -rotate-3 rounded-[3px] bg-room-oat/90 ring-1 ring-room-acorn/25" />
        <CardHead icon={CalendarBlank} title={t.r1Title} />
        <p className="mt-2.5 font-display text-lg font-bold capitalize leading-tight text-room-ink">{today}</p>
        <div className="mt-2.5 flex items-center gap-2 border-t border-room-acorn/15 pt-2.5">
          <Chip>{t.roomChip}</Chip>
          <span className="text-xs font-semibold text-room-ink/70">
            2 {t.heroDone} <span className="text-room-acorn/60">·</span> 1 {t.heroRemaining}
          </span>
        </div>
      </div>

      {/* Chuông đổ đúng hạn — bộ đếm mẫu */}
      <div className="relative rounded-2xl bg-room-paper/80 p-4 ring-1 ring-room-acorn/25">
        <span aria-hidden="true" className="absolute -top-2 right-7 h-3 w-14 rotate-2 rounded-[3px] bg-room-moss/90 ring-1 ring-room-acorn/25" />
        <CardHead icon={BellRinging} title={t.r2Title} />
        <div className="mt-2 flex items-end gap-2">
          <span className="font-display text-3xl font-bold leading-none text-room-ink">1.284</span>
          <Chip>{t.roomChip}</Chip>
        </div>
        <p className="mt-1.5 text-xs font-semibold text-room-ink/65">{t.r2Count}</p>
      </div>

      {/* Nhật ký đúng hạn — sổ tay mẫu */}
      <div className="relative rounded-2xl bg-room-paper/80 p-4 ring-1 ring-room-acorn/25">
        <span aria-hidden="true" className="absolute -top-2 left-8 h-3 w-14 -rotate-2 rounded-[3px] bg-room-oat/90 ring-1 ring-room-acorn/25" />
        <div className="flex items-center justify-between">
          <CardHead icon={ListChecks} title={t.r3Title} />
          <Chip>{t.roomChip}</Chip>
        </div>
        <ul className="mt-3 space-y-2.5">
          {ledger.map((row) => (
            <li key={row.name} className="flex items-center gap-2">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${row.done ? 'bg-room-sage' : 'bg-room-rain'}`}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 truncate text-xs font-semibold text-room-ink/80">
                {row.name}
              </span>
              {row.done ? (
                <span className="flex items-center gap-1 text-[11px] font-bold text-room-ink/65">
                  <CheckCircle size={12} weight="bold" className="text-room-sage" /> {t.r3Status}
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[11px] font-bold text-room-ink/65">
                  <Clock size={12} weight="bold" className="text-room-rain" /> {t.r3Next} {row.time}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  )
}
