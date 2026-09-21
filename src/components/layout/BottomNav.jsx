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
      className="fixed inset-x-0 bottom-0 z-40 border-t border-navy-100 bg-white pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-slate-700 dark:bg-slate-900 lg:hidden"
    >
      <div ref={gridRef} className="relative grid h-16 grid-cols-5 items-center px-2">
        {/* Vệt sáng trượt theo mục đang mở */}
        {pill && (
          <span
            aria-hidden="true"
            className="nav-pill pointer-events-none absolute rounded-xl bg-brand-gradient-soft dark:bg-white/5"
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
            className="group absolute -top-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-glow-purple transition-all duration-300 hover:-translate-y-1 hover:rotate-90 hover:shadow-xl active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <span className="absolute inset-0 -z-10 rounded-2xl bg-brand-gradient opacity-60 blur-md transition-opacity duration-300 group-hover:opacity-90" />
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
          'group relative z-10 flex flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-[10px] font-semibold transition-all duration-300',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
          isActive
            ? 'text-blue-600 dark:text-blue-400'
            : 'text-navy-400 hover:-translate-y-0.5 hover:text-navy-700 dark:text-slate-500 dark:hover:text-white',
        ].join(' ')
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            size={22}
            weight={isActive ? 'fill' : 'regular'}
            className={isActive ? 'nav-icon-active' : 'transition-transform duration-300 group-hover:scale-110'}
          />
          {label}
        </>
      )}
    </NavLink>
  )
}
