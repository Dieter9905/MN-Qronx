import { NavLink, Link } from 'react-router-dom'
import { Plus } from '@phosphor-icons/react'
import { BOTTOM_NAV } from './NavItems'
import { useLanguage } from '../../context/LanguageContext'
import { app } from '../../i18n/app'

export default function BottomNav() {
  const { lang } = useLanguage()
  const t = app[lang]

  return (
    <nav
      aria-label="Điều hướng dưới cùng"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-navy-100 bg-white pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-slate-700 dark:bg-slate-900 lg:hidden"
    >
      <div className="grid h-16 grid-cols-5 items-center px-2">
        {BOTTOM_NAV.slice(0, 2).map((item) => (
          <BottomNavItem key={item.to} {...item} label={t[item.labelKey]} />
        ))}
        <div className="relative flex justify-center">
          <Link
            to="/app/tasks/new"
            aria-label="Tạo công việc mới"
            className="absolute -top-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-glow-purple transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <Plus size={26} weight="bold" />
          </Link>
        </div>
        {BOTTOM_NAV.slice(2).map((item) => (
          <BottomNavItem key={item.to} {...item} label={t[item.labelKey]} />
        ))}
      </div>
    </nav>
  )
}

function BottomNavItem({ to, label, icon: Icon, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        [
          'flex flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-[10px] font-semibold transition',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
          isActive ? 'text-blue-600 dark:text-blue-400' : 'text-navy-400 hover:text-navy-700 dark:text-slate-500 dark:hover:text-white',
        ].join(' ')
      }
    >
      {({ isActive }) => (
        <>
          <Icon size={22} weight={isActive ? 'fill' : 'regular'} />
          {label}
        </>
      )}
    </NavLink>
  )
}