import { useLayoutEffect, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import WorldLogo from '../WorldLogo'
import { NAV_GROUPS, filterNavByWorkspace } from './NavItems'
import { useWorkspace } from '../../context/WorkspaceContext'
import SupportBadge from './SupportBadge'
import WorkspaceSwitcher from './WorkspaceSwitcher'
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
  // Mỗi chế độ một bộ menu: Việc được giao / Cả nhóm / Nhóm làm việc chỉ có
  // trong không gian TEAM, nên menu phải lọc lại mỗi lần đổi chế độ.
  const { active } = useWorkspace()
  const navGroups = filterNavByWorkspace(NAV_GROUPS, active?.workspace?.type || 'PERSONAL')
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
      // Chrome lúc capture/chuyển tab đôi khi sập bề mặt (mọi rect về 0) —
      // đừng commit phép đo rỗng kẻo thanh chỉ mục bị vẽ Foundations về (0,0).
      if (!rect.width || !rect.height || !navRect.width) return
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
    // WorkspaceSwitcher nạp không gian không đồng bộ → nav cao lên nhưng
    // chính nó không đổi kích thước (h-full), ResizeObserver không bắn:
    // theo dõi luôn con-cháu để thanh chỉ mục không kẹt ở vị trí cũ.
    const mut = new MutationObserver(() => requestAnimationFrame(measure))
    mut.observe(nav, { childList: true, subtree: true })
    // Font Baloo 2 load xong thì hàng đổi cao → đo lại thêm một nhịp
    if (document.fonts?.ready) {
      document.fonts.ready.then(measure).catch(() => {})
    }
    return () => {
      observer.disconnect()
      mut.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [location.pathname, lang])

  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-room-acorn/15 bg-room-paper lg:flex">
      <div className="flex h-16 items-center border-b border-room-acorn/15 px-5">
        <NavLink
          to="/app"
          className="cursor-pointer transition-transform duration-300 hover:scale-105"
          aria-label="Về trang chủ MN-Qronx"
        >
          <WorldLogo size={34} />
        </NavLink>
      </div>

      {/* Menu cuộn trong khối riêng — không trượt khung ngoài */}
      <div className="relative flex-1 overflow-hidden">
        <nav
          ref={navRef}
          className="relative z-10 h-full overflow-y-auto px-3 py-4"
          aria-label="Điều hướng chính"
        >
          {/* Chọn chế độ làm việc: Cá nhân / Lớp học / Nhóm */}
          <WorkspaceSwitcher />

          {/* Thanh chỉ mục trượt giữa các mục */}
          {pill && (
            <span
              aria-hidden="true"
              className="nav-pill pointer-events-none absolute rounded-full bg-room-oat ring-1 ring-room-acorn/20"
              style={{ top: pill.top, left: pill.left, width: pill.width, height: pill.height }}
            >
              <span className="nav-pill-beam absolute -left-2 top-1/2 h-6 w-[5px] -translate-y-1/2 rounded-full" />
            </span>
          )}

          {navGroups.map((group) => (
            <div key={group.labelKey} className="relative mb-5">
              <p className="mb-1.5 px-3 text-xs font-bold text-room-ink/60">
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
                            'relative z-10 flex min-h-11 items-center gap-3 overflow-hidden rounded-full px-3.5 py-2.5 text-sm font-bold transition-colors duration-200',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-room-acorn',
                            isActive
                              ? 'text-room-ink'
                              : 'text-room-ink/65 hover:bg-room-oat/60 hover:text-room-ink',
                          ].join(' ')
                        }
                      >
                        {({ isActive }) => (
                          <>
                            <item.icon
                              size={19}
                              weight={isActive ? 'bold' : 'regular'}
                              className={
                                isActive ? 'text-room-acorn' : 'text-room-ink/65'
                              }
                            />
                            {t[item.labelKey]}
                            {item.labelKey === 'support' && <SupportBadge tone="room" className="ml-auto" />}
                            {item.pro && !isActive && (
                              <span className="ml-auto rounded-full bg-room-paper px-2 py-px text-[10px] font-bold text-room-acorn ring-1 ring-room-acorn/30">
                                Pro
                              </span>
                            )}
                            {isActive && (
                              <span
                                className="ml-auto h-1.5 w-1.5 rounded-full bg-room-acorn"
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

      {/* Khẩu hiệu của phòng dán chân tủ — note Moss mỏng, không thẻ gradient */}
      <div className="mx-3 mb-3 rounded-2xl bg-room-moss/60 px-4 py-3.5 ring-1 ring-room-acorn/20">
        <p className="font-display text-sm font-bold text-room-ink">Plan. Do. On Time.</p>
        <p className="mt-1 text-xs leading-relaxed text-room-ink/70">
          “{t.sidebarTagline}”
        </p>
        <div className="mt-2.5 flex items-center gap-2 text-[11px] font-bold text-room-ink/60">
          <span className="h-1.5 w-1.5 rounded-full bg-room-bell" aria-hidden="true" />
          {t.sidebarAlarm}
        </div>
      </div>
    </aside>
  )
}
