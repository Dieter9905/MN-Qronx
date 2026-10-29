import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  ChartBar,
  UsersThree,
  SignOut,
  House,
  ShieldCheck,
  Headset,
  Receipt,
  List,
  X,
} from '@phosphor-icons/react'
import SupportBadge from './SupportBadge'
import { LogoText } from '../Logo'
import { useAuth } from '../../context/AuthContext'
import Avatar from '../common/Avatar'

const ADMIN_NAV = [
  { to: '/admin', label: 'Dashboard hệ thống', icon: ChartBar, end: true },
  { to: '/admin/users', label: 'Quản lý người dùng', icon: UsersThree, end: false },
  { to: '/admin/orders', label: 'Đơn hàng & thanh toán', icon: Receipt, end: false },
  { to: '/admin/support', label: 'Hỗ trợ khách hàng', icon: Headset, end: false },
]

// ─── Khung quản trị ─────────────────────────────────────────────────────
// Desktop: cột điều hướng cố định bên trái như cũ.
// Điện thoại: KHÔNG giữ cột 256px (nó chiếm gần hết màn hình 390px) — thay bằng
// thanh trên gọn + ngăn kéo mở bằng nút menu. Đây là thứ khiến khu admin trước
// đây gần như không dùng được trên máy nhỏ: bảng 860px bị đẩy ra ngoài khung,
// và phần nội dung chỉ còn ~120px.
function AdminNav({ onNavigate }) {
  return (
    <>
      <p className="mb-1.5 flex items-center gap-1.5 px-3 text-[11px] font-bold uppercase tracking-wider text-navy-300">
        <ShieldCheck size={13} weight="fill" /> Khu vực quản trị
      </p>
      <ul className="space-y-1">
        {ADMIN_NAV.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.end}
              onClick={onNavigate}
              className={({ isActive }) =>
                [
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition',
                  isActive
                    ? 'bg-white/10 text-white ring-1 ring-white/15'
                    : 'text-navy-200 hover:bg-white/5 hover:text-white',
                ].join(' ')
              }
            >
              <item.icon size={19} weight={item.end ? 'fill' : 'regular'} className={item.end ? 'text-cyan-300' : ''} />
              <span className="truncate">{item.label}</span>
              {item.to === '/admin/support' && <SupportBadge admin className="ml-auto" />}
            </NavLink>
          </li>
        ))}
      </ul>
      <div className="mt-6 border-t border-white/10 pt-4">
        <NavLink
          to="/app"
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-navy-200 transition hover:bg-white/5 hover:text-white"
        >
          <House size={19} /> Về ứng dụng
        </NavLink>
      </div>
    </>
  )
}

function AdminAccount({ user, onLogout }) {
  return (
    <div className="border-t border-white/10 p-4">
      <p className="truncate text-sm font-semibold">{user?.fullName}</p>
      <p className="truncate text-xs text-navy-300">{user?.email}</p>
      <button
        type="button"
        onClick={onLogout}
        className="mt-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold transition hover:bg-white/20"
      >
        <SignOut size={16} weight="bold" /> Đăng xuất
      </button>
    </div>
  )
}

export default function AdminShell() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Đổi trang là đóng ngăn kéo — nếu không, chọn xong mục menu vẫn còn tấm che
  // phía trên nội dung mới và người dùng phải bấm X lần nữa.
  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname])

  // Ngăn kéo đang mở: khoá cuộn nền + Esc để đóng (quen thuộc trên điện thoại).
  useEffect(() => {
    if (!drawerOpen) return undefined
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => {
      if (e.key === 'Escape') setDrawerOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [drawerOpen])

  const onLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <div className="min-h-dvh bg-navy-50/60 dark:bg-slate-900">
      {/* Thanh trên cho điện thoại/tablet nhỏ */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 bg-navy-900 px-3 text-white shadow-lg lg:hidden">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Mở menu quản trị"
          aria-expanded={drawerOpen}
          className="-ml-1 flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-navy-100 transition hover:bg-white/10"
        >
          <List size={22} weight="bold" />
        </button>
        <LogoText dark />
        <span className="ml-1 hidden rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-cyan-300 sm:inline">
          Admin
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Avatar name={user?.fullName} src={user?.avatarUrl} size="sm" className="ring-2 ring-white/20" />
          <button
            type="button"
            onClick={onLogout}
            aria-label="Đăng xuất khỏi khu quản trị"
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl text-navy-200 transition hover:bg-white/10 hover:text-white"
          >
            <SignOut size={17} weight="bold" />
          </button>
        </div>
      </header>

      <div className="flex">
        {/* Cột điều hướng: chỉ từ lg trở lên */}
        <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col bg-navy-900 text-white lg:flex">
          <div className="flex h-16 items-center border-b border-white/10 px-5">
            <LogoText dark />
          </div>
          <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Điều hướng quản trị">
            <AdminNav />
          </nav>
          <AdminAccount user={user} onLogout={onLogout} />
        </aside>

        <main className="min-w-0 flex-1 px-4 pb-12 pt-5 sm:px-6 lg:px-8 lg:py-6">
          <Outlet />
        </main>
      </div>

      {/* Ngăn kéo trên điện thoại */}
      <div
        className={`fixed inset-0 z-50 lg:hidden ${drawerOpen ? '' : 'pointer-events-none'}`}
        aria-hidden={!drawerOpen}
      >
        <div
          className={`absolute inset-0 bg-navy-900/60 backdrop-blur-sm transition-opacity duration-200 ${
            drawerOpen ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={() => setDrawerOpen(false)}
        />
        <div
          className={`absolute inset-y-0 left-0 flex w-[17.5rem] max-w-[85vw] flex-col bg-navy-900 text-white shadow-2xl transition-transform duration-300 ${
            drawerOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
          role="dialog"
          aria-modal="true"
          aria-label="Menu quản trị"
        >
          <div className="flex h-14 items-center justify-between border-b border-white/10 px-4">
            <LogoText dark />
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label="Đóng menu quản trị"
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-navy-200 transition hover:bg-white/10 hover:text-white"
            >
              <X size={18} weight="bold" />
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Điều hướng quản trị (điện thoại)">
            <AdminNav onNavigate={() => setDrawerOpen(false)} />
          </nav>
          <AdminAccount user={user} onLogout={onLogout} />
        </div>
      </div>
    </div>
  )
}
