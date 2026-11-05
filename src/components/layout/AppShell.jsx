import { useState, useEffect } from 'react'
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import BottomNav from './BottomNav'
import { NAV_GROUPS, filterNavByWorkspace } from './NavItems'
import { useWorkspace } from '../../context/WorkspaceContext'
import WorldLogo from '../WorldLogo'
import { X, Lightning, Plus, Keyboard } from '@phosphor-icons/react'
import { useTheme } from '../../context/ThemeContext'
import { useLanguage } from '../../context/LanguageContext'
import { app } from '../../i18n/app'
import FocusMode from '../FocusMode'
import QuickCapture from '../QuickCapture'
import ShortcutsModal from '../ShortcutsModal'
import DesktopBanner from './DesktopBanner'
import WorkspaceSwitcher from './WorkspaceSwitcher'
import MascotBot from '../MascotBot'

function MobileDrawer({ open, onClose }) {
  const { lang } = useLanguage()
  const t = app[lang]
  // Menu mobile dùng chung danh sách với sidebar → cùng bộ lọc theo chế độ
  const { active } = useWorkspace()
  const groups = filterNavByWorkspace(NAV_GROUPS, active?.workspace?.type || 'PERSONAL')
  return (
    <div
      className={`fixed inset-0 z-50 lg:hidden ${open ? '' : 'pointer-events-none'}`}
      aria-hidden={!open}
    >
      <div
        className={`absolute inset-0 bg-room-ink/40 transition-opacity duration-200 ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
      />
      <div
        className={`absolute inset-y-0 left-0 flex w-72 flex-col bg-room-paper shadow-[0_20px_44px_-24px_rgb(0_0_0/0.35)] transition-transform duration-300 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Menu điều hướng"
      >
        <div className="flex h-16 items-center justify-between border-b border-room-acorn/15 px-5">
          <WorldLogo size={32} />
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng menu"
            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-room-ink/50 hover:bg-room-oat/60 hover:text-room-ink"
          >
            <X size={18} weight="bold" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <WorkspaceSwitcher onNavigate={onClose} />
          {groups.map((group) => (
            <div key={group.labelKey} className="mb-5">
              <p className="mb-1.5 px-3 text-xs font-bold text-room-ink/40">
                {t[group.labelKey]}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      onClick={onClose}
                      className={({ isActive }) =>
                        [
                          'flex min-h-11 items-center gap-3 rounded-full px-3 py-2.5 text-sm font-bold transition',
                          isActive
                            ? 'bg-room-oat text-room-ink ring-1 ring-room-acorn/25'
                            : 'text-room-ink/70 hover:bg-room-oat/60 hover:text-room-ink',
                        ].join(' ')
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <item.icon size={20} weight={isActive ? 'bold' : 'regular'} />
                          {t[item.labelKey]}
                          {item.pro && (
                            <span className="ml-auto rounded-full bg-room-paper px-2 py-px text-[10px] font-bold text-room-acorn ring-1 ring-room-acorn/30">
                              Pro
                            </span>
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
      </div>
    </div>
  )
}

export default function AppShell({ title = '' }) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [focusOpen, setFocusOpen] = useState(false)
  const [captureOpen, setCaptureOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  // Tăng mỗi khi tạo công việc xong → remount Outlet → trang đang mở tự refetch
  const [refreshKey, setRefreshKey] = useState(0)
  const { toggleTheme } = useTheme()
  const { toggleLang } = useLanguage()
  const { activeId } = useWorkspace()
  const navigate = useNavigate()
  const location = useLocation()

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      // Ignore if typing in input/textarea
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return

      const ctrl = e.ctrlKey || e.metaKey

      // Ctrl+N – New task
      if (ctrl && e.key === 'n') { e.preventDefault(); navigate('/app/tasks/new') }
      // Ctrl+H – Dashboard
      if (ctrl && e.key === 'h') { e.preventDefault(); navigate('/app') }
      // Ctrl+T – Tasks
      if (ctrl && e.key === 't') { e.preventDefault(); navigate('/app/tasks') }
      // Ctrl+L – Calendar
      if (ctrl && e.key === 'l') { e.preventDefault(); navigate('/app/calendar') }
      // Ctrl+, – Settings
      if (ctrl && e.key === ',') { e.preventDefault(); navigate('/app/settings') }
      // Ctrl+D – Toggle theme
      if (ctrl && e.key === 'd') { e.preventDefault(); toggleTheme() }
      // Ctrl+Shift+L – Toggle language
      if (ctrl && e.shiftKey && e.key === 'L') { e.preventDefault(); toggleLang() }
      // Ctrl+K – Quick capture
      if (ctrl && e.key === 'k') { e.preventDefault(); setCaptureOpen((o) => !o) }
      // Ctrl+F – Focus mode (override only when not in input)
      if (ctrl && e.key === 'f') { e.preventDefault(); setFocusOpen((o) => !o) }
      // ? – Shortcuts
      if (e.key === '?' && !ctrl) { e.preventDefault(); setShortcutsOpen((o) => !o) }
      // Esc – Close any modal
      if (e.key === 'Escape') {
        setFocusOpen(false)
        setCaptureOpen(false)
        setShortcutsOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [navigate, toggleTheme, toggleLang])

  return (
    <div className="room-world flex min-h-dvh bg-room-paper text-room-ink transition-colors">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header title={title} onOpenDrawer={() => setDrawerOpen(true)} />
        {/* Mời cài bản desktop để chuông báo chạy cả khi app web đóng */}
        <DesktopBanner />
        {/* Vệt sáng chạy ngang mỗi lần chuyển mục */}
        <div className="pointer-events-none relative h-0">
          <span key={location.pathname} className="route-beam" aria-hidden="true" />
        </div>
        {/* lg+: chừa rãnh phải cho cụm 3 nút nổi (fixed right-4, ~56px) — không
            chừa thì mép thẻ ở cánh tủ của dashboard bị cụm nút đè lên. */}
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-6 sm:px-6 lg:pb-10 lg:pr-20">
          {/* key theo đường dẫn → mỗi lần chuyển mục, trang trượt lên + mờ dần */}
          <div key={location.pathname} className="page-enter">
            {/* Đổi chế độ (Cá nhân/Lớp/Nhóm) cũng remount để tải lại dữ liệu
                đúng ngữ cảnh X-Workspace. */}
            <Outlet key={`${refreshKey}-${activeId ?? 'personal'}`} />
          </div>
        </main>
      </div>
      <BottomNav />
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      {/* Floating Action Buttons */}
      <div className="fixed bottom-24 right-4 z-40 flex flex-col gap-2.5 sm:bottom-8">
        {/* Shortcuts button */}
        <button
          onClick={() => setShortcutsOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-room-paper text-room-ink/60 shadow-[0_10px_22px_-14px_rgb(0_0_0/0.20)] ring-1 ring-room-acorn/25 transition-all hover:scale-105 hover:brightness-[0.97] hover:text-room-ink"
          title="Phím tắt (?)"
        >
          <Keyboard size={18} weight="bold" />
        </button>
        {/* Quick Capture button */}
        <button
          onClick={() => setCaptureOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-room-paper text-room-acorn shadow-[0_10px_22px_-14px_rgb(0_0_0/0.20)] ring-1 ring-room-acorn/25 transition-all hover:scale-105 hover:brightness-[0.97] hover:text-room-ink"
          title="Tạo nhanh (Ctrl+K)"
        >
          <Plus size={18} weight="bold" />
        </button>
        {/* Focus Mode button */}
        <button
          onClick={() => setFocusOpen(true)}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-room-acorn text-room-paper shadow-[0_14px_26px_-12px_rgb(0_0_0/0.30)] transition-all hover:-translate-y-0.5 hover:brightness-[0.96] active:translate-y-0 active:scale-[0.99]"
          title="Chế độ tập trung (Ctrl+F)"
        >
          <Lightning size={22} weight="fill" />
        </button>
      </div>

      {/* Chú bot nhỏ đi lang thang ở góc trái dưới — bấm vào để xem gợi ý */}
      <MascotBot />

      {/* Modals */}
      {focusOpen && <FocusMode onClose={() => setFocusOpen(false)} />}
      {captureOpen && (
        <QuickCapture
          onClose={() => setCaptureOpen(false)}
          onCreated={() => setRefreshKey((k) => k + 1)}
        />
      )}
      {shortcutsOpen && <ShortcutsModal onClose={() => setShortcutsOpen(false)} />}
    </div>
  )
}
