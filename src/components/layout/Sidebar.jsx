import { useLayoutEffect, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Logo } from '../Logo'
import { NAV_GROUPS } from './NavItems'
import SupportBadge from './SupportBadge'
import { useLanguage } from '../../context/LanguageContext'
import { app } from '../../i18n/app'

/** Mục điều hướng đang mở không (dùng để đo vị trí thanh trượt) */
function matchNav(pathname, item) {
  if (item.end) return pathname === item.to
  return pathname === item.to || pathname.startsWith(`${item.to}/`)
}

export default function Sidebar() {
  const { lang } = useLanguage()
  const t = app[lang]
  const location = useLocation()
  const navRef = useRef(null)
  const [pill, setPill] = useState(null)

  // Đo vị trí mục đang mở → thanh chỉ mục trượt tới đó thay vì nhảy cứng
  useLayoutEffect(() => {
    const nav = navRef.current
    if (!nav) return undefined

    const measure = () => {
      const active = nav.querySelector('[data-nav-active="true"]')
      if (!active) {
        setPill(null)
        return
      }
      const navRect = nav.getBoundingClientRect()
      const rect = active.getBoundingClientRect()
      setPill({
        top: rect.top - navRect.top + nav.scrollTop,
        left: rect.left - navRect.left,
        width: rect.width,
        height: rect.height,
      })
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(nav)
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [location.pathname, lang])

  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-navy-100 bg-white dark:border-slate-700 dark:bg-slate-900 lg:flex">
      <div className="flex h-16 items-center border-b border-navy-100 dark:border-slate-700 px-5">
        <NavLink
          to="/app"
          className="cursor-pointer transition-transform duration-300 hover:scale-105"
          aria-label="Về trang chủ MN-Qronx"
        >
          <Logo size={34} />
        </NavLink>
      </div>

      {/* Khối ngoài giữ quầng sáng (không cuộn) – nav bên trong cuộn nội dung */}
      <div data-glow-track className="relative flex-1 overflow-hidden">
        <span className="aurora-track" aria-hidden="true" />
        <nav
          ref={navRef}
          className="relative h-full overflow-y-auto px-3 py-4"
          aria-label="Điều hướng chính"
        >
          {/* Thanh chỉ mục trượt giữa các mục */}
          {pill && (
            <span
              aria-hidden="true"
              className="nav-pill pointer-events-none absolute rounded-xl bg-brand-gradient-soft ring-1 ring-blue-100 dark:ring-blue-900/70"
              style={{ top: pill.top, left: pill.left, width: pill.width, height: pill.height }}
            >
              <span className="absolute inset-0 rounded-xl bg-brand-gradient opacity-[0.08]" />
              <span className="nav-pill-beam absolute -left-2.5 top-1/2 h-6 w-1.5 -translate-y-1/2 rounded-r-full" />
            </span>
          )}

          {NAV_GROUPS.map((group) => (
            <div key={group.labelKey} className="relative mb-5">
              <p className="mb-1.5 px-3 text-[11px] font-bold uppercase tracking-wider text-navy-500 dark:text-slate-500">
                {t[group.labelKey]}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active = matchNav(location.pathname, item)
                  return (
                    <li key={item.to} data-nav-active={active}>
                      <NavLink
                        to={item.to}
                        end={item.end}
                        className={({ isActive }) =>
                          [
                            'relative z-10 flex items-center gap-3 overflow-hidden rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-300',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
                            isActive
                              ? 'text-navy-900 dark:text-white'
                              : 'text-navy-500 hover:translate-x-0.5 hover:text-navy-900 dark:text-slate-400 dark:hover:text-white',
                          ].join(' ')
                        }
                      >
                        {({ isActive }) => (
                          <>
                            <item.icon
                              size={20}
                              weight={isActive ? 'fill' : 'regular'}
                              className={[
                                'icon-pop transition-colors',
                                isActive
                                  ? 'nav-icon-active text-blue-600 dark:text-blue-400'
                                  : 'text-navy-400 group-hover:text-navy-600 dark:text-slate-500 dark:group-hover:text-white',
                              ].join(' ')}
                            />
                            {t[item.labelKey]}
                            {item.labelKey === 'support' && <SupportBadge className="ml-auto" />}
                            {item.pro && !isActive && (
                              <span className="ml-auto rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 px-1.5 py-px text-[9px] font-extrabold uppercase tracking-wide text-white">
                                Pro
                              </span>
                            )}
                            {isActive && (
                              <span
                                className="ml-auto h-1.5 w-1.5 animate-pulse-soft rounded-full bg-brand-gradient shadow-glow-blue"
                                aria-hidden="true"
                              />
                            )}
                          </>
                        )}
                      </NavLink>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      <div className="group m-3 overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 p-4 text-white transition-all duration-500 hover:shadow-glow-purple dark:bg-slate-800">
        <p className="text-sm font-bold">Plan. Do. On Time.</p>
        <p className="mt-1 text-xs leading-relaxed text-indigo-100 dark:text-slate-300">
          “{t.sidebarTagline}”
        </p>
        <div className="mt-3 flex items-center gap-2 text-[11px] font-semibold text-cyan-300 dark:text-cyan-400">
          <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-cyan-400" aria-hidden="true" />
          {t.sidebarAlarm}
        </div>
      </div>
    </aside>
  )
}
