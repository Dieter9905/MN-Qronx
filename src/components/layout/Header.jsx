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
  Crown,
  List,
  Moon,
  Sun,
  Translate,
} from '@phosphor-icons/react'
import Button from '../common/Button'
import Avatar from '../common/Avatar'
import { RoomButton } from '../common/RoomUI'
import { useAuth } from '../../context/AuthContext'
import { useAlarm } from '../../context/AlarmContext'
import { useTheme } from '../../context/ThemeContext'
import { useLanguage } from '../../context/LanguageContext'
import { useToast } from '../common/Toast'
import WorldLogo from '../WorldLogo'
import { getTasks } from '../../services/taskService'
import { app } from '../../i18n/app'
import { PLAN_NAMES } from '../../lib/constants'

// Da gói trong shell phòng — đè màu ở nơi dùng; PLAN_BADGE gốc trong constants
// không đụng (Admin shell + trang khác vẫn dùng bản cũ).
const PLAN_BADGE_ROOM = {
  FREE: 'bg-room-oat/70 text-room-ink/80 ring-room-acorn/25',
  PLUS: 'bg-room-oat text-room-ink ring-room-bell/60',
  PRO: 'bg-room-acorn text-room-paper ring-room-acorn',
  BUSINESS: 'bg-room-acorn text-room-paper ring-room-bell',
}

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
        {!demoLoading && <BellRinging size={19} weight="bold" className="text-room-acorn" />}
      </Button>
      {open && (
        <div className="absolute right-0 top-12 z-50 w-80 origin-top-right overflow-hidden rounded-2xl bg-room-paper shadow-[0_24px_44px_-24px_rgb(0_0_0/0.35)] ring-1 ring-room-acorn/25 animate-scale-in">
          <div className="border-b border-room-acorn/15 px-4 py-3">
            <p className="font-display text-sm font-bold text-room-ink">Thử báo thức</p>
            <p className="mt-0.5 text-xs text-room-ink/65">
              Chọn một công việc để mô phỏng màn hình báo thức toàn màn hình (tính năng cốt lõi).
            </p>
          </div>
          <ul className="max-h-72 overflow-y-auto p-2">
            {tasks.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => fire(t.id)}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-room-oat/60"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-room-oat/70 text-[10px] font-bold text-room-ink ring-1 ring-room-acorn/15">
                    {new Date(t.dueAt).getHours().toString().padStart(2, '0')}h
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-room-ink">{t.title}</span>
                    <span className="block text-xs text-room-ink/50">{user?.fullName}</span>
                  </span>
                </button>
              </li>
            ))}
            {tasks.length === 0 && (
              <li className="px-3 py-6 text-center text-sm text-room-ink/50">
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
  const { theme, toggleTheme } = useTheme()
  const { lang, toggleLang } = useLanguage()
  const t = app[lang]
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
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-room-acorn/15 bg-room-paper px-4 sm:px-6">
      <button
        type="button"
        onClick={onOpenDrawer}
        aria-label="Mở menu điều hướng"
        className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-room-ink/70 transition-all duration-300 hover:bg-room-oat/60 hover:text-room-ink active:scale-95 lg:hidden"
      >
        <List size={22} weight="bold" className="icon-pop" />
      </button>
      <div className="lg:hidden">
        <WorldLogo size={30} />
      </div>
      <h1 className="hidden font-display text-lg font-bold text-room-ink lg:block">{title}</h1>
      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        {/* Công tắc sáng/tối: núm trượt + mặt trời/mặt trăng xoay, đổi màu lan toả từ vị trí bấm */}
        <button
          type="button"
          onClick={(event) => toggleTheme(event)}
          role="switch"
          aria-checked={theme === 'dark'}
          aria-label={theme === 'light' ? 'Bật chế độ tối' : 'Bật chế độ sáng'}
          title={theme === 'light' ? 'Chế độ tối' : 'Chế độ sáng'}
          className="group relative flex h-9 w-[62px] shrink-0 cursor-pointer items-center rounded-full bg-room-oat/70 p-1 ring-1 ring-inset ring-room-acorn/25 transition-all duration-300 hover:ring-room-acorn/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-room-acorn active:scale-95"
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-full opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            style={{ boxShadow: '0 0 0 4px rgb(var(--room-acorn)/0.14)' }}
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-[9px] text-room-bell transition-all duration-500 group-hover:rotate-90 dark:opacity-40"
          >
            <Sun size={13} weight="fill" />
          </span>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-[9px] text-room-sky transition-all duration-500 group-hover:-rotate-12 dark:text-room-sky"
          >
            <Moon size={13} weight="fill" />
          </span>
          <span
            aria-hidden="true"
            className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-full bg-room-paper text-room-ink shadow-[0_2px_8px_rgb(0_0_0/0.10)] ring-1 ring-room-acorn/25 transition-all duration-500 group-hover:scale-110 group-active:scale-90 ${
              theme === 'dark' ? 'translate-x-[26px]' : 'translate-x-0'
            }`}
            style={{ transitionTimingFunction: 'cubic-bezier(0.16,1,0.3,1)' }}
          >
            <span className="relative h-4 w-4">
              <Sun
                size={16}
                weight="fill"
                className={`absolute inset-0 m-auto transition-all duration-500 ${
                  theme === 'dark' ? 'rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100'
                }`}
              />
              <Moon
                size={16}
                weight="fill"
                className={`absolute inset-0 m-auto transition-all duration-500 ${
                  theme === 'dark' ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-0 opacity-0'
                }`}
              />
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={toggleLang}
          className="group flex h-9 items-center gap-1 rounded-full bg-room-oat/70 px-2.5 text-[11px] font-bold text-room-ink/80 ring-1 ring-room-acorn/20 transition-all duration-300 hover:bg-room-oat hover:text-room-ink active:scale-95"
          aria-label="Đổi ngôn ngữ"
          title="Đổi ngôn ngữ"
        >
          <Translate size={14} weight="bold" className="icon-pop" />
          {lang.toUpperCase()}
        </button>
        <DemoAlarmButton />
        <Link to="/app/tasks/new" className="hidden sm:block">
          <RoomButton size="sm" icon={Plus}>
            {t.createTask}
          </RoomButton>
        </Link>
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="group flex cursor-pointer items-center gap-2 rounded-full p-1 pr-2 transition-all duration-300 hover:bg-room-oat/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-room-acorn"
          >
            <span className="transition-transform duration-300 group-hover:scale-105 group-active:scale-95">
              <Avatar name={user?.fullName} src={user?.avatarUrl} size="sm" />
            </span>{' '}
            <span className="hidden text-left sm:block">
              <span className="block max-w-[140px] truncate text-sm font-bold leading-tight text-room-ink">
                {user?.fullName}
              </span>
              <span className="flex items-center gap-1.5 text-[11px] leading-tight text-room-ink/45">
                <span className={`inline-flex items-center rounded-full px-1.5 py-px text-[10px] font-extrabold ring-1 ring-inset ${PLAN_BADGE_ROOM[user?.plan || 'FREE']}`}>
                  {PLAN_NAMES[user?.plan || 'FREE']}
                </span>
                <span>{isAdmin ? t.roleAdmin : t.roleUser}</span>
              </span>
            </span>
            <CaretDown
              size={14}
              weight="bold"
              className={`hidden text-room-ink/45 transition-transform duration-300 sm:block ${menuOpen ? 'rotate-180' : ''}`}
            />
          </button>
          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-12 w-56 origin-top-right overflow-hidden rounded-2xl bg-room-paper py-1.5 shadow-[0_24px_44px_-24px_rgb(0_0_0/0.35)] ring-1 ring-room-acorn/25 animate-scale-in"
            >
              <div className="border-b border-room-acorn/15 px-4 py-2.5">
                <p className="truncate text-sm font-bold text-room-ink">{user?.fullName}</p>
                <p className="truncate text-xs text-room-ink/50">{user?.email}</p>
              </div>
              <button role="menuitem" type="button" onClick={() => go('/app/profile')} className="menu-item">
                <UserCircle size={18} weight="bold" /> {t.profile}
              </button>
              <button role="menuitem" type="button" onClick={() => go('/app/change-password')} className="menu-item">
                <Key size={18} weight="bold" /> {t.changePassword}
              </button>
              <button role="menuitem" type="button" onClick={() => go('/app/settings')} className="menu-item">
                <Gear size={18} weight="bold" /> {t.settings}
              </button>
              <button role="menuitem" type="button" onClick={() => go('/app/billing')} className="menu-item">
                <Crown size={18} weight="bold" /> Gói của bạn
              </button>
              {isAdmin && (
                <button role="menuitem" type="button" onClick={() => go('/admin')} className="menu-item">
                  <ShieldCheck size={18} weight="bold" /> {t.adminArea}
                </button>
              )}
              <div className="my-1 border-t border-room-acorn/15" />
              <button
                role="menuitem"
                type="button"
                onClick={() => {
                  logout()
                  navigate('/')
                }}
                className="menu-item text-room-ink hover:bg-room-rain/40"
              >
                <SignOut size={18} weight="bold" /> {t.logout}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
