import { NavLink } from 'react-router-dom'
import { Logo } from '../Logo'
import { NAV_GROUPS } from './NavItems'
import { useLanguage } from '../../context/LanguageContext'
import { app } from '../../i18n/app'

export default function Sidebar() {
  const { lang } = useLanguage()
  const t = app[lang]

  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-navy-100 bg-white dark:border-slate-700 dark:bg-slate-900 lg:flex">
      <div className="flex h-16 items-center border-b border-navy-100 dark:border-slate-700 px-5">
        <NavLink to="/app" className="cursor-pointer" aria-label="Về trang chủ MN-Qronx">
          <Logo size={34} />
        </NavLink>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Điều hướng chính">
        {NAV_GROUPS.map((group) => (
          <div key={group.labelKey} className="mb-5">
            <p className="mb-1.5 px-3 text-[11px] font-bold uppercase tracking-wider text-navy-500 dark:text-slate-500">
              {t[group.labelKey]}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      [
                        'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-150',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
                        isActive
                          ? 'bg-brand-gradient-soft text-navy-900 ring-1 ring-blue-100 dark:text-white dark:ring-blue-900'
                          : 'text-navy-500 hover:bg-navy-50 hover:text-navy-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white',
                      ].join(' ')
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <item.icon
                          size={20}
                          weight={isActive ? 'fill' : 'regular'}
                          className={isActive ? 'text-blue-600 dark:text-blue-400' : 'text-navy-400 group-hover:text-navy-600 dark:group-hover:text-white'}
                        />
                        {t[item.labelKey]}
                        {item.pro && !isActive && (
                          <span className="ml-auto rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 px-1.5 py-px text-[9px] font-extrabold uppercase tracking-wide text-white">
                            Pro
                          </span>
                        )}
                        {isActive && (
                          <span className="ml-auto h-1.5 w-1.5 rounded-full bg-brand-gradient" aria-hidden="true" />
                        )}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="m-3 rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 p-4 text-white dark:bg-slate-800">
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