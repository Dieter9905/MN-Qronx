import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Plus,
  BellRinging,
  CaretDown,
  UserCircle,
  Key,
  Gear,
  SignOut,
  ShieldCheck,
  List,
} from '@phosphor-icons/react'
import Button from '../common/Button'
import Avatar from '../common/Avatar'
import { useAuth } from '../../context/AuthContext'
import { useAlarm } from '../../context/AlarmContext'
import { useToast } from '../common/Toast'
import { Logo } from '../Logo'
import { getTasks } from '../../services/taskService'

function DemoAlarmButton() {
  const { triggerDemo, demoLoading } = useAlarm()
  const toast = useToast()
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)
  const [tasks, setTasks] = useState([])

  useEffect(() => {
    const close = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const loadTasks = async () => {
    const res = await getTasks({ status: '', pageSize: 100 })
    if (res.success) setTasks(res.data.items.filter((t) => t.status === 'TODO' || t.status === 'IN_PROGRESS'))
  }

  const fire = async (taskId) => {
    setOpen(false)
    const res = await triggerDemo(taskId)
    if (!res.success) toast.error(res.message)
  }

  return (
    <div className="relative" ref={menuRef}>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Thử báo thức demo"
        title="Thử báo thức demo"
        loading={demoLoading}
        onClick={() => {
          loadTasks()
          setOpen((o) => !o)
        }}
      >
        {!demoLoading && <BellRinging size={19} weight="bold" className="text-brand-purple" />}
      </Button>
      {open && (
        <div className="absolute right-0 top-12 z-50 w-80 overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-navy-100 animate-scale-in">
          <div className="border-b border-navy-100 bg-brand-gradient-soft px-4 py-3">
            <p className="text-sm font-bold text-navy-900">Thử báo thức ⏰</p>
            <p className="mt-0.5 text-xs text-navy-500">
              Chọn một công việc để mô phỏng màn hình báo thức toàn màn hình (tính năng cốt lõi).
            </p>
          </div>
          <ul className="max-h-72 overflow-y-auto p-2">
            {tasks.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => fire(t.id)}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-navy-50"
                >
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold"
                    style={{
                      backgroundColor: t.category ? `${t.category.color}1a` : '#e2e8f0',
                      color: t.category ? t.category.color : '#64748b',
                    }}
                  >
                    {new Date(t.dueAt).getHours().toString().padStart(2, '0')}h
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-navy-800">{t.title}</span>
                    <span className="block text-xs text-navy-400">{user?.fullName}</span>
                  </span>
                </button>
              </li>
            ))}
            {tasks.length === 0 && (
              <li className="px-3 py-6 text-center text-sm text-navy-400">
                Không có công việc nào đang mở để thử báo thức.
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

export default function Header({ title, onOpenDrawer }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    const close = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const isAdmin = user?.role === 'ADMIN'

  const go = (path) => {
    setMenuOpen(false)
    navigate(path)
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-navy-100 bg-white/90 px-4 backdrop-blur sm:px-6">
      <button
        type="button"
        onClick={onOpenDrawer}
        aria-label="Mở menu điều hướng"
        className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-navy-600 transition hover:bg-navy-100 lg:hidden"
      >
        <List size={22} weight="bold" />
      </button>
      <div className="lg:hidden">
        <Logo size={30} />
      </div>
      <h1 className="hidden text-lg font-bold text-navy-900 lg:block">{title}</h1>
      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        <DemoAlarmButton />
        <Link to="/app/tasks/new" className="hidden sm:block">
          <Button variant="gradient" size="sm" icon={Plus}>
            Tạo công việc
          </Button>
        </Link>
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="flex cursor-pointer items-center gap-2 rounded-full p-1 pr-2 transition hover:bg-navy-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <Avatar name={user?.fullName} size="sm" />
            <span className="hidden text-left sm:block">
              <span className="block max-w-[140px] truncate text-sm font-semibold leading-tight text-navy-800">
                {user?.fullName}
              </span>
              <span className="block text-[11px] leading-tight text-navy-400">
                {isAdmin ? 'Quản trị viên' : 'Người dùng'}
              </span>
            </span>
            <CaretDown size={14} className="hidden text-navy-400 sm:block" weight="bold" />
          </button>
          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-12 w-56 overflow-hidden rounded-2xl bg-white py-1.5 shadow-2xl ring-1 ring-navy-100 animate-scale-in"
            >
              <div className="border-b border-navy-100 px-4 py-2.5">
                <p className="truncate text-sm font-bold text-navy-900">{user?.fullName}</p>
                <p className="truncate text-xs text-navy-400">{user?.email}</p>
              </div>
              <button role="menuitem" type="button" onClick={() => go('/app/profile')} className="menu-item">
                <UserCircle size={18} weight="bold" /> Hồ sơ cá nhân
              </button>
              <button role="menuitem" type="button" onClick={() => go('/app/change-password')} className="menu-item">
                <Key size={18} weight="bold" /> Đổi mật khẩu
              </button>
              <button role="menuitem" type="button" onClick={() => go('/app/settings')} className="menu-item">
                <Gear size={18} weight="bold" /> Cài đặt
              </button>
              {isAdmin && (
                <button role="menuitem" type="button" onClick={() => go('/admin')} className="menu-item">
                  <ShieldCheck size={18} weight="bold" /> Khu vực quản trị
                </button>
              )}
              <div className="my-1 border-t border-navy-100" />
              <button
                role="menuitem"
                type="button"
                onClick={() => {
                  logout()
                  navigate('/')
                }}
                className="menu-item text-rose-600 hover:bg-rose-50"
              >
                <SignOut size={18} weight="bold" /> Đăng xuất
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
