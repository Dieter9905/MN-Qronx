import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import BottomNav from './BottomNav'
import { NAV_GROUPS } from './NavItems'
import { Logo } from '../Logo'
import { X, Lightning, Plus, Keyboard } from '@phosphor-icons/react'
import { useTheme } from '../../context/ThemeContext'
import { useLanguage } from '../../context/LanguageContext'
import { app } from '../../i18n/app'
import FocusMode from '../FocusMode'
import QuickCapture from '../QuickCapture'
import ShortcutsModal from '../ShortcutsModal'

function MobileDrawer({ open, onClose }) {
  const { lang } = useLanguage()
  const t = app[lang]
  return (
    <div className={`fixed inset-0 z-50 lg:hidden ${open ? '' : 'pointer-events-none'}`} aria-hidden={!open}>
      <div
        className={`absolute inset-0 bg-navy-900/50 backdrop-blur-sm transition-opacity duration-200 ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
      />
      <div
        className={`absolute inset-y-0 left-0 flex w-72 flex-col bg-white shadow-2xl transition-transform duration-300 dark:bg-slate-900 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Menu điều hướng"
      >
        <div className="flex h-16 items-center justify-between border-b border-navy-100 dark:border-slate-700 px-5">
          <Logo size={32} />
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng menu"
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-navy-400 hover:bg-navy-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <X size={18} weight="bold" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {NAV_GROUPS.map((group) => (
            <div key={group.labelKey} className="mb-5">
              <p className="mb-1.5 px-3 text-[11px] font-bold uppercase tracking-wider text-navy-500 dark:text-slate-500">{t[group.labelKey]}</p>
              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      onClick={onClose}
                      className={({ isActive }) =>
                        [
                          'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition',
                          isActive
                            ? 'bg-brand-gradient-soft text-navy-900 ring-1 ring-blue-100 dark:text-white dark:ring-blue-900'
                            : 'text-navy-500 hover:bg-navy-50 dark:text-slate-400 dark:hover:bg-slate-800',
                        ].join(' ')
                      }
                    >
                      <item.icon size={20} weight="regular" />
                      {t[item.labelKey]}
                      {item.pro && (
                        <span className="ml-auto rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 px-1.5 py-px text-[9px] font-extrabold uppercase tracking-wide text-white">
                          Pro
                        </span>
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
  const { toggleTheme } = useTheme()
  const { toggleLang } = useLanguage()
  const navigate = useNavigate()

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
    <div className="flex min-h-dvh bg-navy-50/60 transition-colors dark:bg-slate-900">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header title={title} onOpenDrawer={() => setDrawerOpen(true)} />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-6 sm:px-6 lg:pb-10">
          <Outlet />
        </main>
      </div>
      <BottomNav />
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      {/* Floating Action Buttons */}
      <div className="fixed bottom-24 right-4 z-40 flex flex-col gap-2.5 sm:bottom-8">
        {/* Shortcuts button */}
        <button
          onClick={() => setShortcutsOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-navy-500 shadow-lg ring-1 ring-navy-100 transition-all hover:scale-110 hover:shadow-xl dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700"
          title="Phím tắt (?)"
        >
          <Keyboard size={18} weight="bold" />
        </button>
        {/* Quick Capture button */}
        <button
          onClick={() => setCaptureOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-blue-600 shadow-lg ring-1 ring-navy-100 transition-all hover:scale-110 hover:shadow-xl dark:bg-slate-800 dark:text-blue-400 dark:ring-slate-700"
          title="Tạo nhanh (Ctrl+K)"
        >
          <Plus size={18} weight="bold" />
        </button>
        {/* Focus Mode button */}
        <button
          onClick={() => setFocusOpen(true)}
          className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-glow-purple transition-all hover:scale-110 hover:shadow-xl active:scale-95"
          title="Chế độ tập trung (Ctrl+F)"
        >
          <Lightning size={22} weight="fill" />
        </button>
      </div>

      {/* Modals */}
      {focusOpen && <FocusMode onClose={() => setFocusOpen(false)} />}
      {captureOpen && <QuickCapture onClose={() => setCaptureOpen(false)} onCreated={() => {}} />}
      {shortcutsOpen && <ShortcutsModal onClose={() => setShortcutsOpen(false)} />}
    </div>
  )
}
