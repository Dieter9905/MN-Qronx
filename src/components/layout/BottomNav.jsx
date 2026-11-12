import { useLayoutEffect, useRef, useState } from 'react'
import { NavLink, Link, useLocation } from 'react-router-dom'
import { Plus } from '@phosphor-icons/react'
import { BOTTOM_NAV } from './NavItems'
import { useLanguage } from '../../context/LanguageContext'
import { app } from '../../i18n/app'

function isMatch(pathname, item) {
  if (item.end) return pathname === item.to
  return pathname === item.to || pathname.startsWith(`${item.to}/`)
}

export default function BottomNav() {
  const { lang } = useLanguage()
  const t = app[lang]
  const location = useLocation()
  const gridRef = useRef(null)
  const [pill, setPill] = useState(null)

  // Đo mục đang mở → vệt sáng trượt mượt sang mục mới
  useLayoutEffect(() => {
    const grid = gridRef.current
    if (!grid) return undefined

    const measure = () => {
      const active = grid.querySelector('[data-nav-active="true"]')
      if (!active) {
        setPill(null)
        return
      }
      const gridRect = grid.getBoundingClientRect()
      const rect = active.getBoundingClientRect()
      // Phép đo khi bề mặt bị sập (capture/chuyển tab, mọi rect về 0) → bỏ qua,
      // tránh vẽ vệt sáng về góc (0,0) trong một nốt reflow.
      if (!rect.width || !rect.height || !gridRect.width) return
      setPill({
        left: rect.left - gridRect.left,
        top: rect.top - gridRect.top + 6,
        width: rect.width,
        height: rect.height - 12,
      })
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(grid)
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [location.pathname, lang])

  return (
    <nav
      aria-label="Điều hướng dưới cùng"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-room-acorn/15 bg-room-paper pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <div ref={gridRef} className="relative grid h-16 grid-cols-5 items-center px-2">
        {/* Vệt sáng trượt theo mục đang mở */}
        {pill && (
          <span
            aria-hidden="true"
            className="nav-pill pointer-events-none absolute rounded-xl bg-room-oat ring-1 ring-room-acorn/20"
            style={{ left: pill.left, top: pill.top, width: pill.width, height: pill.height }}
          >
            <span className="nav-pill-beam absolute -top-1.5 left-1/2 h-1 w-8 -translate-x-1/2 rounded-full" />
          </span>
        )}

        {BOTTOM_NAV.slice(0, 2).map((item) => (
          <BottomNavItem key={item.to} {...item} label={t[item.labelKey]} active={isMatch(location.pathname, item)} />
        ))}

        <div className="relative flex justify-center">
          <Link
            to="/app/tasks/new"
            aria-label="Tạo công việc mới"
            className="group absolute -top-6 flex h-14 w-14 items-center justify-center rounded-full bg-room-acorn text-room-paper shadow-[0_14px_26px_-12px_rgb(0_0_0/0.30)] ring-4 ring-room-paper transition-all duration-200 hover:-translate-y-0.5 hover:brightness-[0.96] active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-room-acorn"
          >
            <Plus size={26} weight="bold" />
          </Link>
        </div>

        {BOTTOM_NAV.slice(2).map((item) => (
          <BottomNavItem key={item.to} {...item} label={t[item.labelKey]} active={isMatch(location.pathname, item)} />
        ))}
      </div>
    </nav>
  )
}

function BottomNavItem({ to, label, icon: Icon, end, active }) {
  return (
    <NavLink
      to={to}
      end={end}
      data-nav-active={active}
      className={({ isActive }) =>
        [
          'group relative z-10 flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-[10px] font-bold transition-colors duration-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-room-acorn',
          isActive
            ? 'text-room-acorn'
            : 'text-room-ink/60 hover:text-room-ink',
        ].join(' ')
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            size={22}
            weight={isActive ? 'bold' : 'regular'}
            className="transition-transform duration-300 group-hover:scale-105"
          />
          {label}
        </>
      )}
    </NavLink>
  )
}
