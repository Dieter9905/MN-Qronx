import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { X, Plus, CalendarBlank, Kanban } from '@phosphor-icons/react'
import { useWorkspace } from '../context/WorkspaceContext'

// ─── Chú bot nhỏ đi lang thang ─────────────────────────────────────────
//
// Một nhân vật nhỏ nổi ở góc trái, tự bơi lơ lửng và thỉnh thoảng nhích qua
// nhích lại — mục đích là làm giao diện có "sự sống" thay vì một khung phẳng.
// Bấm vào bot thì nó nói một câu gợi ý đúng với trang đang mở (bảng nhóm, lịch,
// dashboard…) kèm 1–2 nút đi thẳng tới việc hay làm.
//
// Vì sao đặt ở góc TRÁI: góc phải dưới đã có cụm nút nổi (phím tắt / tạo nhanh /
// tập trung) — đặt bot vào đó sẽ chồng lên, và người dùng sẽ bấm nhầm.
// Có nút tắt và nhớ lựa chọn trong localStorage: nhân vật vui mắt, nhưng không
// được phép thành thứ không thể gỡ.

const HIDDEN_KEY = 'mnq:mascotHidden'

function tipsFor(pathname, isTeam) {
  if (pathname.startsWith('/app/board')) {
    return {
      text: 'Kéo thẻ sang cột khác là đổi trạng thái, hoặc chọn người phụ trách ngay trên thẻ nhé!',
      actions: [
        { to: '/app/tasks/new', label: 'Thêm việc', icon: Plus },
        { to: '/app/team', label: 'Thành viên', icon: Kanban },
      ],
    }
  }
  if (pathname.startsWith('/app/calendar')) {
    return {
      text: 'Lịch gộp cả 4 nguồn: việc cá nhân, lịch học, việc nhóm và lịch ngoài (Google/Outlook).',
      actions: [{ to: '/app/calendar', label: 'Mở lịch', icon: CalendarBlank }],
    }
  }
  if (pathname.startsWith('/app/tasks')) {
    return {
      text: 'Bấm Ctrl+K để thêm việc ngay tại chỗ — không phải rời trang đang làm.',
      actions: [{ to: '/app/tasks/new', label: 'Việc mới', icon: Plus }],
    }
  }
  if (isTeam) {
    return {
      text: 'Nhóm của bạn có bảng công việc riêng: ai làm gì, đang ở cột nào — nhìn một lần là thấy.',
      actions: [{ to: '/app/board', label: 'Bảng nhóm', icon: Kanban }],
    }
  }
  return {
    text: 'Chào bạn! Bấm vào mình khi cần gợi ý — mình đứng đây suốt, không chắn nút nào đâu.',
    actions: [{ to: '/app/tasks/new', label: 'Thêm việc', icon: Plus }],
  }
}

export default function MascotBot() {
  const { pathname } = useLocation()
  const { active } = useWorkspace()
  const isTeam = active?.workspace?.type === 'TEAM'
  const [hidden, setHidden] = useState(true)
  const [open, setOpen] = useState(false)

  // Chỉ đọc localStorage sau khi mount: đọc ngay lúc render sẽ lệch với HTML
  // máy chủ/khung đầu tiên và làm bot nhấp nháy một nhịp.
  useEffect(() => {
    setHidden(localStorage.getItem(HIDDEN_KEY) === '1')
  }, [])

  // Đổi trang thì thu câu nói lại, tránh bong bóng cũ treo giữa màn hình mới.
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  if (hidden) return null

  const tip = tipsFor(pathname, isTeam)

  const hide = () => {
    localStorage.setItem(HIDDEN_KEY, '1')
    setHidden(true)
  }

  return (
    // lg:left-[17.5rem] = bề rộng sidebar (16rem) + lề 1.5rem — nếu không bot sẽ
    // đứng đè lên thẻ khuyến mãi cuối sidebar, vừa xấu vừa che chữ.
    <div className="fixed bottom-24 left-4 z-40 sm:bottom-6 sm:left-6 lg:left-[17.5rem]">
      {open && (
        <div
          role="dialog"
          aria-label="Gợi ý từ trợ lý nhỏ"
          className="bot-bubble mb-2 w-60 rounded-2xl bg-white/95 p-3 shadow-xl ring-1 ring-navy-100 backdrop-blur dark:bg-slate-800/95 dark:ring-slate-700"
        >
          <div className="flex items-start gap-2">
            <p className="flex-1 text-xs font-semibold leading-relaxed text-navy-700 dark:text-slate-200">
              {tip.text}
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Đóng gợi ý"
              className="cursor-pointer rounded-md p-0.5 text-navy-400 transition hover:bg-navy-100 hover:text-navy-700 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-white"
            >
              <X size={12} weight="bold" />
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {tip.actions.map((a) => (
              <Link
                key={a.to + a.label}
                to={a.to}
                className="inline-flex items-center gap-1 rounded-lg bg-brand-gradient px-2 py-1 text-[11px] font-bold text-white shadow-sm transition hover:brightness-110"
              >
                <a.icon size={12} weight="bold" />
                {a.label}
              </Link>
            ))}
            <button
              type="button"
              onClick={hide}
              className="cursor-pointer rounded-lg px-2 py-1 text-[11px] font-semibold text-navy-400 transition hover:text-rose-500 dark:text-slate-500"
            >
              Ẩn bot
            </button>
          </div>
        </div>
      )}

      <div className="flex items-end gap-1">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? 'Thu gợi ý của trợ lý nhỏ' : 'Mở gợi ý của trợ lý nhỏ'}
          className="bot-wander group relative flex h-16 w-16 cursor-pointer items-center justify-center rounded-full bg-white/70 shadow-lg ring-1 ring-white/60 backdrop-blur transition hover:scale-105 dark:bg-slate-800/70 dark:ring-slate-700"
        >
          <svg viewBox="0 0 64 64" className="h-14 w-14" aria-hidden="true">
            <defs>
              <linearGradient id="botBody" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#60a5fa" />
                <stop offset="55%" stopColor="#6366f1" />
                <stop offset="100%" stopColor="#a855f7" />
              </linearGradient>
              <linearGradient id="botVisor" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0f172a" />
                <stop offset="100%" stopColor="#1e293b" />
              </linearGradient>
            </defs>
            {/* Quầng sáng dưới chân */}
            <ellipse cx="32" cy="58" rx="13" ry="3" fill="#6366f1" opacity="0.22" />
            {/* Ăng ten */}
            <line x1="32" y1="12" x2="32" y2="7" stroke="#a5b4fc" strokeWidth="2" strokeLinecap="round" />
            <circle cx="32" cy="6" r="2.6" fill="#22d3ee" className="bot-antenna" />
            {/* Thân */}
            <rect x="14" y="14" width="36" height="32" rx="12" fill="url(#botBody)" />
            {/* Kính / mắt */}
            <rect x="20" y="21" width="24" height="15" rx="7" fill="url(#botVisor)" />
            <circle cx="27" cy="28.5" r="2.6" fill="#67e8f9" className="bot-eye" />
            <circle cx="37" cy="28.5" r="2.6" fill="#67e8f9" className="bot-eye" />
            {/* Nụ cười */}
            <path d="M28 34.5c1.6 1.4 6.4 1.4 8 0" stroke="#a5f3fc" strokeWidth="1.6" strokeLinecap="round" fill="none" />
            {/* Tim đèn ngực */}
            <circle cx="32" cy="41.5" r="2" fill="#fef08a" opacity="0.9" />
            {/* Tai / cánh tay */}
            <rect x="8" y="25" width="4.5" height="10" rx="2.2" fill="#818cf8" />
            <rect x="51.5" y="25" width="4.5" height="10" rx="2.2" fill="#818cf8" className="bot-wave" />
            {/* Bánh xe nhỏ */}
            <circle cx="24" cy="48.5" r="3.4" fill="#c7d2fe" />
            <circle cx="40" cy="48.5" r="3.4" fill="#c7d2fe" />
          </svg>
          <span className="sr-only">Trợ lý nhỏ</span>
        </button>

        {/* Nút tắt gọn — chỉ hiện khi rê chuột để không làm rối góc màn hình */}
        <button
          type="button"
          onClick={hide}
          aria-label="Ẩn trợ lý nhỏ"
          className="mb-12 cursor-pointer rounded-full bg-white/80 p-1 text-navy-400 opacity-0 shadow ring-1 ring-navy-100 transition group-hover:opacity-100 hover:text-rose-500 focus-visible:opacity-100 dark:bg-slate-800/80 dark:text-slate-500 dark:ring-slate-700"
        >
          <X size={10} weight="bold" />
        </button>
      </div>
    </div>
  )
}
