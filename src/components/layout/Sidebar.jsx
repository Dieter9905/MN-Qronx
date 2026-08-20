import { NavLink } from 'react-router-dom'
import { Logo } from '../Logo'
import { NAV_GROUPS } from './NavItems'

export default function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-navy-100 bg-white dark:border-slate-700 dark:bg-slate-900 lg:flex">
      <div className="flex h-16 items-center border-b border-navy-100 dark:border-slate-700 px-5">
        <NavLink to="/app" className="cursor-pointer" aria-label="Về trang chủ MN-Qronx">
          <Logo size={34} />
        </NavLink>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Điều hướng chính">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-5">
            <p className="mb-1.5 px-3 text-[11px] font-bold uppercase tracking-wider text-navy-300 dark:text-slate-600">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}              className={({ isActive }) =>
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
                        {item.label}
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
      <div className="m-3 rounded-2xl bg-navy-900 p-4 text-white">
        <p className="text-sm font-bold">Plan. Do. On Time.</p>
        <p className="mt-1 text-xs leading-relaxed text-navy-200">
          “Lên kế hoạch – Bắt tay làm – Đúng thời điểm.”
        </p>
        <div className="mt-3 flex items-center gap-2 text-[11px] font-semibold text-cyan-300">
          <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-cyan-400" aria-hidden="true" />
          Báo thức luôn đúng giờ
        </div>
      </div>
    </aside>
  )
}
