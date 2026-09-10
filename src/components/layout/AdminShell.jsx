import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { ChartBar, UsersThree, SignOut, House, ShieldCheck } from '@phosphor-icons/react'
import { LogoText } from '../Logo'
import { useAuth } from '../../context/AuthContext'

const ADMIN_NAV = [
  { to: '/admin', label: 'Dashboard hệ thống', icon: ChartBar, end: true },
  { to: '/admin/users', label: 'Quản lý người dùng', icon: UsersThree, end: false },
]

export default function AdminShell() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="flex min-h-dvh bg-navy-50/60">
      <aside className="sticky top-0 flex h-dvh w-64 shrink-0 flex-col bg-navy-900 text-white">
        <div className="flex h-16 items-center border-b border-white/10 px-5">
          <LogoText dark />
        </div>
        <nav className="flex-1 px-3 py-4" aria-label="Điều hướng quản trị">
          <p className="mb-1.5 flex items-center gap-1.5 px-3 text-[11px] font-bold uppercase tracking-wider text-navy-300">
            <ShieldCheck size={13} weight="fill" /> Khu vực quản trị
          </p>
          <ul className="space-y-1">
            {ADMIN_NAV.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    [
                      'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition',
                      isActive ? 'bg-white/10 text-white ring-1 ring-white/15' : 'text-navy-200 hover:bg-white/5 hover:text-white',
                    ].join(' ')
                  }
                >
                  <item.icon size={19} weight={item.end ? 'fill' : 'regular'} className={item.end ? 'text-cyan-300' : ''} />
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
          <div className="mt-8 border-t border-white/10 pt-4">
            <NavLink
              to="/app"
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-navy-200 transition hover:bg-white/5 hover:text-white"
            >
              <House size={19} /> Về ứng dụng
            </NavLink>
          </div>
        </nav>
        <div className="border-t border-white/10 p-4">
          <p className="truncate text-sm font-semibold">{user?.fullName}</p>
          <p className="truncate text-xs text-navy-300">{user?.email}</p>
          <button
            type="button"
            onClick={() => {
              logout()
              navigate('/')
            }}
            className="mt-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold transition hover:bg-white/20"
          >
            <SignOut size={16} weight="bold" /> Đăng xuất
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8">
        <Outlet />
      </main>
    </div>
  )
}
